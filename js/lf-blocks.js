/* Handles every .lf-kit signup on a page.
   With data-file: delivers the worksheet through /api/download, which also adds
   the person to Flodesk (The Sunday Letter). Without it: Sunday Letter only,
   through /api/subscribe. */
(function () {
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function notes() {
    var p = window.lfParams ? window.lfParams() : new URLSearchParams(window.location.search);
    return 'utm_source=' + (p.get('utm_source') || '') + '; utm_medium=' + (p.get('utm_medium') || '') +
      '; utm_campaign=' + (p.get('utm_campaign') || '') + '; referrer=' + (document.referrer || '') +
      '; page=' + window.location.pathname;
  }
  function saveBlob(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.lf-kit'), function (box) {
    var form = box.querySelector('form');
    if (!form) return;
    var btn = form.querySelector('button');
    var status = box.querySelector('.lf-kit-status');
    var done = box.querySelector('.lf-kit-done');
    var label = btn.textContent;
    var sheet = box.getAttribute('data-sheet');
    var file = box.getAttribute('data-file');
    var source = box.getAttribute('data-source') || 'site-kit';
    var audience = box.getAttribute('data-audience') || '';
    function fail(msg) {
      status.textContent = msg;
      status.classList.add('show');
      btn.disabled = false;
      btn.textContent = label;
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.classList.remove('show');
      var name = (form.querySelector('[name=firstName]') || {}).value || '';
      var email = ((form.querySelector('[name=email]') || {}).value || '').trim();
      var hp = (form.querySelector('[name=company]') || {}).value || '';
      if (!EMAIL_RE.test(email)) { fail('Please enter a valid email address.'); return; }
      btn.disabled = true;
      btn.textContent = 'Sending...';
      var req;
      if (file) {
        req = fetch('/api/download', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: name.trim(), email: email, worksheet: sheet, source: source, audience: audience, company: hp, notes: notes() })
        }).then(function (r) { if (!r.ok) throw new Error('bad'); return r.blob(); })
          .then(function (b) { saveBlob(b, file); });
      } else {
        req = fetch('/api/subscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName: name.trim(), email: email, source: source, audience: audience, company: hp, notes: notes() })
        }).then(function (r) { if (!r.ok) throw new Error('bad'); });
      }
      req.then(function () {
        if (typeof gtag === 'function') {
          gtag('event', file ? 'generate_lead' : 'mailing_list_signup', { source: source, audience: audience, worksheet: sheet || '', page: window.location.pathname });
        }
        form.style.display = 'none';
        var note = box.querySelector('.lf-kit-note');
        if (note) note.style.display = 'none';
        done.classList.add('show');
      }).catch(function () {
        fail('Something went wrong. Please try again, or email ReasonDxCoaching@gmail.com.');
      });
    });
  });
})();
