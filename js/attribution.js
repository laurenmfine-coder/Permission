/* First-touch attribution for laurenfine.com.
   Remembers where a visitor first came from (UTM tags, or the referring site
   when there are no tags) and keeps it for 90 days in this browser, so a
   worksheet download or a Calendly booking made on a later page still records
   the original channel. Nothing leaves the browser except through the existing
   forms (as the utm_* notes) and the Calendly links (as utm_* parameters). */
(function () {
  var KEY = 'lf_touch';
  var MAX_AGE = 90 * 24 * 3600 * 1000;
  var FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

  function read() {
    try {
      var t = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (t && t.ts && Date.now() - t.ts < MAX_AGE) return t;
    } catch (e) {}
    return null;
  }
  function write(t) {
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
  }
  function fromReferrer() {
    var r = document.referrer || '';
    if (!r) return null;
    var host = '';
    try { host = new URL(r).hostname.replace(/^www\./, ''); } catch (e) { return null; }
    if (!host || host === location.hostname.replace(/^www\./, '')) return null;
    var map = [
      [/google\./, 'google', 'organic'], [/bing\.com$/, 'bing', 'organic'],
      [/duckduckgo\.com$/, 'duckduckgo', 'organic'], [/yahoo\./, 'yahoo', 'organic'],
      [/pinterest\./, 'pinterest', 'social'], [/instagram\.com$/, 'instagram', 'social'],
      [/facebook\.com$|fb\.com$|l\.facebook\.com$/, 'facebook', 'social'],
      [/linkedin\.com$|lnkd\.in$/, 'linkedin', 'social'], [/substack\.com$/, 'substack', 'referral'],
      [/kevinmd\.com$/, 'kevinmd', 'referral'], [/chatgpt\.com$|openai\.com$|perplexity\.ai$|claude\.ai$/, 'ai-search', 'referral']
    ];
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(host)) return { utm_source: map[i][1], utm_medium: map[i][2] };
    }
    return { utm_source: host, utm_medium: 'referral' };
  }

  var here = new URLSearchParams(location.search);
  var tagged = here.get('utm_source');
  var stored = read();
  if (tagged) {
    var t = { ts: Date.now(), landing: location.pathname };
    FIELDS.forEach(function (f) { if (here.get(f)) t[f] = here.get(f); });
    if (!stored || !stored.tagged) { t.tagged = true; write(t); stored = t; }
  } else if (!stored) {
    var ref = fromReferrer();
    if (ref) { ref.ts = Date.now(); ref.landing = location.pathname; write(ref); stored = ref; }
  }

  /* Drop-in replacement for new URLSearchParams(location.search) in the forms:
     tags in the current URL win, otherwise the remembered first touch fills in. */
  window.lfParams = function () {
    var p = new URLSearchParams(location.search);
    var t = read();
    if (!p.get('utm_source') && t) {
      FIELDS.forEach(function (f) { if (t[f] && !p.get(f)) p.set(f, t[f]); });
    }
    return p;
  };

  /* Carry the source onto every Calendly link, so each booking shows its channel. */
  function tagCalendly(a) {
    if (!a || !a.href || a.href.indexOf('calendly.com/reasondxcoaching') === -1) return;
    var p = window.lfParams();
    if (!p.get('utm_source')) return;
    try {
      var u = new URL(a.href);
      FIELDS.forEach(function (f) { if (p.get(f) && !u.searchParams.get(f)) u.searchParams.set(f, p.get(f)); });
      a.href = u.toString();
    } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="calendly.com"]') : null;
    tagCalendly(a);
  }, true);
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href*="calendly.com/reasondxcoaching"]').forEach(tagCalendly);
  });
})();

/* Signup alerts. Site signups go to Flodesk through the API, and Flodesk does
   not send a notice for those. So when any newsletter or worksheet signup on
   the site succeeds, this also emails Lauren through Web3Forms (the same
   service the free-session form already uses). Runs on every page because
   this file loads first everywhere. The free-session form sends its own
   alert, so it is skipped here. */
(function () {
  if (!window.fetch || window.__lfSignupAlerts) return;
  window.__lfSignupAlerts = true;
  var W3F_KEY = 'f6a893b9-1784-4b24-a0d4-d8a387a97218';
  var ENDPOINTS = /\/api\/(subscribe|download)(\?|$)/;
  var origFetch = window.fetch;

  function parseBody(body) {
    var out = {};
    if (!body) return out;
    try {
      if (typeof body === 'string') {
        var s = body.trim();
        if (s.charAt(0) === '{') return JSON.parse(s);
        new URLSearchParams(s).forEach(function (v, k) { out[k] = v; });
      } else if (body instanceof URLSearchParams || (window.FormData && body instanceof FormData)) {
        body.forEach(function (v, k) { if (typeof v === 'string') out[k] = v; });
      }
    } catch (e) {}
    return out;
  }

  function alertLauren(d) {
    var email = (d.email || '').trim();
    if (!email || d.company) return;
    var seen = window.__lfAlerted || (window.__lfAlerted = {});
    if (seen[email.toLowerCase()]) return;
    seen[email.toLowerCase()] = true;
    var name = [d.firstName || d.first_name || d.name || '', d.lastName || ''].join(' ').trim();
    var source = d.source || d.worksheet || '';
    try {
      origFetch('https://api.web3forms.com/submit', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: W3F_KEY,
          subject: 'New Sunday Letter signup: ' + (name || email),
          from_name: 'laurenfine.com signups',
          replyto: email,
          Name: name,
          Email: email,
          'Signed up from': source,
          Worksheet: d.worksheet || '',
          Page: location.href.split('?')[0]
        })
      }).catch(function () {});
    } catch (e) {}
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var p = origFetch.apply(this, arguments);
    if (method !== 'POST' || !ENDPOINTS.test(url) || /\/free-session(\.html)?$/.test(location.pathname)) return p;
    var data = parseBody(init && init.body);
    return p.then(function (res) {
      if (res && res.ok) alertLauren(data);
      return res;
    });
  };
})();

/* Live chat bubble. Kept in its own file; loaded from here because this
   script is already on every page. */
(function () {
  var s = document.createElement('script');
  s.src = '/js/chat-widget.js';
  s.async = true;
  document.head.appendChild(s);
})();

// Temporary Black Friday slide-in (self-expires after Dec 2, 2026).
(function () {
  var s = document.createElement('script');
  s.src = '/js/bf-slidein.js';
  s.async = true;
  document.head.appendChild(s);
})();
