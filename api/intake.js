// Vercel serverless function: shared lead-capture endpoint.
//
// Two flows share this file, split by whether the request includes a `list`
// slug:
//
//   1. Free-session request (original, no `list` field) - situation/focus
//      required, contact upserted via create-then-update-on-409, plus a
//      notification email to Lauren via Loops transactional.
//
//   2. Mailing-list signup (physician-moms-emails.html, and reusable for a
//      Permission to Change FB Group page at another URL) - just firstName/
//      email required. The contact is upserted via contacts/update directly,
//      not create, since many of these people already exist in the Loops
//      audience and create fails on an existing email. Loops' welcome
//      automation for these groups fires on "Contact added to list," so the
//      write has to actually set mailingLists true, not just touch the
//      contact record - contacts/update with a mailingLists object does
//      that. No notification email for this flow; the "notification" is the
//      inline success state on the page itself.
//
// Environment variables (Vercel -> Project -> Settings -> Environment Variables):
//   LOOPS_API_KEY           required. Loops -> Settings -> API.
//   NOTIFY_EMAIL            optional, free-session flow only.
//   LOOPS_TRANSACTIONAL_ID  optional, free-session flow only.

const LOOPS_BASE = 'https://app.loops.so/api/v1';

// "Free session request notification", published in Loops.
// Not a secret — it identifies a template, it does not grant access.
const DEFAULT_TRANSACTIONAL_ID = 'cmt0p89n207pk0i2k08fmv63a';

// Server-side only. The client sends a short slug, never a raw Loops list ID -
// this is what stops a request from writing an arbitrary contact into an
// arbitrary Loops list.
const MAILING_LISTS = {
  pmac: { id: 'cmtf1p5pk0e6t0jzq4hrc53ad', source: 'physician-moms-page' },
  ptc: { id: 'cmtf1onn39ltn0jww7hnm2272', source: 'permission-to-change-page' }
};

const REQUIRED = ['firstName', 'lastName', 'email', 'situation', 'focus'];
const LIST_REQUIRED = ['firstName', 'email'];
const MAX = { firstName: 100, lastName: 100, email: 200, situation: 120, focus: 4000, source: 300, list: 20 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function notifyAddress() {
  return process.env.NOTIFY_EMAIL || 'reasondxcoaching@gmail.com';
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
    lastName: contact.lastName,
    source: 'Free Session Form',
    userGroup: contact.situation,
    situation: contact.situation,
    focus: contact.focus,
    referralSource: contact.source || '',
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

async function addToMailingList(contact, listMeta) {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { ok: false, skipped: 'LOOPS_API_KEY not set' };

  const payload = {
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    source: listMeta.source,
    mailingLists: {}
  };
  payload.mailingLists[listMeta.id] = true;

  // Upsert directly - not create-then-update-on-409. Many of these people
  // already exist in the audience, and contacts/create fails outright on an
  // existing email rather than updating it, so create would fail for exactly
  // the people this page is most likely to be reaching.
  const res = await fetch(LOOPS_BASE + '/contacts/update', {
    method: 'PUT',
    headers: loopsHeaders(key),
    body: JSON.stringify(payload)
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

async function notify(contact) {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { ok: false, skipped: 'LOOPS_API_KEY not set' };

  const transactionalId = process.env.LOOPS_TRANSACTIONAL_ID || DEFAULT_TRANSACTIONAL_ID;

  // Every data variable in the Loops template is marked required, so send a
  // placeholder rather than an empty string for the optional form fields.
  const res = await fetch(LOOPS_BASE + '/transactional', {
    method: 'POST',
    headers: loopsHeaders(key),
    body: JSON.stringify({
      transactionalId: transactionalId,
      email: notifyAddress(),
      dataVariables: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        situation: contact.situation,
        referralSource: contact.source || 'Not given',
        focus: contact.focus
      }
    })
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
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

  // ---- Mailing-list signup flow ----
  const listSlug = clean(data.list, MAX.list);
  if (listSlug) {
    const listMeta = MAILING_LISTS[listSlug];
    if (!listMeta) {
      return res.status(400).json({ error: 'Unknown mailing list.' });
    }

    const contact = {
      firstName: clean(data.firstName, MAX.firstName),
      lastName: clean(data.lastName, MAX.lastName),
      email: clean(data.email, MAX.email).toLowerCase()
    };

    const missing = LIST_REQUIRED.filter(function (f) { return !contact[f]; });
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields: ' + missing.join(', ') });
    }
    if (!EMAIL_RE.test(contact.email)) {
      return res.status(400).json({ error: 'That email address does not look right.' });
    }

    const result = await addToMailingList(contact, listMeta);

    if (!result.ok) {
      console.error('LIST_SIGNUP_NOT_CAPTURED Loops call failed:', JSON.stringify({ listSlug: listSlug, result: result }));
      return res.status(502).json({
        error: 'Something on my end did not save your signup. Please try again in a minute, or email ' +
               notifyAddress() + ' and I will add you directly.',
        captured: false
      });
    }

    // contacts/update is an upsert, so a duplicate submission (someone already
    // on the list resubmitting) succeeds the same way a first-time signup
    // does - same 200, same response shape, nothing for the client to branch on.
    console.log('Mailing list signup:', JSON.stringify({ listSlug: listSlug, email: contact.email }));
    return res.status(200).json({ ok: true, loops: true });
  }

  // ---- Free-session flow (original) ----
  const contact = {
    firstName: clean(data.firstName, MAX.firstName),
    lastName: clean(data.lastName, MAX.lastName),
    email: clean(data.email, MAX.email).toLowerCase(),
    situation: clean(data.situation, MAX.situation),
    focus: clean(data.focus, MAX.focus),
    source: clean(data.source, MAX.source)
  };

  const missing = REQUIRED.filter(function (f) { return !contact[f]; });
  if (missing.length) {
    return res.status(400).json({ error: 'Missing required fields: ' + missing.join(', ') });
  }
  if (!EMAIL_RE.test(contact.email)) {
    return res.status(400).json({ error: 'That email address does not look right.' });
  }

  const results = await Promise.allSettled([addToLoops(contact), notify(contact)]);
  const audience = results[0].status === 'fulfilled' ? results[0].value : { ok: false, error: String(results[0].reason) };
  const mail = results[1].status === 'fulfilled' ? results[1].value : { ok: false, error: String(results[1].reason) };

  if (!audience.ok) console.error('Loops contact call did not succeed:', JSON.stringify(audience));
  if (!mail.ok) console.error('Loops notification did not send:', JSON.stringify(mail));

  // One surviving channel is enough: the contact record means the person is in
  // the CRM, the notification means the request is sitting in the inbox. Either
  // way it is not lost, so don't trouble the visitor over a partial failure.
  const captured = !!audience.ok || !!mail.ok;

  if (!captured) {
    // Both calls failed. Saying "thank you" here would strand the person: they
    // would believe they had booked while nothing recorded them anywhere.
    console.error('LEAD_NOT_CAPTURED both Loops calls failed:', JSON.stringify(contact));
    return res.status(502).json({
      error: 'Something on my end did not save your request. Please email me directly at ' +
             notifyAddress() + ' and I will pick it up from there.',
      captured: false
    });
  }

  console.log('Free session request:', JSON.stringify(contact));

  return res.status(200).json({ ok: true, loops: !!audience.ok, notified: !!mail.ok });
};
