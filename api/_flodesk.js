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
//
// `extraSegments` (optional) adds segment ids on top of FLODESK_SEGMENT_ID,
// e.g. a per-path segment from the /room quiz so a matching welcome
// workflow can fire. Empty or missing ids are dropped.
// Look up an existing subscriber's custom fields. Returns {} for a new
// subscriber, or null if the lookup failed, in which case the first-touch
// fields are skipped rather than risk overwriting them. Never blocks a signup.
async function existingFields(key, email) {
  try {
    const res = await fetch(FLODESK_BASE + '/subscribers/' + encodeURIComponent(email), {
      headers: { Authorization: authHeader(key) },
      signal: AbortSignal.timeout(2500)
    });
    if (res.status === 404) return {};
    if (!res.ok) return null;
    const body = await res.json();
    return (body && body.custom_fields) || {};
  } catch (e) {
    return null;
  }
}

// `firstOnlyFields` (optional) are written only when the subscriber does not
// already have a value for them, e.g. first_source, so the page a person
// first came in through is kept even after later signups overwrite source.
async function upsertSubscriber(contact, customFields, extraSegments, firstOnlyFields) {
  const key = process.env.FLODESK_API_KEY;
  if (!key) return { ok: false, skipped: 'FLODESK_API_KEY not set' };
  customFields = Object.assign({}, customFields || {});
  const firstKeys = Object.keys(firstOnlyFields || {}).filter(function (k) { return firstOnlyFields[k]; });
  if (firstKeys.length) {
    const have = await existingFields(key, contact.email);
    if (have) firstKeys.forEach(function (k) { if (!have[k]) customFields[k] = firstOnlyFields[k]; });
  }

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
  (extraSegments || []).forEach(function (id) {
    const v = String(id || '').trim();
    if (v && segments.indexOf(v) === -1) segments.push(v);
  });
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
