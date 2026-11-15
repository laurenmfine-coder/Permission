/* Site-wide email capture: exit-intent popup, plus a homepage-only
   scroll-triggered newsletter test.
   Posts to /api/subscribe, the site's single Flodesk signup endpoint (same one
   resources.html posts to), tagged with a distinct source per widget so leads
   can be told apart in Flodesk without touching the backend. */
(function () {
  var SIGNUP_ENDPOINT = '/api/subscribe';
  // Physician pages send people to the women-in-medicine group. Every other page
  // sends them to the open group, Make Room For It: Talk It Through.
  var IS_PHYS_PAGE = /physician|non-clinical/.test(window.location.pathname);
  var FB_GROUP_URL = IS_PHYS_PAGE
    ? 'https://www.facebook.com/groups/physicianmomsatacrossroads'
    : 'https://www.facebook.com/groups/permissiontochange';
  var FB_GROUP_BLURB = IS_PHYS_PAGE
    ? 'Physician Women at a Crossroads is a free private group for women in medicine. No coaching pitch, no program, nothing for sale inside it.'
    : 'Make Room For It: Talk It Through is a free private group for anyone who needs a place to think out loud. Leave with your next step. Nothing for sale inside it.';
  var FB_LINK_HTML = '<a class="pf-fb-link" href="' + FB_GROUP_URL + '" target="_blank" rel="noopener">Or join our free Facebook community &rarr;</a>';
  var STICKY_KEY = 'pf_sticky_dismissed';
  var EXIT_KEY = 'pf_exit_seen';
  var NEWSLETTER_KEY = 'pf_newsletter_seen';
  var SESSION_GUARD_KEY = 'pf_popup_shown_session';
  var STICKY_DAYS = 14;
  var EXIT_DAYS = 30;
  var NEWSLETTER_DAYS = 14;

  function daysAgo(key) {
    var v = localStorage.getItem(key);
    if (!v) return Infinity;
    return (Date.now() - parseInt(v, 10)) / 86400000;
  }
  function mark(key) {
    try { localStorage.setItem(key, String(Date.now())); } catch (e) {}
  }
  function popupAlreadyShownThisSession() {
    try { return sessionStorage.getItem(SESSION_GUARD_KEY) === '1'; } catch (e) { return false; }
  }
  function markPopupShownThisSession() {
    try { sessionStorage.setItem(SESSION_GUARD_KEY, '1'); } catch (e) {}
  }
  function emailValid(v) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  }
  function isHomepage() {
    var p = window.location.pathname;
    return p === '/' || p === '' || /\/index\.html$/.test(p);
  }
  function utmNotes() {
    var params = (window.lfParams ? window.lfParams() : new URLSearchParams(window.location.search));
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
    fetch(SIGNUP_ENDPOINT, {
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
    '.pf-modal textarea{width:100%;padding:12px 14px;border:1px solid #E5E0DA;margin-bottom:10px;font-size:0.92rem;font-family:inherit;background:#FFFFFF;min-height:96px;resize:vertical;line-height:1.6;}' +
    '.pf-modal textarea:focus{outline:none;border-color:#23406E;}' +
    '.pf-modal-alt{display:block;margin-top:12px;font-size:0.8rem;color:#8C8580;text-decoration:underline;background:none;border:none;cursor:pointer;font-family:inherit;width:100%;}' +
    '.pf-modal-submit{width:100%;padding:13px;background:#23406E;color:#fff;border:none;font-size:0.9rem;letter-spacing:0.02em;cursor:pointer;font-family:inherit;margin-top:4px;}' +
    '.pf-modal-submit:hover{background:#182D4E;}' +
    '.pf-modal-submit:disabled{opacity:0.6;cursor:default;}' +
    '.pf-modal-note{font-size:0.72rem;color:#8C8580;margin-top:12px;text-align:center;}' +
    '.pf-fb-link{display:block;margin-top:10px;font-size:0.78rem;text-align:center;color:#23406E;text-decoration:underline;text-underline-offset:3px;}' +
    '@media(max-width:640px){.pf-modal{padding:30px 22px;}}';

  var INLINE_CSS =
    '.pf-modal-input{display:block;width:100%;box-sizing:border-box;padding:12px 14px;margin:0 0 10px;border:1px solid #D9D3CC;background:#fff;font-family:inherit;font-size:1rem;color:#1A1A1A;}' +
    '.pf-inline{background:#EDE9E4;border-top:3px solid #B8975A;padding:32px 34px;margin:48px 0;font-family:"DM Sans",sans-serif;}' +
    '.pf-inline-eyebrow{font-size:0.68rem !important;letter-spacing:0.2em;text-transform:uppercase;color:#23406E !important;margin:0 0 10px !important;line-height:1.4 !important;}' +
    '.pf-inline-title{font-family:"Playfair Display",serif;font-size:1.6rem !important;font-weight:400;line-height:1.25 !important;color:#1A1A1A !important;margin:0 0 12px !important;}' +
    '.pf-inline-text{font-size:1rem !important;line-height:1.7 !important;color:#4A4540 !important;margin:0 0 18px !important;}' +
    '.pf-inline form{display:flex;gap:10px;flex-wrap:wrap;}' +
    '.pf-inline input{flex:1 1 180px;min-width:0;padding:13px 14px;border:1px solid #D9D3CC;background:#fff;font-family:inherit;font-size:1rem;color:#1A1A1A;}' +
    '.pf-inline button{padding:13px 22px;background:#23406E;color:#fff;border:0;cursor:pointer;font-family:inherit;font-size:0.7rem;letter-spacing:0.16em;text-transform:uppercase;}' +
    '.pf-inline button:hover{background:#182D4E;}' +
    '.pf-inline-note{font-size:0.85rem !important;color:#6E6863 !important;margin:14px 0 0 !important;line-height:1.6 !important;}' +
    '.pf-inline-note a{color:#23406E !important;}' +
    '.pf-inline-msg{font-size:1rem !important;color:#1A1A1A !important;margin:0 !important;}' +
    '@media (max-width:600px){.pf-inline{padding:26px 22px;}.pf-inline button{width:100%;}}';

  // Inline signup placed partway through article pages. Readers arriving from
  // search get a small next step (a worksheet plus The Sunday Letter) at the
  // moment they are most engaged, plus a quiet link to the free session.
  function inlineOffer() {
    var p = window.location.pathname;
    if (/boundar|say-no|people-pleasing|guilt/.test(p)) {
      return { tool: 'Is This One Worth It?', url: '/worth-it',
        title: 'Not sure this one is worth the fight?',
        text: 'Get the free two-minute worksheet that helps you decide whether to let it go or hold the line, with scripts. Plus The Sunday Letter: one short letter and one tool you can use, every Sunday morning.' };
    }
    if (/mental-load|overwhelm|make-time|make-room|work-life/.test(p)) {
      return { tool: 'The Invisible List', url: '/invisible-list',
        title: 'Get the list out of your head.',
        text: 'Get the free Invisible List worksheet to see everything you are carrying and hand off two things. Plus The Sunday Letter: one short letter and one tool you can use, every Sunday morning.' };
    }
    return { tool: '', url: '',
      title: 'One short letter. One tool you can use.',
      text: 'The Sunday Letter lands Sunday mornings with one essay, one exercise you can actually do, and a few links worth your time. Free.' };
  }

  function initInlineSignup() {
    var art = document.querySelector('article.post-body');
    if (!art || document.querySelector('.pf-inline')) return;
    if (/worth-it|invisible-list|free-session|booking-confirmed|join-emails|template/.test(window.location.pathname)) return;
    var ps = Array.prototype.filter.call(art.children, function (el) { return el.tagName === 'P'; });
    if (ps.length < 6) return;
    var anchor = ps[Math.floor(ps.length * 0.4)];
    var o = inlineOffer();
    var box = document.createElement('aside');
    box.className = 'pf-inline';
    box.setAttribute('aria-label', 'Free worksheet and newsletter signup');
    box.innerHTML =
      '<p class="pf-inline-eyebrow">Free' + (o.tool ? ' worksheet &middot; ' + o.tool : ' &middot; The Sunday Letter') + '</p>' +
      '<p class="pf-inline-title">' + o.title + '</p>' +
      '<p class="pf-inline-text">' + o.text + '</p>' +
      '<form novalidate>' +
        '<input type="text" name="name" placeholder="First name" autocomplete="given-name" aria-label="First name">' +
        '<input type="email" name="email" placeholder="Email" autocomplete="email" aria-label="Email" required>' +
        '<button type="submit">' + (o.tool ? 'Send it to me' : 'Get the letter') + '</button>' +
      '</form>' +
      '<p class="pf-inline-note">Unsubscribe anytime. Rather talk it through? <a href="/free-session?utm_source=site&amp;utm_content=inline_article">Your first coaching session is free</a>.</p>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    var form = box.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim(), name = form.name.value.trim();
      if (!emailValid(email)) { form.email.focus(); form.email.style.borderColor = '#B5654A'; return; }
      form.querySelector('button').disabled = true;
      submitLead(email, name, 'inline_article', 'inline_' + window.location.pathname, function () {
        mark(EXIT_KEY);
        try { if (typeof gtag === 'function') gtag('event', 'generate_lead', { source: 'inline_article', page: window.location.pathname }); } catch (err) {}
        var msg = '<p class="pf-inline-msg"><strong>You are on the list.</strong> The next letter lands Sunday morning.';
        if (o.url) msg += ' <a href="' + o.url + '" style="color:#23406E;">Open ' + o.tool + ' now &rarr;</a>';
        msg += '<br>Want to talk it through? <a href="https://calendly.com/reasondxcoaching/free-session" style="color:#23406E;">Book your free session &rarr;</a>';
        form.outerHTML = msg + '</p>';
      });
    });
    if (typeof gtag === 'function') {
      try {
        var seen = false;
        new IntersectionObserver(function (en, obs) {
          if (!seen && en[0].isIntersecting) { seen = true; gtag('event', 'inline_signup_view', { page: window.location.pathname }); obs.disconnect(); }
        }).observe(box);
      } catch (err) {}
    }
  }

  function injectCSS() {
    if (document.getElementById('pf-widget-style')) return;
    var s = document.createElement('style');
    s.id = 'pf-widget-style';
    s.textContent = CSS + INLINE_CSS;
    document.head.appendChild(s);
  }

  // Exit popup is a single Facebook group invite everywhere it fires. It
  // stays off the pages where interrupting a conversion in progress would
  // hurt (free-session, booking-confirmed, quiz).
  function exitVariant() {
    var p = window.location.pathname;
    if (/\/(free-session|booking-confirmed|quiz)(\.html)?$/.test(p)) return null; // never interrupt a conversion
    return 'sunday_letter';
  }

  function buildExitModal() {
    var overlay = document.createElement('div');
    overlay.className = 'pf-overlay';
    overlay.id = 'pf-exit-overlay';
    overlay.innerHTML =
      '<div class="pf-modal" role="dialog" aria-modal="true" aria-labelledby="pf-exit-title">' +
        '<button class="pf-modal-close" aria-label="Close" onclick="window.__pfCloseExit()">&times;</button>' +
        '<p class="pf-modal-eyebrow">Before you go &middot; The Sunday Letter</p>' +
        '<h3 class="pf-modal-title" id="pf-exit-title">One short letter. One tool you can use.</h3>' +
        '<p class="pf-modal-body">Every Sunday morning: one essay, one exercise you can actually do that week, and a few links worth your time. Free.</p>' +
        '<form id="pf-exit-form" novalidate>' +
          '<input class="pf-modal-input" type="text" name="name" placeholder="First name" autocomplete="given-name" aria-label="First name">' +
          '<input class="pf-modal-input" type="email" name="email" placeholder="Email" autocomplete="email" aria-label="Email" required>' +
          '<button class="pf-modal-submit" type="submit" style="width:100%;">Send me the Sunday Letter</button>' +
        '</form>' +
        '<p class="pf-modal-note">Unsubscribe anytime. ' + FB_LINK_HTML + '</p>' +
      '</div>';
    document.body.appendChild(overlay);
    var form = overlay.querySelector('#pf-exit-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim(), name = form.name.value.trim();
      if (!emailValid(email)) { form.email.focus(); form.email.style.borderColor = '#B5654A'; return; }
      form.querySelector('button').disabled = true;
      submitLead(email, name, 'exit_popup', 'exit_popup_sunday_letter', function () {
        mark(EXIT_KEY);
        try { if (typeof gtag === 'function') gtag('event', 'generate_lead', { source: 'exit_popup', page: window.location.pathname }); } catch (err) {}
        form.outerHTML = '<p class="pf-modal-body"><strong>You are on the list.</strong> The next letter lands Sunday morning.</p><a class="pf-modal-submit" href="https://calendly.com/reasondxcoaching/free-session" style="display:block;text-align:center;text-decoration:none;">Book your free session</a>';
      });
    });
  }

  function buildNewsletterModal() {
    var overlay = document.createElement('div');
    overlay.className = 'pf-overlay';
    overlay.id = 'pf-newsletter-overlay';
    overlay.innerHTML =
      '<div class="pf-modal">' +
        '<button class="pf-modal-close" aria-label="Close" onclick="window.__pfCloseNewsletter()">&times;</button>' +
        '<p class="pf-modal-eyebrow">Permission to Change</p>' +
        '<h3 class="pf-modal-title">Let\'s talk, or join the conversation.</h3>' +
        '<p class="pf-modal-body">A free 55-minute coaching session is the easiest way to see if this is a fit. Or, if you\'re not ready for that yet, join a free community of people working through the same questions.</p>' +
        '<a class="pf-modal-submit" href="free-session.html" style="display:block;text-align:center;text-decoration:none;margin-bottom:10px;" onclick="window.__pfNewsletterCtaClick(\'booking\')">Book a Free Coaching Session</a>' +
        '<a class="pf-modal-submit" href="' + FB_GROUP_URL + '" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none;background:#fff;color:#23406E;border:1px solid #23406E;" onclick="window.__pfNewsletterCtaClick(\'facebook\')">Join the Free Facebook Group</a>' +
        '<p class="pf-modal-note" style="margin-top:14px;">Not ready for either? <a href="resources.html" style="color:#8C8580;text-decoration:underline;">Grab the free Pivot Decision Framework worksheet</a> instead.</p>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  window.__pfCloseExit = function () {
    var el = document.getElementById('pf-exit-overlay');
    if (el) el.classList.remove('open');
  };
  window.__pfCloseNewsletter = function () {
    var el = document.getElementById('pf-newsletter-overlay');
    if (el) el.classList.remove('open');
    mark(NEWSLETTER_KEY);
  };
  window.__pfExitFbClick = function () {
    mark(EXIT_KEY);
    if (typeof gtag === 'function') {
      gtag('event', 'exit_popup_click', { variant: 'facebook', page: window.location.pathname });
    }
  };
  window.__pfNewsletterCtaClick = function (which) {
    mark(NEWSLETTER_KEY);
    if (typeof gtag === 'function') {
      gtag('event', 'newsletter_popup_click', { variant: which, page: window.location.pathname });
    }
  };

  function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function initExitIntent() {
    // Desktop only. On phones the old "fast upward flick" trigger misfired
    // during ordinary reading and covered content, so touch devices never
    // see this popup.
    if (isTouchDevice()) return;
    if (daysAgo(EXIT_KEY) < EXIT_DAYS) return;
    var variant = exitVariant();
    if (!variant) return;
    buildExitModal();
    var triggered = false;

    function fire() {
      if (triggered || popupAlreadyShownThisSession()) return;
      triggered = true;
      markPopupShownThisSession();
      document.getElementById('pf-exit-overlay').classList.add('open');
      // Without a "shown" count there is no denominator, so there was
      // previously no way to tell whether this converts at 1% or 20%.
      if (typeof gtag === 'function') {
        gtag('event', 'exit_popup_shown', { variant: 'sunday_letter', page: window.location.pathname });
      }
    }

    // Desktop: cursor leaving through the top of the browser chrome.
    document.addEventListener('mouseout', function (e) {
      if (e.clientY <= 0 && (!e.relatedTarget)) fire();
    });
  }

  // True when a "book a free session" call to action is currently on screen.
  // The nav CTA is excluded: it is sticky, so it is always in view and would
  // suppress the popup permanently.
  function bookingCtaInView() {
    var ctas = document.querySelectorAll('a[href*="free-session"]');
    for (var i = 0; i < ctas.length; i++) {
      if (ctas[i].classList.contains('nav-cta')) continue;
      var r = ctas[i].getBoundingClientRect();
      if (r.height > 0 && r.top < window.innerHeight && r.bottom > 0) return true;
    }
    return false;
  }

  // Homepage-only: newsletter modal fires on a timer or scroll depth,
  // whichever comes first. Shares the same one-popup-per-session guard as
  // exit-intent, so a visitor never sees both in one visit. Suppressed for
  // 14 days once seen, dismissed or not.
  //
  // The modal never opens while a booking CTA is on screen. The old 13s timer
  // routinely fired just as the reader reached "Book a free coaching session"
  // and covered it, interrupting people at the exact moment of intent. When a
  // trigger lands during that window the popup is deferred and retried rather
  // than cancelled, so lead capture still happens once the CTA scrolls away.
  function initNewsletterTest() {
    if (!isHomepage()) return;
    if (daysAgo(NEWSLETTER_KEY) < NEWSLETTER_DAYS) return;
    buildNewsletterModal();
    var triggered = false;
    var pendingType = null;
    var retryId = null;

    function open(triggerType) {
      triggered = true;
      markPopupShownThisSession();
      mark(NEWSLETTER_KEY);
      document.getElementById('pf-newsletter-overlay').classList.add('open');
      if (typeof gtag === 'function') gtag('event', 'newsletter_popup_shown', { source: 'homepage_' + triggerType });
    }

    function fire(triggerType) {
      if (triggered || popupAlreadyShownThisSession()) return;
      if (bookingCtaInView()) {
        // Hold it. Re-check shortly; the reader is looking at the CTA.
        pendingType = pendingType || triggerType;
        if (retryId === null) {
          retryId = setInterval(function () {
            if (triggered || popupAlreadyShownThisSession()) { clearInterval(retryId); retryId = null; return; }
            if (!bookingCtaInView()) {
              clearInterval(retryId); retryId = null;
              open(pendingType || 'deferred');
            }
          }, 2000);
        }
        return;
      }
      open(triggerType);
    }

    var timerId = setTimeout(function () { fire('timer'); }, 45000);
    window.addEventListener('scroll', function () {
      var scrollDepth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrollDepth >= 0.55) {
        clearTimeout(timerId);
        fire('scroll');
      }
    });
  }

  function initStickyBar() {
    // Removed site-wide: risked surfacing "not ready to book?" language next to
    // trust-building content (e.g. the certification FAQ), which read as the
    // site echoing doubt back at the reader. Exit-intent popup remains as the
    // passive-capture mechanism instead.
  }


  // Count every click that leads to the Facebook group, on any page, unless
  // the link already reports itself through trackGroupJoin().
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="physicianmomsatacrossroads"], a[href*="groups/permissiontochange"]') : null;
    if (!a || typeof gtag !== 'function') return;
    if ((a.getAttribute('onclick') || '').indexOf('trackGroupJoin') !== -1) return;
    var grp = a.href.indexOf('physicianmomsatacrossroads') !== -1 ? 'physician-women-at-a-crossroads' : 'make-room-for-it';
    gtag('event', 'group_join_click', { group: grp, source: window.location.pathname });
  }, true);

  document.addEventListener('DOMContentLoaded', function () {
    injectCSS();
    initExitIntent();
    // Homepage timed modal disabled: the homepage hero now carries an inline
    // Sunday Letter signup next to the booking CTA, so a timed popup only
    // interrupts. initNewsletterTest() is left defined but is not called.
    initStickyBar();
    initInlineSignup();
  });
})();
