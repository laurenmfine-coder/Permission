// TEMPORARY DIAGNOSTIC — delete this file once the intake form is confirmed working.
//
// Reports whether the Loops and Resend credentials are present and actually valid,
// without ever revealing their values. Reachable only with the token below:
//
//   https://laurenfine.com/api/health?token=7dee8ace0c7db32dd9cce61a

const TOKEN = '7dee8ace0c7db32dd9cce61a';

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

async function checkResend() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || 'onboarding@resend.dev';
  const to = process.env.NOTIFY_EMAIL || 'reasondxcoaching@gmail.com';
  const usingTestSender = from === 'onboarding@resend.dev';

  const out = { from: from, to: to, usingTestSender: usingTestSender };

  if (usingTestSender) {
    out.warning = 'FROM_EMAIL is not set. onboarding@resend.dev can ONLY deliver to the ' +
                  'address that owns the Resend account. Sending to ' + to +
                  ' will return 403 unless that is the account address.';
  }
  if (!key) {
    out.configured = false;
    out.verdict = 'RESEND_API_KEY is not set in this environment';
    return out;
  }

  out.configured = true;
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: 'Bearer ' + key }
    });
    const body = await res.json().catch(function () { return {}; });
    out.status = res.status;

    if (!res.ok) {
      out.verdict = 'key REJECTED by Resend: ' + (body.message || res.status);
      return out;
    }

    const domains = (body.data || []).map(function (d) {
      return { name: d.name, status: d.status };
    });
    out.domains = domains;

    const fromDomain = from.split('@')[1] || '';
    const match = domains.filter(function (d) { return d.name === fromDomain; })[0];

    if (usingTestSender) {
      out.verdict = domains.length
        ? 'key is valid. A domain IS available — set FROM_EMAIL to an address on it.'
        : 'key is valid, but NO domain is verified, so only the test sender is possible.';
    } else if (!match) {
      out.verdict = 'key is valid, but ' + fromDomain + ' is NOT in this Resend account. Sending will fail.';
    } else if (match.status !== 'verified') {
      out.verdict = fromDomain + ' is present but status is "' + match.status + '", not verified. Sending will fail.';
    } else {
      out.verdict = fromDomain + ' is verified. Sending should work.';
    }
    return out;
  } catch (e) {
    out.verdict = 'could not reach Resend: ' + String(e.message || e);
    return out;
  }
}

module.exports = async function handler(req, res) {
  const token = (req.query && req.query.token) || '';
  if (token !== TOKEN) return res.status(404).json({ error: 'Not found' });

  const results = await Promise.all([checkLoops(), checkResend()]);

  return res.status(200).json({
    note: 'Temporary diagnostic. Delete api/health.js when finished.',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    loops: results[0],
    resend: results[1]
  });
};
