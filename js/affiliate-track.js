/* Sends a GA4 affiliate_click event for every ShopMy or Amazon link, with the page and placement. */
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="shopmy.us"], a[href*="amazon.com"], a[href*="amzn.to"], a[href*="grove.co"], a[href*="rstyle.me"]');
    if (!a || typeof window.gtag !== 'function') return;
    var card = a.closest('[id]');
    var brand = (a.querySelector('.shop-brand') || {}).textContent || (a.textContent || '').trim().slice(0, 60);
    try {
      gtag('event', 'affiliate_click', {
        source: location.pathname,
        brand: brand,
        link_url: a.href,
        placement: a.getAttribute('data-placement') || (card ? card.id : '')
      });
    } catch (err) {}
  }, true);
})();
