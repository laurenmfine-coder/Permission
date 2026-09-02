// Vercel serverless function: gates worksheet PDF delivery behind a real,
// server-side Loops contact call.
//
// The PDFs themselves live in private-pdfs/, which is excluded from the
// public static deployment by .vercelignore. This function is the only way
// to get the bytes: it is bundled with its own copy of private-pdfs/ via the
// "functions" -> "includeFiles" entry in vercel.json, so it can read a file
// from disk that no URL on the site can reach directly. There is no static
// fallback and no "download anyway" path on failure — if the Loops call does
// not succeed, no file is returned. That is the point of this endpoint.
//
// Environment variables (Vercel -> Project -> Settings -> Environment Variables):
//   LOOPS_API_KEY   required. Already set for api/intake.js and api/question.js.

const fs = require('fs');
const path = require('path');

const LOOPS_BASE = 'https://app.loops.so/api/v1';

// Single source of truth for display name -> file on disk. The client only
// ever sends the display name; it never sees or constructs a file path.
const WORKSHEETS = {
  'Which Room Are You In': 'which-room-are-you-in.pdf',
  'Say No Scripts': 'say-no-scripts.pdf',
  'Pivot Decision Framework': 'pivot-decision-framework.pdf',
  'Ikigai Mapping Worksheet': 'ikigai-mapping-worksheet.pdf',
  'Story Thread Finder': 'story-thread-finder.pdf',
  'Career Values Audit': 'career-values-audit.pdf',
  'Personal Statement Story Map': 'personal-statement-story-map.pdf',
  'Identity Inventory': 'identity-inventory.pdf',
  'Confidence Reframe Worksheet': 'confidence-reframe-worksheet.pdf',
  'Sport Decision Guide': 'sport-decision-guide.pdf'
};

const MAX = { firstName: 100, email: 200, worksheet: 200, source: 300, notes: 500 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function loopsHeaders(key) {
  return { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

async function addToLoops(contact) {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { ok: false, skipped: 'LOOPS_API_KEY not set' };

  const payload = {
    email: contact.email,
    firstName: contact.firstName,
    source: 'Free Resources',
    userGroup: 'CoachingLead',
    worksheet: contact.worksheet,
    leadStage: 'worksheet_download',
    referralSource: contact.source || '',
    notes: contact.notes || '',
    subscribed: true
  };

  const headers = loopsHeaders(key);

  let res = await fetch(LOOPS_BASE + '/contacts/create', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  // Loops returns 409 when the contact already exists — update instead of failing.
  if (res.status === 409) {
    res = await fetch(LOOPS_BASE + '/contacts/update', {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(payload)
    });
  }

  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

async function addToSubstack(contact) {
  // Mirrors the "also send me Permission to Change" checkbox from the old
  // client-only flow. Best-effort: this never blocks file delivery.
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { ok: false, skipped: 'LOOPS_API_KEY not set' };

  const headers = loopsHeaders(key);
  const payload = {
    email: contact.email,
    firstName: contact.firstName,
    source: 'Free Resources',
    userGroup: 'SubstackReader',
    subscribed: true
  };

  let res = await fetch(LOOPS_BASE + '/contacts/create', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });
  if (res.status === 409) {
    res = await fetch(LOOPS_BASE + '/contacts/update', {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(payload)
    });
  }
  return { ok: res.ok, status: res.status };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = {}; }
  }
  if (!data || typeof data !== 'object') data = {};

  // Honeypot: bots fill hidden fields. Look successful, do nothing.
  if (clean(data.company, 200)) {
    return res.status(200).json({ ok: true });
  }

  const worksheet = clean(data.worksheet, MAX.worksheet);
  const file = WORKSHEETS[worksheet];
  if (!file) {
    return res.status(400).json({ error: 'Unknown worksheet.' });
  }

  const contact = {
    firstName: clean(data.firstName, MAX.firstName),
    email: clean(data.email, MAX.email).toLowerCase(),
    worksheet: worksheet,
    source: clean(data.source, MAX.source),
    notes: clean(data.notes, MAX.notes)
  };

  if (!contact.email) {
    return res.status(400).json({ error: 'Please enter your email address.' });
  }
  if (!EMAIL_RE.test(contact.email)) {
    return res.status(400).json({ error: 'That email address does not look right.' });
  }

  const jobs = [addToLoops(contact)];
  if (data.alsoSubstack === true || data.alsoSubstack === 'true') {
    jobs.push(addToSubstack(contact));
  }
  const results = await Promise.allSettled(jobs);
  const audience = results[0].status === 'fulfilled' ? results[0].value : { ok: false, error: String(results[0].reason) };

  if (!audience.ok) {
    console.error('WORKSHEET_NOT_DELIVERED Loops call failed:', JSON.stringify({ worksheet, audience }));
    return res.status(502).json({
      error: 'Something on my end did not confirm your email, so I did not want to send the file without it. ' +
             'Please try again, or email me directly at reasondxcoaching@gmail.com and I will send it over.',
      captured: false
    });
  }

  let bytes;
  try {
    bytes = fs.readFileSync(path.join(process.cwd(), 'private-pdfs', file));
  } catch (e) {
    console.error('WORKSHEET_FILE_MISSING:', file, String(e));
    return res.status(500).json({
      error: 'Your email was saved, but the file did not load on my end. ' +
             'Email reasondxcoaching@gmail.com and I will send it directly — sorry about that.',
      captured: true
    });
  }

  console.log('Worksheet delivered:', JSON.stringify({ worksheet, email: contact.email }));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="' + file + '"');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(bytes);
};
