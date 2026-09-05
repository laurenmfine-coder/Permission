// Vercel serverless function: the single newsletter-signup endpoint.
//
// Every email-capture widget on the site posts here: the exit-intent popup
// and homepage scroll widget (js/capture-widgets.js), the homepage entry gate
// (js/entry-gate.js), the media page, the quiz result gate, the secondary
// form on resources.html, and the /join page.
//
// It replaces the public Loops newsletter-form URL those widgets used to POST
// to directly. Flodesk has no equivalent public form URL that takes an
// arbitrary POST, and the Flodesk API key must not ship to the browser, so
// the call is made here instead.
//
// Accepts either JSON or the form-encoded body the old widgets already send,
// so the client change is a one-line URL swap.

const { upsertSubscriber } = require('./_flodesk.js');

const MAX = { firstName: 100, lastName: 100, email: 200, source: 300, notes: 2000, situation: 120, focus: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function parseBody(req) {
  let data = req.body;
  if (typeof data === 'string') {
    const raw = data.trim();
    if (raw.startsWith('{')) {
      try { return JSON.parse(raw); } catch (e) { return {}; }
    }
    const out = {};
    new URLSearchParams(raw).forEach(function (v, k) { out[k] = v; });
    return out;
  }
  return data && typeof data === 'object' ? data : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = parseBody(req);

  // Honeypot: bots fill hidden fields. Look successful, do nothing.
  if (clean(data.company, 200)) {
    return res.status(200).json({ ok: true });
  }

  const contact = {
    firstName: clean(data.firstName, MAX.firstName),
    lastName: clean(data.lastName, MAX.lastName),
    email: clean(data.email, MAX.email).toLowerCase()
  };

  if (!contact.email) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!EMAIL_RE.test(contact.email)) {
    return res.status(400).json({ error: 'That email address does not look right.' });
  }

  const result = await upsertSubscriber(contact, {
    source: clean(data.source, MAX.source),
    lead_stage: clean(data.leadStage, MAX.source),
    notes: clean(data.notes, MAX.notes),
    situation: clean(data.situation, MAX.situation),
    focus: clean(data.focus, MAX.focus)
  });

  if (!result.ok) {
    console.error('SIGNUP_NOT_CAPTURED Flodesk call failed:', JSON.stringify(result));
    return res.status(502).json({
      error: 'Something on my end did not save your signup. Please try again in a minute, ' +
             'or email reasondxcoaching@gmail.com and I will add you directly.',
      captured: false
    });
  }

  console.log('Newsletter signup:', JSON.stringify({ email: contact.email, source: clean(data.source, MAX.source) }));
  return res.status(200).json({ ok: true });
};
