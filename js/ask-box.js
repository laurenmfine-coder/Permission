/* Anonymous question box.
   Renders into any <div data-ask-box> on the page, injects its own CSS, and
   posts to /api/question.

   The email field is deliberately optional. The people this is for are the
   ones who will not hand over an address yet — asking for one is the friction
   this box exists to remove. The publish checkbox is opt-in and off by
   default, so nothing anyone writes becomes public without them choosing it. */
(function () {
  var ENDPOINT = '/api/question';
  var SESSION_KEY = 'pf_question_sent';

  function injectCSS() {
    if (document.getElementById('ask-box-css')) return;
    var css = [
      '.ask-box-section { background:var(--cream-dark,#EDE9E4); padding:80px 64px; }',
      '.ask-box { background:var(--white,#fff); border-top:3px solid var(--gold,#B8975A); box-shadow:0 8px 40px rgba(24,45,78,0.07); padding:48px 48px 42px; max-width:720px; margin:0 auto; }',
      '.ask-box-eyebrow { font-size:0.68rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--terracotta,#23406E); margin-bottom:16px; }',
      '.ask-box h3 { font-family:"Playfair Display",serif; font-size:2rem; font-weight:300; line-height:1.15; color:var(--black,#1A1A1A); margin-bottom:16px; }',
      '.ask-box h3 em { font-style:italic; color:var(--terracotta,#23406E); }',
      '.ask-box-lede { font-size:0.98rem; line-height:1.8; color:var(--gray,#8C8580); font-weight:300; margin-bottom:28px; }',
      '.ask-field { margin-bottom:20px; }',
      '.ask-field label { display:block; font-size:0.66rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--warm-dark,#182D4E); font-weight:500; margin-bottom:10px; }',
      '.ask-field label .opt { text-transform:none; letter-spacing:0.02em; color:var(--gray,#8C8580); font-weight:300; font-size:0.78rem; }',
      '.ask-field textarea, .ask-field input[type=email] { width:100%; font-family:inherit; font-size:0.95rem; font-weight:300; color:var(--black,#1A1A1A); background:#FBFAF8; border:1px solid var(--cream-dark,#EDE9E4); padding:14px 16px; transition:border-color 0.25s; }',
      '.ask-field textarea { min-height:132px; resize:vertical; line-height:1.7; }',
      '.ask-field textarea:focus, .ask-field input[type=email]:focus { outline:none; border-color:var(--gold,#B8975A); }',
      '.ask-field textarea::placeholder, .ask-field input::placeholder { color:#B9B3AD; font-weight:300; }',
      '.ask-check { display:flex; align-items:flex-start; gap:10px; margin:4px 0 24px; }',
      '.ask-check input { margin-top:3px; flex-shrink:0; }',
      '.ask-check label { font-size:0.85rem; line-height:1.65; color:var(--gray,#8C8580); font-weight:300; cursor:pointer; }',
      '.ask-submit { width:100%; font-family:inherit; font-size:0.72rem; font-weight:400; letter-spacing:0.16em; text-transform:uppercase; color:#fff; background:var(--black,#1A1A1A); border:none; padding:17px 20px; cursor:pointer; transition:background 0.3s; }',
      '.ask-submit:hover:not(:disabled) { background:var(--terracotta,#23406E); }',
      '.ask-submit:disabled { opacity:0.55; cursor:default; }',
      '.ask-note { font-size:0.78rem; line-height:1.7; color:var(--gray,#8C8580); margin-top:18px; text-align:center; }',
      '.ask-note a { color:var(--black,#1A1A1A); text-decoration:none; border-bottom:1px solid var(--gold,#B8975A); }',
      '.ask-status { display:none; font-size:0.82rem; color:#9B3B2F; margin-top:14px; text-align:center; line-height:1.6; }',
      '.ask-status.show { display:block; }',
      '.ask-hp { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }',
      '.ask-done { text-align:center; padding:16px 0 4px; }',
      '.ask-done h3 { font-family:"Playfair Display",serif; font-size:1.9rem; font-weight:300; color:var(--black,#1A1A1A); margin-bottom:14px; }',
      '.ask-done p { font-size:0.95rem; line-height:1.8; color:var(--gray,#8C8580); font-weight:300; max-width:440px; margin:0 auto 12px; }',
      '@media (max-width:760px) { .ask-box-section { padding:52px 20px; } .ask-box { padding:32px 22px 28px; } .ask-box h3 { font-size:1.6rem; } }'
    ].join('\n');
    var el = document.createElement('style');
    el.id = 'ask-box-css';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function render(host) {
    var source = host.getAttribute('data-ask-box') || location.pathname;
    host.innerHTML =
      '<div class="ask-box">' +
        '<p class="ask-box-eyebrow">Not ready to book?</p>' +
        '<h3>Ask me <em>anonymously</em>.</h3>' +
        '<p class="ask-box-lede">No email needed and no follow-up. Ask the thing you would ask if nobody knew it was you &mdash; the question you have not said out loud yet, or the one that feels too small to book a session over.</p>' +
        '<form novalidate>' +
          '<div class="ask-field">' +
            '<label for="askQuestion">Your question</label>' +
            '<textarea id="askQuestion" name="question" placeholder="What are you actually trying to figure out?" required></textarea>' +
          '</div>' +
          '<div class="ask-field">' +
            '<label for="askEmail">Email <span class="opt">&mdash; optional, only if you want a reply</span></label>' +
            '<input type="email" id="askEmail" name="email" autocomplete="email" placeholder="Leave blank to stay anonymous">' +
          '</div>' +
          '<div class="ask-check">' +
            '<input type="checkbox" id="askPublish" name="publishOk">' +
            '<label for="askPublish">You can answer this publicly if it would help someone else. My name and email stay out of it.</label>' +
          '</div>' +
          '<div class="ask-hp"><label>Company<input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>' +
          '<button type="submit" class="ask-submit">Send it</button>' +
          '<p class="ask-status"></p>' +
          '<p class="ask-note">I read these myself. If you would rather just write to me, that works too &mdash; <a href="mailto:reasondxcoaching@gmail.com">reasondxcoaching@gmail.com</a>.</p>' +
        '</form>' +
      '</div>';

    var box = host.querySelector('.ask-box');
    var form = host.querySelector('form');
    var btn = host.querySelector('.ask-submit');
    var status = host.querySelector('.ask-status');
    var loadedAt = Date.now();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      status.classList.remove('show');

      var question = form.question.value.trim();
      var email = form.email.value.trim();

      if (question.length < 10) {
        status.textContent = 'Could you add a little more? A sentence is plenty.';
        status.classList.add('show');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Sending…';

      try {
        var res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question,
            email: email,
            publishOk: form.publishOk.checked,
            company: form.company.value,
            source: source,
            context: document.title,
            elapsedMs: Date.now() - loadedAt
          })
        });
        var out = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(out.error || 'Something went wrong on my end.');

        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) {}
        if (typeof gtag === 'function') {
          gtag('event', 'question_submitted', {
            has_email: email ? 'yes' : 'no',
            publish_ok: form.publishOk.checked ? 'yes' : 'no',
            source: source
          });
        }

        box.innerHTML =
          '<div class="ask-done">' +
            '<h3>Got it.</h3>' +
            '<p>Thank you for trusting me with that. I read every one of these myself.</p>' +
            (email
              ? '<p>I&rsquo;ll come back to you at that address, usually within a couple of days.</p>'
              : '<p>You asked anonymously, so there is no way for me to reply &mdash; but it is read, and questions like yours are often what the newsletter ends up being about.</p>') +
          '</div>';
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        status.textContent = err.message ||
          'That did not go through. Please try once more, or email me directly at reasondxcoaching@gmail.com.';
        status.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Send it';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var hosts = document.querySelectorAll('[data-ask-box]');
    if (!hosts.length) return;
    injectCSS();
    for (var i = 0; i < hosts.length; i++) render(hosts[i]);
  });
})();
