/* Black Friday slide-in card. Temporary: turns itself off after Dec 2, 2026
   (midnight ET). Shows once per visitor after a short delay, never on the
   pages it promotes, and stays out of the way of the exit popup and chat. */
(function () {
  var END = Date.UTC(2026, 11, 3, 5, 0, 0); // Dec 3, 2026 00:00 ET
  var KEY = 'lf_bf_slidein_closed';
  var SKIP = ['/black-friday-mattress-deals', '/avocado-black-friday', '/black-friday-2026', '/free-session', '/gift-thank-you'];
  if (Date.now() > END) return;
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  if (SKIP.indexOf(path) > -1) return;
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}

  function track(name, extra) {
    try { if (window.gtag) gtag('event', name, Object.assign({ placement: 'bf_slidein', page: location.pathname }, extra || {})); } catch (e) {}
  }
  function close(card) {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    card.style.transform = 'translateX(120%)';
    setTimeout(function () { card.remove(); }, 400);
  }
  function show() {
    if (document.getElementById('pf-exit-overlay')) { setTimeout(show, 4000); return; }
    var card = document.createElement('aside');
    card.id = 'lf-bf-slidein';
    card.setAttribute('role', 'complementary');
    card.setAttribute('aria-label', 'Black Friday picks');
    card.style.cssText = 'position:fixed;right:20px;top:110px;z-index:9990;width:300px;max-width:calc(100vw - 40px);' +
      'background:#FBF9F6;border:1px solid #B8975A;box-shadow:0 12px 32px rgba(24,45,78,0.18);padding:20px 22px 18px;' +
      'font-family:inherit;transform:translateX(120%);transition:transform .4s ease;';
    card.innerHTML =
      '<button type="button" aria-label="Close" style="position:absolute;top:6px;right:8px;background:none;border:0;font-size:22px;line-height:1;color:#8A7A5C;cursor:pointer;">&times;</button>' +
      '<p style="font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:#8A7A5C;margin:0 0 6px;">Black Friday picks</p>' +
      '<p style="font-family:\'Playfair Display\',serif;font-size:1.25rem;line-height:1.3;color:#182D4E;margin:0 0 8px;">Mattresses up to 25% off</p>' +
      '<p style="font-size:0.9rem;line-height:1.55;color:#3D3A36;margin:0 0 14px;">Boll &amp; Branch, Avocado and Birch, plus how to keep a new bed clean.</p>' +
      '<a href="/black-friday-mattress-deals?utm_source=site&amp;utm_content=bf_slidein" data-k="mattress" style="display:block;text-align:center;background:#1A1A1A;color:#fff;padding:11px 14px;font-size:0.72rem;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;margin:0 0 10px;">See the mattress deals</a>' +
      '<a href="/black-friday-2026?utm_source=site&amp;utm_content=bf_slidein" data-k="all" style="display:block;text-align:center;font-size:0.82rem;color:#23406E;text-decoration:underline;">Every sale I am tracking</a>';
    document.body.appendChild(card);
    requestAnimationFrame(function () { requestAnimationFrame(function () { card.style.transform = 'translateX(0)'; }); });
    track('bf_slidein_shown');
    card.querySelector('button').addEventListener('click', function () { track('bf_slidein_close'); close(card); });
    card.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        try { localStorage.setItem(KEY, '1'); } catch (e) {}
        track('bf_slidein_click', { target: a.getAttribute('data-k') });
      });
    });
    var mq = window.matchMedia('(max-width: 640px)');
    function fit() {
      if (mq.matches) { card.style.left = '12px'; card.style.right = '12px'; card.style.width = 'auto'; card.style.top = '96px'; }
    }
    fit();
  }
  function start() { setTimeout(show, 8000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
