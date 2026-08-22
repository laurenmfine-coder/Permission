/* Homepage entry gate.
   Shows once per visitor (first visit only, tracked permanently in
   localStorage) on the homepage. The visitor must pick one option to close
   it: Substack, occasional email updates (via the existing Loops endpoint),
   or an Instagram follow. The follow option requires no typing at all, so
   it's the lowest-friction path to "just see what's here."
   The page content underneath is never hidden or blocked; this is a
   dismissible overlay only, so search engines and ad-traffic landing pages
   still render full content regardless of gate state.

   IMPORTANT: a large share of traffic here arrives via Instagram ads, which
   open inside Instagram's own in-app browser (a WebView), not Safari or
   Chrome. That WebView has well-documented bugs with position:fixed
   overlays: they can fail to render, freeze, or only appear after the user
   scrolls. Rather than fight that, this script detects Instagram/Facebook's
   in-app browser and renders the gate as a normal in-flow, non-fixed block
   inserted at the top of the page in that case, which sidesteps the bug
   entirely. Regular browsers still get the floating overlay. */
(function () {
  var GATE_SEEN_KEY = 'pf_entry_gate_seen';
  var SESSION_GUARD_KEY = 'pf_popup_shown_session'; // shared key w/ capture-widgets.js
  var LOOPS_ENDPOINT = 'https://app.loops.so/api/newsletter-form/cmr88hbdk18uj0j409a54v49f';
  var SUBSTACK_URL = 'https://permissiontochange.substack.com/subscribe';
  var INSTAGRAM_URL = 'https://www.instagram.com/permission_to_change/';

  function isHomepage() {
    var p = window.location.pathname;
    return p === '/' || p === '' || /\/index\.html$/.test(p);
  }
  function emailValid(v) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  }
  function isInAppBrowser() {
    var ua = navigator.userAgent || '';
    // Instagram, Facebook, and Messenger in-app WebViews all self-identify
    // in the UA string. FBAN/FBAV cover Facebook & Messenger; "Instagram"
    // covers Instagram directly.
    return /Instagram|FBAN|FBAV/i.test(ua);
  }
  function markSeen() {
    try { localStorage.setItem(GATE_SEEN_KEY, '1'); } catch (e) {}
    try { sessionStorage.setItem(SESSION_GUARD_KEY, '1'); } catch (e) {}
  }
  function alreadySeen() {
    try { return localStorage.getItem(GATE_SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  var SHARED_CSS =
    '.pf-gate-modal{background:#FFFFFF;max-width:480px;width:100%;padding:40px 32px;font-family:inherit;}' +
    '.pf-gate-eyebrow{font-size:0.7rem;letter-spacing:0.16em;text-transform:uppercase;color:#B8975A;font-weight:600;margin-bottom:12px;}' +
    '.pf-gate-title{font-size:1.5rem;line-height:1.25;margin-bottom:10px;color:#1A1A1A;font-weight:600;font-family:"Playfair Display",serif;}' +
    '.pf-gate-body{font-size:0.9rem;line-height:1.6;color:#5A5450;margin-bottom:24px;}' +
    '.pf-gate-option{display:block;width:100%;text-align:left;border:1px solid #E5E0DA;background:#FFFFFF;padding:16px 18px;margin-bottom:12px;cursor:pointer;font-family:inherit;transition:border-color 0.2s,background 0.2s;-webkit-tap-highlight-color:rgba(35,64,110,0.15);}' +
    '.pf-gate-option:hover{border-color:#23406E;background:#FAF8F6;}' +
    '.pf-gate-option-title{font-size:0.9rem;font-weight:600;color:#1A1A1A;margin-bottom:3px;}' +
    '.pf-gate-option-sub{font-size:0.78rem;color:#8C8580;font-weight:400;}' +
    '.pf-gate-email-row{display:none;margin-top:12px;gap:8px;}' +
    '.pf-gate-email-row.open{display:flex;}' +
    '.pf-gate-email-row input{flex:1;padding:11px 12px;border:1px solid #E5E0DA;font-size:16px;font-family:inherit;}' + // 16px avoids iOS auto-zoom on focus
    '.pf-gate-email-row input:focus{outline:none;border-color:#23406E;}' +
    '.pf-gate-email-row button{padding:11px 16px;background:#23406E;color:#fff;border:none;font-size:0.82rem;cursor:pointer;font-family:inherit;white-space:nowrap;}' +
    '.pf-gate-email-row button:hover{background:#182D4E;}' +
    '.pf-gate-email-row button:disabled{opacity:0.6;cursor:default;}' +
    '.pf-gate-note{font-size:0.72rem;color:#8C8580;text-align:center;margin-top:14px;}' +
    '@media(max-width:480px){.pf-gate-modal{padding:30px 22px;}}';

  // Floating-overlay variant: used for normal browsers (Safari, Chrome, etc.)
  var OVERLAY_CSS =
    '.pf-gate-overlay{position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(26,26,26,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity 0.35s ease;-webkit-overflow-scrolling:touch;overflow-y:auto;}' +
    '.pf-gate-overlay.open{opacity:1;pointer-events:auto;}' +
    '.pf-gate-overlay .pf-gate-modal{box-shadow:0 24px 70px rgba(0,0,0,0.3);}';

  // In-flow variant: used inside Instagram/Facebook's in-app browser, where
  // position:fixed overlays are unreliable. This renders as a normal block
  // at the very top of <body>, pushing page content below it, then removes
  // itself entirely once the visitor picks an option.
  var INFLOW_CSS =
    '.pf-gate-inflow{width:100%;background:#FFFFFF;display:flex;align-items:center;justify-content:center;padding:32px 16px;border-bottom:4px solid #23406E;box-sizing:border-box;}' +
    '.pf-gate-inflow .pf-gate-modal{padding:8px 4px 0;max-width:520px;}';

  function injectCSS() {
    if (document.getElementById('pf-gate-style')) return;
    var s = document.createElement('style');
    s.id = 'pf-gate-style';
    s.textContent = SHARED_CSS + OVERLAY_CSS + INFLOW_CSS;
    document.head.appendChild(s);
  }

  function gateInnerHTML() {
    return (
      '<p class="pf-gate-eyebrow">Permission to Change</p>' +
      '<h3 class="pf-gate-title">Before you look around</h3>' +
      '<p class="pf-gate-body">Pick whichever fits, even just a follow works. It just helps me know you found your way here.</p>' +
      '<button class="pf-gate-option" id="pf-gate-instagram">' +
        '<div class="pf-gate-option-title">Follow on Instagram</div>' +
        '<div class="pf-gate-option-sub">Fastest option, no email needed</div>' +
      '</button>' +
      '<button class="pf-gate-option" id="pf-gate-substack">' +
        '<div class="pf-gate-option-title">Read the Substack</div>' +
        '<div class="pf-gate-option-sub">Permission to Change, in your inbox</div>' +
      '</button>' +
      '<button class="pf-gate-option" id="pf-gate-email-toggle">' +
        '<div class="pf-gate-option-title">Get occasional email updates</div>' +
        '<div class="pf-gate-option-sub">A few notes a month, nothing more</div>' +
        '<div class="pf-gate-email-row" id="pf-gate-email-row">' +
          '<input type="email" id="pf-gate-email-input" placeholder="Email address" onclick="event.stopPropagation()">' +
          '<button type="button" id="pf-gate-email-submit">Join</button>' +
        '</div>' +
      '</button>' +
      '<p class="pf-gate-note">You can always find these links again in the footer.</p>'
    );
  }

  function submitGateEmail(onClose) {
    var input = document.getElementById('pf-gate-email-input');
    var btn = document.getElementById('pf-gate-email-submit');
    var email = input.value.trim();
    if (!email || !emailValid(email)) {
      input.style.borderColor = '#B8975A';
      input.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Joining...';
    var formBody = 'firstName=' + encodeURIComponent('') +
      '&email=' + encodeURIComponent(email) +
      '&source=' + encodeURIComponent('EntryGate') +
      '&userGroup=' + encodeURIComponent('CoachingLead') +
      '&leadStage=' + encodeURIComponent('entry_gate_updates') +
      '&notes=' + encodeURIComponent('referrer=' + (document.referrer || ''));
    fetch(LOOPS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody
    }).then(function () {
      if (typeof gtag === 'function') gtag('event', 'lead_capture', { source: 'entry_gate_email' });
      onClose();
    }).catch(function () {
      onClose();
    });
  }

  function wireUpGate(root, onClose) {
    root.querySelector('#pf-gate-instagram').addEventListener('click', function () {
      window.open(INSTAGRAM_URL, '_blank', 'noopener');
      onClose();
    });
    root.querySelector('#pf-gate-substack').addEventListener('click', function () {
      window.open(SUBSTACK_URL, '_blank', 'noopener');
      onClose();
    });
    root.querySelector('#pf-gate-email-toggle').addEventListener('click', function (e) {
      if (e.target.closest('.pf-gate-email-row')) return; // let inner clicks pass through
      root.querySelector('#pf-gate-email-row').classList.add('open');
      root.querySelector('#pf-gate-email-input').focus();
    });
    root.querySelector('#pf-gate-email-submit').addEventListener('click', function (e) {
      e.stopPropagation();
      submitGateEmail(onClose);
    });
    root.querySelector('#pf-gate-email-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.stopPropagation(); submitGateEmail(onClose); }
    });
  }

  function buildOverlayGate() {
    var overlay = document.createElement('div');
    overlay.className = 'pf-gate-overlay';
    overlay.id = 'pf-gate-overlay';
    overlay.innerHTML = '<div class="pf-gate-modal">' + gateInnerHTML() + '</div>';
    document.body.appendChild(overlay);
    wireUpGate(overlay, function () {
      overlay.classList.remove('open');
      markSeen();
    });
    setTimeout(function () { overlay.classList.add('open'); }, 250);
  }

  function buildInFlowGate() {
    var block = document.createElement('div');
    block.className = 'pf-gate-inflow';
    block.id = 'pf-gate-inflow';
    block.innerHTML = '<div class="pf-gate-modal">' + gateInnerHTML() + '</div>';
    // Insert as the very first element in <body> so it's the first thing
    // rendered, pushing the rest of the page down. No fixed positioning
    // involved, so it can't hit the WebView overlay bug.
    document.body.insertBefore(block, document.body.firstChild);
    wireUpGate(block, function () {
      block.remove();
      markSeen();
      window.scrollTo(0, 0);
    });
  }

  function init() {
    if (!isHomepage()) return;
    if (alreadySeen()) return;
    injectCSS();
    if (isInAppBrowser()) {
      buildInFlowGate();
    } else {
      buildOverlayGate();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

