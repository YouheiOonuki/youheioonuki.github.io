/* トップの「次の改定」（yorozu-plans ROADMAP 7.44.1 K141）。
   計算 API の /v1/now（制度の改定カレンダーから、今日より後の最初の施行日）を読んで、いまの時期の下に 1 行出す。
   送るものは無い（GET だけ、入力を読まない）。3 秒で読めなければ、または形が違えば、何も出さない。
   top.js は通信をしない決まり（検索の入力を送らない）なので、通信はこのファイルに分けてトップだけが読む */
(function () {
  'use strict';
  var next = document.getElementById('yt-next');
  if (next && window.fetch) {
    var ac = window.AbortController ? new AbortController() : null;
    if (ac) setTimeout(function () { ac.abort(); }, 3000);
    fetch('https://yorozu-api.oonuki-youhei.workers.dev/v1/now', ac ? { signal: ac.signal } : {}).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.next || !/^\d{4}-\d{2}-\d{2}$/.test(j.next.date) || !j.next.items || !j.next.items.length) return;
      var p = j.next.date.split('-'), it = j.next.items[0];
      if (typeof it.url !== 'string' || it.url.indexOf('https://yorozu-craft.com/') !== 0) return;   // このサイトの改定カレンダーへのリンクだけ
      next.textContent = '次の改定: ' + Number(p[1]) + '月' + Number(p[2]) + '日 ';
      var a = document.createElement('a');
      a.href = it.url; a.textContent = it.title + (j.next.items.length > 1 ? ' ほか' : '');
      next.appendChild(a);
      next.hidden = false;
    }).catch(function () {});
  }
})();
