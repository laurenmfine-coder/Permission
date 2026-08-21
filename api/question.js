// Vercel serverless function: handles anonymous question submissions.
//
// The point of this endpoint is that it works with no email address at all.
// Someone can ask the thing they are actually stuck on without identifying
// themselves. If they choose to leave an email, they get added to Loops as a
// contact; if they don't, the question still reaches the inbox.
//
// Environment variables (Vercel -> Project -> Settings -> Environment Variables):
//   LOOPS_API_KEY                    required. Loops -> Settings -> API.
//   NOTIFY_EMAIL                     optional. Where the notification lands.
//                                    Defaults to reasondxcoaching@gmail.com.
//   LOOPS_QUESTION_TRANSACTIONAL_ID  optional. A Loops template written for
//                                    questions. Without it this falls back to
//                                    the free-session template, mapping the
//                                    question into its "focus" variable, which
//                                    reads fine but is not purpose-built.

const LOOPS_BASE = 'https://app.loops.so/api/v1';

// Same published template the intake form uses. Not a secret: it identifies a
// template, it does not grant access.
const FALLBACK_TRANSACTIONAL_ID = 'cmt0p89n207pk0i2k08fmv63a';

const MAX = { question: 4000, email: 200, context: 300, source: 300 };
const MIN_QUESTION = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// A human needs a few seconds to type a question. Anything faster is a script.
const MIN_FILL_MS = 3000;

function clean(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function notifyAddress() {
  return process.env.NOTIFY_EMAIL || 'reasondxcoaching@gmail.com';
}

function loopsHeaders(key) {
  return { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

async function addToLoops(entry) {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { ok: false, skipped: 'LOOPS_API_KEY not set' };
  if (!entry.email) return { ok: false, skipped: 'asked anonymously' };

  const payload = {
    email: entry.email,
    source: 'Anonymous Question',
    userGroup: 'Question',
    situation: 'Asked a question',
    focus: entry.question,
    referralSource: entry.source || '',
    subscribed: true
  };

  const headers = loopsHeaders(key);

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

  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

async function notify(entry) {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { ok: false, skipped: 'LOOPS_API_KEY not set' };

  const transactionalId =
    process.env.LOOPS_QUESTION_TRANSACTIONAL_ID || FALLBACK_TRANSACTIONAL_ID;

  // Every data variable in the fallback template is marked required, so send a
  // readable placeholder rather than an empty string.
  const res = await fetch(LOOPS_BASE + '/transactional', {
    method: 'POST',
    headers: loopsHeaders(key),
    body: JSON.stringify({
      transactionalId: transactionalId,
      email: notifyAddress(),
      dataVariables: {
        firstName: 'Anonymous',
        lastName: 'question',
        email: entry.email || 'Not given — asked anonymously',
        situation: entry.publishOk
          ? 'Question — OK to answer publicly'
          : 'Question — keep private',
        referralSource: (entry.source || 'Not given') +
          (entry.context ? ' | ' + entry.context : ''),
        focus: entry.question
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

  // Timing gate. Cheap, stateless, and catches the scripted submissions that a
  // form with no email requirement otherwise invites.
  const elapsed = Number(data.elapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS) {
    return res.status(200).json({ ok: true });
  }

  const entry = {
    question: clean(data.question, MAX.question),
    email: clean(data.email, MAX.email).toLowerCase(),
    context: clean(data.context, MAX.context),
    source: clean(data.source, MAX.source),
    publishOk: data.publishOk === true || data.publishOk === 'true'
  };

  if (entry.question.length < MIN_QUESTION) {
    return res.status(400).json({ error: 'Could you add a little more? A sentence is plenty.' });
  }
  // Email is optional — that is the whole point — but if given it must be real,
  // otherwise the person believes a reply is coming and it never arrives.
  if (entry.email && !EMAIL_RE.test(entry.email)) {
    return res.status(400).json({ error: 'That email address does not look right. You can also leave it blank.' });
  }

  const results = await Promise.allSettled([addToLoops(entry), notify(entry)]);
  const audience = results[0].status === 'fulfilled' ? results[0].value : { ok: false, error: String(results[0].reason) };
  const mail = results[1].status === 'fulfilled' ? results[1].value : { ok: false, error: String(results[1].reason) };

  if (!mail.ok) console.error('Loops question notification did not send:', JSON.stringify(mail));
  if (entry.email && !audience.ok && !audience.skipped) {
    console.error('Loops contact call did not succeed:', JSON.stringify(audience));
  }

  // The notification is what matters here. An anonymous question that never
  // reaches the inbox is simply lost — there is no contact record to fall back
  // on, so don't tell the person it landed when it didn't.
  if (!mail.ok) {
    console.error('QUESTION_NOT_CAPTURED:', JSON.stringify(entry));
    return res.status(502).json({
      error: 'Something on my end did not save that. Please email me directly at ' +
             notifyAddress() + ' and I will pick it up from there.',
      captured: false
    });
  }

  console.log('Anonymous question:', JSON.stringify({
    hasEmail: !!entry.email,
    publishOk: entry.publishOk,
    source: entry.source,
    length: entry.question.length
  }));

  return res.status(200).json({ ok: true, notified: true, contact: !!audience.ok });
};
