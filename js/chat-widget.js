/* Live chat (tawk.to) for laurenfine.com.
   Loaded on every page by js/attribution.js, so no page needs its own tag.

   Placement: bottom LEFT. The "More reads" card (js/more-reads.js) already
   slides in at bottom right, so a right-side bubble would sit on top of it.

   It also steps out of the way of the site's own overlays: the bubble hides
   while the exit popup (#pf-exit-overlay.open) or the mobile "More reads"
   card is showing, and comes back when they close.

   The welcome message, its delay and the away-hours form are set in the
   tawk.to dashboard (Administration > Triggers / Chat Widget), not here. */
(function () {
  var PROPERTY_ID = 'PASTE_PROPERTY_ID';
  var WIDGET_ID = 'PASTE_WIDGET_ID';
  if (PROPERTY_ID.indexOf('PASTE_') === 0) return;

  var path = location.pathname;
  if (/template/.test(path)) return;

  // Pages with a bar pinned to the bottom of the phone screen need the
  // bubble lifted above it.
  var hasMobileBar = path === '/' || /^\/(index|deals)(\.html)?$/.test(path);

  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  Tawk_API.customStyle = {
    visibility: {
      desktop: { position: 'bl', xOffset: 20, yOffset: 20 },
      mobile: { position: 'bl', xOffset: 12, yOffset: hasMobileBar ? 76 : 12 }
    }
  };

  function overlayOpen() {
    var exit = document.getElementById('pf-exit-overlay');
    if (exit && exit.classList.contains('open')) return true;
    var card = document.querySelector('.lf-mr.on');
    return !!(card && window.innerWidth <= 640);
  }

  var hidden = false;
  function sync() {
    if (typeof Tawk_API.hideWidget !== 'function') return;
    var shouldHide = overlayOpen();
    if (shouldHide === hidden) return;
    hidden = shouldHide;
    try { shouldHide ? Tawk_API.hideWidget() : Tawk_API.showWidget(); } catch (e) {}
  }

  Tawk_API.onLoad = function () {
    sync();
    try {
      new MutationObserver(sync).observe(document.body, {
        attributes: true, attributeFilter: ['class'], subtree: true, childList: true
      });
    } catch (e) {}
  };

  // Count chats in Google Analytics next to the other lead events.
  Tawk_API.onChatStarted = function () {
    try { if (typeof gtag === 'function') gtag('event', 'chat_started', { page: path }); } catch (e) {}
  };
  Tawk_API.onOfflineSubmit = function () {
    try { if (typeof gtag === 'function') gtag('event', 'chat_offline_message', { page: path }); } catch (e) {}
  };

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://embed.tawk.to/' + PROPERTY_ID + '/' + WIDGET_ID;
  s.charset = 'UTF-8';
  s.setAttribute('crossorigin', '*');
  document.head.appendChild(s);
})();
