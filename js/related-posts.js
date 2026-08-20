/* Renders a "You might also like" block of 3 related posts at the bottom of
   each blog post. Picks posts by shared theme keywords with a random
   fallback, so it stays relevant without needing manual curation per post. */
(function () {
  var POSTS = [
    { file: 'post-decision-that-didnt-make-sense.html', title: 'The Decision That Didn\u2019t Make Sense', tags: ['career', 'decision', 'physician'] },
    { file: 'post-discomfort-you-choose.html', title: 'The Discomfort You Choose vs. The Pain You Borrow', tags: ['mindset', 'discomfort'] },
    { file: 'post-guilt-of-leaving.html', title: 'The Guilt of Leaving What You Built', tags: ['career', 'guilt', 'identity'] },
    { file: 'post-its-just-where-you-arent-looking.html', title: 'It\u2019s Not Lost. It\u2019s Just Where You Aren\u2019t Looking.', tags: ['mindset', 'perspective'] },
    { file: 'post-light-in-their-eyes.html', title: 'The Light in Their Eyes', tags: ['ikigai', 'purpose', 'teaching'] },
    { file: 'post-mindset-isnt-who-you-are.html', title: 'Mindset Isn\u2019t Who You Are. It\u2019s Where You\u2019re Looking.', tags: ['mindset'] },
    { file: 'post-my-ikigai-didnt-die.html', title: 'My Ikigai Didn\u2019t Die. It Grew Up With Me.', tags: ['ikigai', 'purpose', 'career'] },
    { file: 'post-never-out-memorize-ai.html', title: 'You Will Never Out-Memorize AI. And That\u2019s Not the Point.', tags: ['physician', 'medicine'] },
    { file: 'post-path-to-your-purpose-healthcare-edition.html', title: 'A Letter to Med School Applicants Facing Rejection', tags: ['physician', 'purpose', 'medicine'] },
    { file: 'post-permission-to-put-it-down.html', title: 'On Permission to Put It Down', tags: ['presence', 'discomfort'] },
    { file: 'post-pessimism-disguised-as-realism.html', title: 'Pessimism Disguised as Realism', tags: ['mindset', 'perspective'] },
    { file: 'post-what-i-found-on-the-other-side.html', title: 'What I Found on the Other Side', tags: ['career', 'identity'] },
    { file: 'post-what-i-lost.html', title: 'What I Lost (And What I Found Instead)', tags: ['career', 'identity', 'decision'] },
    { file: 'post-what-if-your-ikigai-was-allowed-to-move.html', title: 'What If Your Ikigai Was Allowed to Move?', tags: ['ikigai', 'purpose'] },
    { file: 'post-why-lifelong-learning-is-permission.html', title: 'Why Lifelong Learning Is Permission to Keep Changing', tags: ['ikigai', 'purpose', 'mindset'] },
    { file: 'post-you-have-permission-to-change.html', title: 'You Have Permission to Change', tags: ['identity', 'career', 'purpose'] }
  ];

  function currentFile() {
    var parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || '';
  }

  function pickRelated(current, count) {
    var me = POSTS.filter(function (p) { return p.file === current; })[0];
    var others = POSTS.filter(function (p) { return p.file !== current; });
    if (!me) {
      return others.sort(function () { return Math.random() - 0.5; }).slice(0, count);
    }
    var scored = others.map(function (p) {
      var overlap = p.tags.filter(function (t) { return me.tags.indexOf(t) !== -1; }).length;
      return { post: p, score: overlap + Math.random() * 0.3 };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, count).map(function (s) { return s.post; });
  }

  function render() {
    var mount = document.getElementById('pf-related-posts');
    if (!mount) return;
    var current = currentFile();
    var picks = pickRelated(current, 3);
    if (!picks.length) return;

    var html = '<p style="font-family:\'Playfair Display\',serif;font-size:1.25rem;font-weight:500;color:#1A1A1A;margin-bottom:20px;">You might also like</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;">';
    picks.forEach(function (p) {
      html += '<a href="' + p.file + '" style="display:block;padding:18px 20px;border:1px solid #EDE9E4;text-decoration:none;color:#1A1A1A;transition:border-color 0.2s;">' +
        '<span style="font-size:0.95rem;line-height:1.4;font-weight:400;">' + p.title + '</span>' +
        '</a>';
    });
    html += '</div>';
    mount.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', render);
})();
