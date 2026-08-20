/* Site-wide email capture: exit-intent popup + sticky bar.
   Reuses the existing Loops newsletter-form endpoint (same one resources.html
   already posts to), tagged with a distinct source per widget so leads can be
   segmented in Loops without touching the backend. */
(function () {
  var LOOPS_ENDPOINT = 'https://app.loops.so/api/newsletter-form/cmr88hbdk18uj0j409a54v49f';
  var STICKY_KEY = 'pf_sticky_dismissed';
  var EXIT_KEY = 'pf_exit_seen';
  var STICKY_DAYS = 14;
  var EXIT_DAYS = 7;

  function daysAgo(key) {
    var v = localStorage.getItem(key);
    if (!v) return Infinity;
    return (Date.now() - parseInt(v, 10)) / 86400000;
  }
  function mark(key) {
    try { localStorage.setItem(key, String(Date.now())); } catch (e) {}
  }
  function emailValid(v) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  }
  function utmNotes() {
    var params = new URLSearchParams(window.location.search);
    return 'utm_source=' + (params.get('utm_source') || '') +
      '; utm_medium=' + (params.get('utm_medium') || '') +
      '; utm_campaign=' + (params.get('utm_campaign') || '') +
      '; referrer=' + (document.referrer || '');
  }
  function submitLead(email, name, source, extra, onDone) {
    var formBody = 'firstName=' + encodeURIComponent(name || '') +
      '&email=' + encodeURIComponent(email) +
      '&source=' + encodeURIComponent(source) +
      '&userGroup=' + encodeURIComponent('CoachingLead') +
      '&leadStage=' + encodeURIComponent(extra || source) +
      '&notes=' + encodeURIComponent(utmNotes());
    fetch(LOOPS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function () { onDone(true); })
      .catch(function () { onDone(false); });
  }

  var CSS = '.pf-widget-css{}' +
    '.pf-overlay{position:fixed;inset:0;background:rgba(26,26,26,0.55);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px;}' +
    '.pf-overlay.open{display:flex;}' +
    '.pf-modal{background:#FFFFFF;max-width:440px;width:100%;padding:40px 32px;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.25);font-family:inherit;}' +
    '.pf-modal-close{position:absolute;top:14px;right:16px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#8C8580;line-height:1;}' +
    '.pf-modal-eyebrow{font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;color:#B8975A;font-weight:600;margin-bottom:10px;}' +
    '.pf-modal-title{font-size:1.5rem;line-height:1.25;margin-bottom:12px;color:#1A1A1A;font-weight:600;}' +
    '.pf-modal-body{font-size:0.92rem;line-height:1.6;color:#5A5450;margin-bottom:20px;}' +
    '.pf-modal input[type=text],.pf-modal input[type=email]{width:100%;padding:12px 14px;border:1px solid #E5E0DA;margin-bottom:10px;font-size:0.92rem;font-family:inherit;background:#FFFFFF;}' +
    '.pf-modal input:focus{outline:none;border-color:#23406E;}' +
    '.pf-modal-submit{width:100%;padding:13px;background:#23406E;color:#fff;border:none;font-size:0.9rem;letter-spacing:0.02em;cursor:pointer;font-family:inherit;margin-top:4px;}' +
    '.pf-modal-submit:hover{background:#182D4E;}' +
    '.pf-modal-submit:disabled{opacity:0.6;cursor:default;}' +
    '.pf-modal-note{font-size:0.72rem;color:#8C8580;margin-top:12px;text-align:center;}' +
    '.pf-sticky{position:fixed;left:0;right:0;bottom:0;background:#1A1A1A;color:#fff;z-index:9997;display:none;padding:12px 20px;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;font-size:0.85rem;}' +
    '.pf-sticky.open{display:flex;}' +
    '.pf-sticky a.pf-sticky-cta{color:#fff;background:#23406E;padding:8px 16px;text-decoration:none;font-size:0.82rem;letter-spacing:0.02em;white-space:nowrap;}' +
    '.pf-sticky a.pf-sticky-cta:hover{background:#182D4E;}' +
    '.pf-sticky-close{background:none;border:none;color:#B8975A;cursor:pointer;font-size:1.1rem;line-height:1;padding:0 4px;}' +
    '@media(max-width:640px){.pf-sticky{font-size:0.78rem;padding:10px 14px;}.pf-modal{padding:30px 22px;}}';

  function injectCSS() {
    if (document.getElementById('pf-widget-style')) return;
    var s = document.createElement('style');
    s.id = 'pf-widget-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function buildExitModal() {
    var overlay = document.createElement('div');
    overlay.className = 'pf-overlay';
    overlay.id = 'pf-exit-overlay';
    overlay.innerHTML =
      '<div class="pf-modal">' +
        '<button class="pf-modal-close" aria-label="Close" onclick="window.__pfCloseExit()">&times;</button>' +
        '<p class="pf-modal-eyebrow">Before you go</p>' +
        '<h3 class="pf-modal-title">Get the Pivot Decision Framework</h3>' +
        '<p class="pf-modal-body">A short worksheet for the moment you\'re standing at a fork and can\'t tell if it\'s fear or intuition talking. Free, instant download.</p>' +
        '<input type="text" id="pf-exit-name" placeholder="First name">' +
        '<input type="email" id="pf-exit-email" placeholder="Email address">' +
        '<button class="pf-modal-submit" id="pf-exit-submit" onclick="window.__pfSubmitExit()">Send me the framework</button>' +
        '<p class="pf-modal-note">No spam. Unsubscribe anytime.</p>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  function buildStickyBar() {
    var bar = document.createElement('div');
    bar.className = 'pf-sticky';
    bar.id = 'pf-sticky-bar';
    bar.innerHTML =
      '<span>Not ready to book? Get the free Pivot Decision Framework worksheet.</span>' +
      '<a href="resources.html" class="pf-sticky-cta">Get the free worksheet</a>' +
      '<button class="pf-sticky-close" aria-label="Dismiss" onclick="window.__pfCloseSticky()">&times;</button>';
    document.body.appendChild(bar);
  }

  window.__pfCloseExit = function () {
    var el = document.getElementById('pf-exit-overlay');
    if (el) el.classList.remove('open');
  };
  window.__pfCloseSticky = function () {
    var el = document.getElementById('pf-sticky-bar');
    if (el) el.classList.remove('open');
    mark(STICKY_KEY);
  };
  window.__pfSubmitExit = function () {
    var email = document.getElementById('pf-exit-email').value.trim();
    var name = document.getElementById('pf-exit-name').value.trim();
    if (!email || !emailValid(email)) { alert('Please enter a valid email address.'); return; }
    var btn = document.getElementById('pf-exit-submit');
    btn.disabled = true; btn.textContent = 'Sending...';
    submitLead(email, name, 'ExitIntentPopup', 'pivot_framework_exit', function (ok) {
      var a = document.createElement('a');
      a.href = 'pivot-decision-framework.pdf';
      a.download = 'pivot-decision-framework.pdf';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (typeof gtag === 'function') gtag('event', 'lead_capture', { source: 'exit_intent' });
      mark(EXIT_KEY);
      window.__pfCloseExit();
      alert(ok ? 'Sent! Your worksheet is downloading now.' : 'Your worksheet is downloading. Reach out at reasondxcoaching@gmail.com if you don\u2019t see a follow-up email.');
      btn.disabled = false; btn.textContent = 'Send me the framework';
    });
  };

  function initExitIntent() {
    if (daysAgo(EXIT_KEY) < EXIT_DAYS) return;
    buildExitModal();
    var triggered = false;
    document.addEventListener('mouseout', function (e) {
      if (triggered) return;
      if (e.clientY <= 0 && (!e.relatedTarget)) {
        triggered = true;
        document.getElementById('pf-exit-overlay').classList.add('open');
      }
    });
  }

  function initStickyBar() {
    if (daysAgo(STICKY_KEY) < STICKY_DAYS) return;
    buildStickyBar();
    var isPost = !!document.querySelector('article.post-body') || !!document.getElementById('pf-related-posts');
    if (isPost) {
      var shown = false;
      window.addEventListener('scroll', function () {
        if (shown) return;
        var scrollDepth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
        if (scrollDepth >= 0.7) {
          shown = true;
          var el = document.getElementById('pf-sticky-bar');
          if (el) el.classList.add('open');
        }
      });
    } else {
      setTimeout(function () {
        var el = document.getElementById('pf-sticky-bar');
        if (el) el.classList.add('open');
      }, 8000);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectCSS();
    initExitIntent();
    initStickyBar();
  });
})();
