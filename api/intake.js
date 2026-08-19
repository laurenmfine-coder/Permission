// Vercel serverless function: handles free-session intake submissions.
//
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   LOOPS_API_KEY   required for adding the contact to Loops
//   RESEND_API_KEY  optional; enables the notification email
//   NOTIFY_EMAIL    optional; where notifications go (default reasondxcoaching@gmail.com)
//   FROM_EMAIL      optional; verified Resend sender (default onboarding@resend.dev)

const REQUIRED = ['firstName', 'lastName', 'email', 'situation', 'focus'];
const MAX = { firstName: 100, lastName: 100, email: 200, situation: 120, focus: 4000, source: 300 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
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

  const headers = {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  };

  let res = await fetch('https://app.loops.so/api/v1/contacts/create', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  // Loops returns 409 when the contact already exists — update instead of failing.
  if (res.status === 409) {
    res = await fetch('https://app.loops.so/api/v1/contacts/update', {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(payload)
    });
  }

  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

async function notify(contact) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: 'RESEND_API_KEY not set' };

  const to = process.env.NOTIFY_EMAIL || 'reasondxcoaching@gmail.com';
  const from = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  // onboarding@resend.dev is Resend's shared test sender. It is only allowed to
  // deliver to the address that owns the Resend account; anything else is a 403.
  // Set FROM_EMAIL to an address on a domain verified at resend.com/domains.
  if (from === 'onboarding@resend.dev') {
    console.warn('FROM_EMAIL is not set, falling back to onboarding@resend.dev. Delivery to ' + to + ' will fail with 403 unless that is the Resend account address.');
  }

  const rows = [
    ['Name', contact.firstName + ' ' + contact.lastName],
    ['Email', contact.email],
    ['Where they are', contact.situation],
    ['Found you via', contact.source || '—']
  ].map(function (pair) {
    return '<tr><td style="padding:6px 16px 6px 0;color:#8C8580;font-size:13px;white-space:nowrap;">' +
      escapeHtml(pair[0]) + '</td><td style="padding:6px 0;color:#1A1A1A;font-size:14px;">' +
      escapeHtml(pair[1]) + '</td></tr>';
  }).join('');

  const html =
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;">' +
    '<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#B8975A;margin:0 0 8px;">Free session request</p>' +
    '<h2 style="font-size:22px;color:#23406E;margin:0 0 20px;font-weight:400;">' +
    escapeHtml(contact.firstName + ' ' + contact.lastName) + '</h2>' +
    '<table style="border-collapse:collapse;margin-bottom:24px;">' + rows + '</table>' +
    '<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8C8580;margin:0 0 8px;">What would make it worth their time</p>' +
    '<p style="font-size:15px;line-height:1.7;color:#1A1A1A;white-space:pre-wrap;margin:0 0 24px;border-left:2px solid #B8975A;padding-left:16px;">' +
    escapeHtml(contact.focus) + '</p>' +
    '<p style="font-size:13px;color:#8C8580;">Reply straight to this email to reach them.</p>' +
    '</div>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Free Session Form <' + from + '>',
      to: [to],
      reply_to: contact.email,
      subject: 'Free session request — ' + contact.firstName + ' ' + contact.lastName,
      html: html
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
  const loops = results[0].status === 'fulfilled' ? results[0].value : { ok: false, error: String(results[0].reason) };
  const mail = results[1].status === 'fulfilled' ? results[1].value : { ok: false, error: String(results[1].reason) };

  if (!loops.ok) console.error('Loops call did not succeed:', JSON.stringify(loops));
  if (!mail.ok) console.error('Notification email did not send:', JSON.stringify(mail));

  // One surviving channel is enough: Loops means the contact is in the CRM,
  // Resend means the request is sitting in the inbox. Either way it is not lost,
  // so don't trouble the visitor over a downstream service having a bad day.
  const captured = !!loops.ok || !!mail.ok;

  if (!captured) {
    // Both channels are down. Saying "thank you" here would strand the person:
    // they would believe they had booked while nothing recorded them anywhere.
    console.error('LEAD_NOT_CAPTURED both Loops and Resend failed:', JSON.stringify(contact));
    return res.status(502).json({
      error: 'Something on my end did not save your request. Please email me directly at ' +
             (process.env.NOTIFY_EMAIL || 'reasondxcoaching@gmail.com') +
             ' and I will pick it up from there.',
      captured: false
    });
  }

  console.log('Free session request:', JSON.stringify(contact));

  return res.status(200).json({ ok: true, loops: !!loops.ok, notified: !!mail.ok });
};
