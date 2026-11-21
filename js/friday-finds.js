/* Friday Finds: the weekly deals email signup box (.ff-box) on shopping pages.
   Posts to /api/subscribe with audience=shopping, which routes the signup to
   the deals segment (FLODESK_SEGMENT_DEALS) instead of The Sunday Letter. */
(function () {
  function notes() {
    var p = new URLSearchParams(location.search);
    return 'page: ' + location.pathname + '; utm_source=' + (p.get('utm_source') || '') + '; referrer=' + (document.referrer || '');
  }
  document.querySelectorAll('.ff-box form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var box = f.closest('.ff-box'), msg = box.querySelector('.ff-msg'), btn = f.querySelector('button');
      var email = f.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Please check your email address.'; return; }
      btn.disabled = true; msg.textContent = '';
      var source = box.getAttribute('data-source') || 'ff-box';
      var body = 'email=' + encodeURIComponent(email) + '&source=' + encodeURIComponent(source) +
        '&audience=shopping&leadStage=deals&company=' + encodeURIComponent(f.company.value) + '&notes=' + encodeURIComponent(notes());
      fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            f.outerHTML = '<p class="ff-done"><strong>You are on the list.</strong> Your first Friday Finds lands this Friday.</p>';
            if (window.gtag) gtag('event', 'generate_lead', { source: source, audience: 'shopping', page: location.pathname });
          } else { btn.disabled = false; msg.textContent = (res.j && res.j.error) || 'That did not go through. Please try again.'; }
        }).catch(function () { btn.disabled = false; msg.textContent = 'That did not go through. Please try again.'; });
    });
  });
})();
