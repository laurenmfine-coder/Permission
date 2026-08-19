// TEMPORARY DIAGNOSTIC — delete this file once the intake form is confirmed working.
//
// Reports whether the Loops credentials are present and actually valid, without
// ever revealing their values. Reachable only with the token below:
//
//   https://laurenfine.com/api/health?token=7dee8ace0c7db32dd9cce61a

const TOKEN = '7dee8ace0c7db32dd9cce61a';
const DEFAULT_TRANSACTIONAL_ID = 'cmt0p89n207pk0i2k08fmv63a';

async function checkLoops() {
  const key = process.env.LOOPS_API_KEY;
  if (!key) return { configured: false, verdict: 'LOOPS_API_KEY is not set in this environment' };
  try {
    const res = await fetch('https://app.loops.so/api/v1/api-key', {
      headers: { Authorization: 'Bearer ' + key }
    });
    const body = await res.json().catch(function () { return {}; });
    return {
      configured: true,
      status: res.status,
      verdict: res.ok
        ? 'key is valid, team: ' + (body.teamName || 'unknown')
        : 'key REJECTED by Loops: ' + (body.message || res.status)
    };
  } catch (e) {
    return { configured: true, verdict: 'could not reach Loops: ' + String(e.message || e) };
  }
}

function checkNotification() {
  const id = process.env.LOOPS_TRANSACTIONAL_ID || DEFAULT_TRANSACTIONAL_ID;
  return {
    transactionalId: id,
    usingDefault: !process.env.LOOPS_TRANSACTIONAL_ID,
    notifyEmail: process.env.NOTIFY_EMAIL || 'reasondxcoaching@gmail.com',
    note: 'The notification is sent through the Loops transactional API using this ' +
          'template. If the template is unpublished or the id is wrong, the send ' +
          'returns 404 and the error appears in the Vercel logs for /api/intake.'
  };
}

module.exports = async function handler(req, res) {
  const token = (req.query && req.query.token) || '';
  if (token !== TOKEN) return res.status(404).json({ error: 'Not found' });

  const loops = await checkLoops();

  return res.status(200).json({
    note: 'Temporary diagnostic. Delete api/health.js when finished.',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    loops: loops,
    notification: checkNotification()
  });
};
