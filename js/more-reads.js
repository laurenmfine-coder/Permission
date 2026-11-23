/* "You might also like" slide-in card.
   Shows 3 related pages in a small corner card (not a blocking popup) once a
   reader is halfway down a page. Once per browser session, and it stays away
   for 3 days after someone closes it. Black Friday picks drop out on their own
   after Cyber Monday. Clicks are sent to GA as more_reads_click. */
(function () {
  var BF_END = Date.UTC(2026, 11, 2, 5, 0, 0); // Dec 2, 2026, 12:00 AM Eastern
  var BF_LIVE = Date.now() < BF_END;
  var SKIP = /^\/(index)?$|\/(deals|thank-you|gift-thank-you|booking-confirmed|join-emails|friday-finds-stop|post-template|sunday-letter-template)(\.html)?$/;
  var SEEN_KEY = 'lf_more_reads_session';
  var CLOSED_KEY = 'lf_more_reads_closed';
  var CLOSED_DAYS = 3;

  var P = {
    'black-friday-2026': ['Black Friday 2026: every sale, checked by hand', 1],
    'gifts-for-someone-who-has-everything': ['Gifts for someone who has everything', 0],
    'home-coffee-bar-ideas': ['Coffee bar ideas for small spaces and every budget', 0],
    'best-organic-sheets-and-bedding': ['The best organic sheets and bedding', 0],
    'work-life-balance-goals': ['Work-life balance goals for 2027', 0],
    'new-years-resolutions-boundaries': ['New Year’s resolutions that are really boundaries', 0],
    'stop-doing-list': ['The stop-doing list: an anti-resolution', 0],
    'how-to-keep-new-years-resolutions': ['How to keep your New Year’s resolutions', 0],
    'boll-and-branch-black-friday': ['Boll & Branch Black Friday: 25% off $200+', 1],
    'brooklinen-black-friday': ['Brooklinen Black Friday: 25% off sitewide', 1],
    'ember-black-friday': ['Ember Black Friday: 30% off the Ember Mug', 1],
    'solawave-black-friday': ['Solawave Black Friday: buy one, get one free', 1],
    'vetted-dermlab-black-friday': ['Vetted Dermlab Black Friday: 25% off', 1],
    'first-aid-beauty-black-friday': ['First Aid Beauty Black Friday: 30% off', 1],
    'meaningful-beauty-black-friday': ['Meaningful Beauty Black Friday: 30% off', 1],
    'best-skin-care-for-sensitive-skin': ['The best skin care for sensitive skin', 0],
    'allergy-proof-bedroom': ['How to allergy-proof your bedroom', 0],
    'quiet-morning-coffee-setup': ['A quiet morning coffee setup', 0]
  };

  var CLUSTERS = [
    [/black-friday|discount-code|promo-code|gift|holiday/, ['black-friday-2026', 'gifts-for-someone-who-has-everything', 'home-coffee-bar-ideas', 'best-organic-sheets-and-bedding']],
    [/bed|sleep|dust|allergy-home|guest-room|laundry|dryer|coffee|clean|dish-soap|pajama|grove/, ['best-organic-sheets-and-bedding', 'home-coffee-bar-ideas', 'boll-and-branch-black-friday', 'brooklinen-black-friday', 'ember-black-friday', 'allergy-proof-bedroom']],
    [/skin|clinique|origins|naturium|mascara|perfume|earring|hypoallergenic|beauty|solawave|vetted|mutha/, ['solawave-black-friday', 'vetted-dermlab-black-friday', 'first-aid-beauty-black-friday', 'meaningful-beauty-black-friday', 'best-skin-care-for-sensitive-skin', 'gifts-for-someone-who-has-everything']]
  ];
  var DEFAULT = ['work-life-balance-goals', 'new-years-resolutions-boundaries', 'stop-doing-list', 'how-to-keep-new-years-resolutions', 'gifts-for-someone-who-has-everything'];
  var FALLBACK = ['gifts-for-someone-who-has-everything', 'home-coffee-bar-ideas', 'best-organic-sheets-and-bedding', 'work-life-balance-goals', 'stop-doing-list'];

  var path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  var slug = path.split('/').pop();
  if (SKIP.test(window.location.pathname) || !slug) return;

  function get(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function set(store, key, v) { try { window[store].setItem(key, v); } catch (e) {} }
  if (get('sessionStorage', SEEN_KEY)) return;
  var closed = parseInt(get('localStorage', CLOSED_KEY) || '0', 10);
  if (closed && (Date.now() - closed) / 86400000 < CLOSED_DAYS) return;

  function picks() {
    var list = DEFAULT;
    for (var i = 0; i < CLUSTERS.length; i++) {
      if (CLUSTERS[i][0].test(slug)) { list = CLUSTERS[i][1]; break; }
    }
    var out = [];
    list.concat(FALLBACK).forEach(function (s) {
      if (out.length >= 3 || s === slug || out.indexOf(s) !== -1 || !P[s]) return;
      if (P[s][1] && !BF_LIVE) return;
      out.push(s);
    });
    return out;
  }

  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function show() {
    if (shown) return;
    var m = document.querySelector('.pf-modal');
    if (m && m.offsetParent !== null) { setTimeout(show, 15000); return; }
    shown = true;
    var items = picks();
    if (!items.length) return;
    set('sessionStorage', SEEN_KEY, '1');

    var css = document.createElement('style');
    css.textContent =
      '.lf-mr{position:fixed;right:20px;bottom:20px;z-index:950;width:320px;max-width:calc(100vw - 32px);background:#fff;border:1px solid #EDE9E4;box-shadow:0 12px 40px rgba(0,0,0,0.16);padding:20px 22px 14px;font-family:inherit;transform:translateY(20px);opacity:0;transition:transform .35s ease,opacity .35s ease;}' +
      '.lf-mr.on{transform:none;opacity:1;}' +
      '.lf-mr-eyebrow{font-size:0.7rem;letter-spacing:0.14em;text-transform:uppercase;color:#B8975A;font-weight:600;margin:0 0 10px;}' +
      '.lf-mr ul{list-style:none;margin:0;padding:0;}' +
      '.lf-mr li{border-top:1px solid #F1EDE8;}' +
      '.lf-mr li:first-child{border-top:none;}' +
      '.lf-mr a{display:block;padding:10px 0;color:#1A1A1A;text-decoration:none;font-size:0.93rem;line-height:1.4;}' +
      '.lf-mr a:hover{color:#23406E;text-decoration:underline;}' +
      '.lf-mr-x{position:absolute;top:8px;right:10px;background:none;border:none;font-size:1.3rem;line-height:1;color:#8C8580;cursor:pointer;padding:4px;}' +
      '@media(max-width:640px){.lf-mr{right:16px;left:16px;bottom:16px;width:auto;}}';
    document.head.appendChild(css);

    var box = document.createElement('aside');
    box.className = 'lf-mr';
    box.setAttribute('aria-label', 'You might also like');
    var html = '<button class="lf-mr-x" type="button" aria-label="Close">&times;</button>' +
      '<p class="lf-mr-eyebrow">You might also like</p><ul>';
    items.forEach(function (s) {
      html += '<li><a href="/' + s + '" data-mr="' + s + '">' + esc(P[s][0]) + '</a></li>';
    });
    box.innerHTML = html + '</ul>';
    document.body.appendChild(box);
    var bar = document.querySelector('.mobile-book-bar');
    if (bar && bar.offsetParent !== null && getComputedStyle(bar).position === 'fixed') {
      box.style.bottom = (bar.offsetHeight + 16) + 'px';
    }
    requestAnimationFrame(function () { box.className += ' on'; });

    box.querySelector('.lf-mr-x').addEventListener('click', function () {
      set('localStorage', CLOSED_KEY, String(Date.now()));
      box.parentNode.removeChild(box);
    });
    box.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-mr]') : null;
      if (a && typeof window.gtag === 'function') {
        window.gtag('event', 'more_reads_click', { page_path: window.location.pathname, target: a.getAttribute('data-mr') });
      }
    });
  }

  var shown = false;
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h > 0 && window.scrollY / h > 0.5) {
      window.removeEventListener('scroll', onScroll);
      show();
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();
