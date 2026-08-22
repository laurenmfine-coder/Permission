/* Site-wide email capture: exit-intent popup, plus a homepage-only
   scroll-triggered newsletter test.
   Reuses the existing Loops newsletter-form endpoint (same one resources.html
   already posts to), tagged with a distinct source per widget so leads can be
   segmented in Loops without touching the backend. */
(function () {
  var LOOPS_ENDPOINT = 'https://app.loops.so/api/newsletter-form/cmr88hbdk18uj0j409a54v49f';
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
    '.pf-modal textarea{width:100%;padding:12px 14px;border:1px solid #E5E0DA;margin-bottom:10px;font-size:0.92rem;font-family:inherit;background:#FFFFFF;min-height:96px;resize:vertical;line-height:1.6;}' +
    '.pf-modal textarea:focus{outline:none;border-color:#23406E;}' +
    '.pf-modal-alt{display:block;margin-top:12px;font-size:0.8rem;color:#8C8580;text-decoration:underline;background:none;border:none;cursor:pointer;font-family:inherit;width:100%;}' +
    '.pf-modal-submit{width:100%;padding:13px;background:#23406E;color:#fff;border:none;font-size:0.9rem;letter-spacing:0.02em;cursor:pointer;font-family:inherit;margin-top:4px;}' +
    '.pf-modal-submit:hover{background:#182D4E;}' +
    '.pf-modal-submit:disabled{opacity:0.6;cursor:default;}' +
    '.pf-modal-note{font-size:0.72rem;color:#8C8580;margin-top:12px;text-align:center;}' +
    '@media(max-width:640px){.pf-modal{padding:30px 22px;}}';

  function injectCSS() {
    if (document.getElementById('pf-widget-style')) return;
    var s = document.createElement('style');
    s.id = 'pf-widget-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Which exit offer suits this page.
  //
  // One offer across every page was the flaw in the previous version: someone
  // who has been on a blog post for eleven seconds was asked for an email, the
  // same ask made of someone who had just read the pricing. An exit offer has
  // to be smaller than the thing the person is already walking away from, so
  // the cold pages now ask for nothing at all.
  function exitVariant() {
    var p = window.location.pathname;
    if (/\/(free-session|booking-confirmed|quiz)\.html$/.test(p)) return null; // never interrupt a conversion
    if (/\/resources\.html$/.test(p)) return 'worksheet';                       // came for downloads: fair trade
    if (/\/(coaching|career-reinvention|physician-coaching|ikigai-coaching)\.html$/.test(p)) return 'question';
    return 'quiz';                                                             // cold or browsing: no email
  }

  var EXIT_CONTENT = {
    quiz: {
      eyebrow: 'Before you go',
      title: 'Which path fits where you are?',
      body: 'Three questions, two minutes, no email. You get a straight read on whether you need a focused sprint, sustained support, or a full redesign of what is next.',
      cta: 'Take the two-minute quiz'
    },
    question: {
      eyebrow: 'Before you go',
      title: 'What is the thing you did not ask?',
      body: 'No email needed and no follow-up. If something here left you with a question, ask it &mdash; anonymously is fine.',
      cta: 'Send it'
    },
    worksheet: {
      eyebrow: 'Before you go',
      title: 'Get the Pivot Decision Framework',
      body: 'A short worksheet for the moment you are standing at a fork and cannot tell if it is fear or intuition talking. Free, instant download.',
      cta: 'Send me the framework'
    }
  };

  function buildExitModal(variant) {
    var c = EXIT_CONTENT[variant];
    var fields;
    if (variant === 'quiz') {
      fields =
        '<a class="pf-modal-submit" id="pf-exit-submit" href="quiz.html" ' +
          'style="display:block;text-align:center;text-decoration:none;" ' +
          'onclick="window.__pfExitQuizClick()">' + c.cta + '</a>' +
        '<p class="pf-modal-note">No email, no sign-up. It just tells you where to start.</p>';
    } else if (variant === 'question') {
      fields =
        '<textarea id="pf-exit-question" placeholder="What are you actually trying to figure out?"></textarea>' +
        '<input type="email" id="pf-exit-email" placeholder="Email (optional, only if you want a reply)">' +
        '<button class="pf-modal-submit" id="pf-exit-submit" onclick="window.__pfSubmitExitQuestion()">' + c.cta + '</button>' +
        '<p class="pf-modal-note">Leave the email blank and it stays anonymous. I read every one.</p>';
    } else {
      fields =
        '<input type="text" id="pf-exit-name" placeholder="First name">' +
        '<input type="email" id="pf-exit-email" placeholder="Email address">' +
        '<button class="pf-modal-submit" id="pf-exit-submit" onclick="window.__pfSubmitExit()">' + c.cta + '</button>' +
        '<p class="pf-modal-note">No spam. Unsubscribe anytime.</p>';
    }

    var overlay = document.createElement('div');
    overlay.className = 'pf-overlay';
    overlay.id = 'pf-exit-overlay';
    overlay.setAttribute('data-variant', variant);
    overlay.innerHTML =
      '<div class="pf-modal">' +
        '<button class="pf-modal-close" aria-label="Close" onclick="window.__pfCloseExit()">&times;</button>' +
        '<p class="pf-modal-eyebrow">' + c.eyebrow + '</p>' +
        '<h3 class="pf-modal-title">' + c.title + '</h3>' +
        '<p class="pf-modal-body">' + c.body + '</p>' +
        fields +
      '</div>';
    document.body.appendChild(overlay);
  }

  function buildNewsletterModal() {
    var overlay = document.createElement('div');
    overlay.className = 'pf-overlay';
    overlay.id = 'pf-newsletter-overlay';
    overlay.innerHTML =
      '<div class="pf-modal">' +
        '<button class="pf-modal-close" aria-label="Close" onclick="window.__pfCloseNewsletter()">&times;</button>' +
        '<p class="pf-modal-eyebrow">Permission to Change</p>' +
        '<h3 class="pf-modal-title">Get the Pivot Decision Framework</h3>' +
        '<p class="pf-modal-body">A short worksheet for the moment you\'re standing at a fork and can\'t tell if it\'s fear or intuition talking. Free, instant download, plus occasional notes when there\'s something worth saying.</p>' +
        '<input type="text" id="pf-newsletter-name" placeholder="First name">' +
        '<input type="email" id="pf-newsletter-email" placeholder="Email address">' +
        '<button class="pf-modal-submit" id="pf-newsletter-submit" onclick="window.__pfSubmitNewsletter()">Send me the framework</button>' +
        '<p class="pf-modal-note">No spam. Unsubscribe anytime.</p>' +
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
  window.__pfExitQuizClick = function () {
    mark(EXIT_KEY);
    if (typeof gtag === 'function') {
      gtag('event', 'exit_popup_click', { variant: 'quiz', page: window.location.pathname });
    }
  };
  window.__pfSubmitExitQuestion = function () {
    var q = document.getElementById('pf-exit-question').value.trim();
    var email = document.getElementById('pf-exit-email').value.trim();
    if (q.length < 10) { alert('Could you add a little more? A sentence is plenty.'); return; }
    if (email && !emailValid(email)) { alert('That email address does not look right. You can also leave it blank.'); return; }
    var btn = document.getElementById('pf-exit-submit');
    btn.disabled = true; btn.textContent = 'Sending...';
    fetch('/api/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q,
        email: email,
        publishOk: false,
        source: 'exit_intent',
        context: document.title,
        elapsedMs: 99999
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (out) {
        if (!res.ok) throw new Error(out.error || 'Something went wrong on my end.');
      });
    }).then(function () {
      mark(EXIT_KEY);
      if (typeof gtag === 'function') {
        gtag('event', 'question_submitted', {
          has_email: email ? 'yes' : 'no', publish_ok: 'no', source: 'exit_intent'
        });
      }
      window.__pfCloseExit();
      alert(email
        ? 'Got it. I read these myself and I\u2019ll come back to you at that address.'
        : 'Got it. You asked anonymously so I cannot reply, but it is read.');
    }).catch(function (err) {
      alert(err.message || 'That did not go through. You can email me at reasondxcoaching@gmail.com.');
    }).then(function () {
      btn.disabled = false; btn.textContent = 'Send it';
    });
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
  window.__pfSubmitNewsletter = function () {
    var email = document.getElementById('pf-newsletter-email').value.trim();
    var name = document.getElementById('pf-newsletter-name').value.trim();
    if (!email || !emailValid(email)) { alert('Please enter a valid email address.'); return; }
    var btn = document.getElementById('pf-newsletter-submit');
    btn.disabled = true; btn.textContent = 'Sending...';
    submitLead(email, name, 'HomepagePopup', 'pivot_framework_homepage', function (ok) {
      var a = document.createElement('a');
      a.href = 'pivot-decision-framework.pdf';
      a.download = 'pivot-decision-framework.pdf';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (typeof gtag === 'function') gtag('event', 'lead_capture', { source: 'homepage_popup' });
      window.__pfCloseNewsletter();
      alert(ok ? 'Sent! Your worksheet is downloading now.' : 'Your worksheet is downloading. Reach out at reasondxcoaching@gmail.com if you don\u2019t see a follow-up email.');
      btn.disabled = false; btn.textContent = 'Send me the framework';
    });
  };

  function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  function initExitIntent() {
    if (daysAgo(EXIT_KEY) < EXIT_DAYS) return;
    var variant = exitVariant();
    if (!variant) return;
    buildExitModal(variant);
    var triggered = false;

    function fire() {
      if (triggered || popupAlreadyShownThisSession()) return;
      triggered = true;
      markPopupShownThisSession();
      document.getElementById('pf-exit-overlay').classList.add('open');
      // Without a "shown" count there is no denominator, so there was
      // previously no way to tell whether this converts at 1% or 20%.
      if (typeof gtag === 'function') {
        gtag('event', 'exit_popup_shown', { variant: variant, page: window.location.pathname });
      }
    }

    // Desktop: cursor leaving through the top of the browser chrome.
    document.addEventListener('mouseout', function (e) {
      if (e.clientY <= 0 && (!e.relatedTarget)) fire();
    });

    // Mobile: there's no cursor to track leaving the viewport, so a fast
    // upward scroll back toward the top, after the visitor has actually
    // scrolled down and engaged with the page, is the closest real-world
    // analog to "about to leave." Reaching for the URL bar, the back
    // button, or the tab switcher all start with this same motion.
    if (isTouchDevice()) {
      var lastY = window.scrollY;
      var lastT = Date.now();
      var maxScrolled = window.scrollY;
      var ticking = false;

      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          var t = Date.now();
          var dt = Math.max(t - lastT, 1);
          var dy = y - lastY; // negative = scrolling up
          var speed = -dy / dt; // px per ms, positive when scrolling up fast

          if (y > maxScrolled) maxScrolled = y;

          // Require: engaged (scrolled down at least ~250px at some point),
          // currently near the top (within ~180px), and moving up fast
          // (roughly a 300px+ upward flick in well under a second).
          if (maxScrolled > 250 && y < 180 && speed > 0.9) {
            fire();
          }

          lastY = y;
          lastT = t;
          ticking = false;
        });
      }, { passive: true });
    }
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

  document.addEventListener('DOMContentLoaded', function () {
    injectCSS();
    initExitIntent();
    initNewsletterTest();
    initStickyBar();
  });
})();
