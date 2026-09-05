// Shared Flodesk client.
//
// Replaces the Loops REST calls that used to live in api/intake.js,
// api/question.js and api/download.js. Flodesk's API does have a write
// endpoint, contrary to an earlier assumption, so the site keeps capturing
// leads server-side instead of handing visitors off to an embedded form.
//
// Docs: https://developers.flodesk.com/
//   POST /v1/subscribers  — create or update (upsert) by email, and
//                           optionally drop the subscriber into segments.
//
// Auth is HTTP Basic with the API key as the username and an empty password.
//
// Environment variables (Vercel -> Project -> Settings -> Environment Variables):
//   FLODESK_API_KEY      required. Flodesk -> My Account -> Integrations -> API keys.
//                        Paid plans only; trial and free accounts cannot issue one.
//   FLODESK_SEGMENT_ID   optional. The segment every site signup lands in.
//                        Flodesk workflows trigger on segment membership, so
//                        without this a subscriber is created but no welcome
//                        email fires.

const FLODESK_BASE = 'https://api.flodesk.com/v1';

function authHeader(key) {
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

function segmentIds() {
  const raw = process.env.FLODESK_SEGMENT_ID || '';
  return raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

// Upsert a subscriber. `customFields` is a flat object of strings; Flodesk
// ignores keys that do not exist on the account, so an unknown field is a
// no-op rather than an error.
async function upsertSubscriber(contact, customFields) {
  const key = process.env.FLODESK_API_KEY;
  if (!key) return { ok: false, skipped: 'FLODESK_API_KEY not set' };

  const payload = {
    email: contact.email,
    first_name: contact.firstName || '',
    last_name: contact.lastName || ''
  };

  const fields = {};
  Object.keys(customFields || {}).forEach(function (k) {
    const v = customFields[k];
    if (v != null && String(v).length) fields[k] = String(v).slice(0, 1000);
  });
  if (Object.keys(fields).length) payload.custom_fields = fields;

  const segments = segmentIds();
  if (segments.length) payload.segment_ids = segments.slice(0, 50);

  const res = await fetch(FLODESK_BASE + '/subscribers', {
    method: 'POST',
    headers: {
      Authorization: authHeader(key),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 500) };
}

module.exports = { upsertSubscriber: upsertSubscriber, FLODESK_BASE: FLODESK_BASE };
