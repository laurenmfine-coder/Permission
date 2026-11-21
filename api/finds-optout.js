// Vercel serverless function: stop Friday Finds only.
//
// Removes the subscriber from the Friday Finds deals segment
// (FLODESK_SEGMENT_DEALS) and leaves every other segment alone, so they keep
// The Sunday Letter. Flodesk's own unsubscribe link removes people from
// everything, which is why this exists. Linked from every Friday Finds email
// as "Just stop Friday Finds" -> laurenfine.com/friday-finds-stop.

const { removeFromSegments } = require('./_flodesk.js');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseBody(req) {
  let data = req.body;
  if (typeof data === 'string') {
    const raw = data.trim();
    if (raw.startsWith('{')) { try { return JSON.parse(raw); } catch (e) { return {}; } }
    const out = {}; new URLSearchParams(raw).forEach(function (v, k) { out[k] = v; }); return out;
  }
  return data && typeof data === 'object' ? data : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  const data = parseBody(req);
  if (String(data.company || '').trim()) return res.status(200).json({ ok: true }); // honeypot
  const email = String(data.email || '').trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'That email address does not look right.' });
  const segment = process.env.FLODESK_SEGMENT_DEALS;
  if (!segment) {
    console.error('FINDS_OPTOUT_NOT_DONE FLODESK_SEGMENT_DEALS is not set', email);
    return res.status(503).json({ error: 'That did not go through on my end. Email reasondxcoaching@gmail.com and I will take you off Friday Finds myself.' });
  }
  const result = await removeFromSegments(email, [segment]);
  if (!result.ok) {
    console.error('FINDS_OPTOUT_FAILED', JSON.stringify(result));
    return res.status(502).json({ error: 'That did not go through on my end. Email reasondxcoaching@gmail.com and I will take you off Friday Finds myself.' });
  }
  console.log('Friday Finds opt-out:', email);
  return res.status(200).json({ ok: true });
};
