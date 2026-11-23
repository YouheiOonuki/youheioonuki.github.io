/* トップの情シス・PC の札に、ストップボードの今の 1 件の箱（yorozu-plans ROADMAP 続き 73 の答えの 9、D1084。QUEUE Q-1244）。
   形は札の答えの箱（a.yt-ans）と同じ 3 つ: 「いま」→「〈相手の名前〉が障害を発表中」→「ストップボード」。
   2 件以上は「〈1 件目の名前〉ほか N 件が障害を発表中」、0 件は「障害の発表は 0 件」。リンク先は ストップボードのトップ。
   読むのは https://stopboard.yorozu-craft.com/now.json の 1 回だけ（開いた時。繰り返さない）。GET だけで、入力も端末の情報も載せない
   （Cookie なし・Referer なし・ヘッダなし）。取れない時（失敗・4 秒を超えた・形が違う・取り込みが古い）と、この script が無い時は、箱を出さない。
   箱の場所を先に空けない（出た時に下が動くのは、札の中だけ）。相手の名前は now.json の name の欄をそのまま（言い換えない）。
   数えるのは kind が incident の相手（障害）。予定メンテナンス（planned）は数えない。同じ相手の複数の障害は 1 件。
   top.js は通信をしない決まりなので、通信はこのファイルに分けてトップだけが読む */
(function (root) {
  'use strict';
  var URL_NOW = 'https://stopboard.yorozu-craft.com/now.json';
  var HREF = 'https://stopboard.yorozu-craft.com/';
  var TIMEOUT_MS = 4000;
  /** now.json → { n: 障害を発表中の相手の数, first: 1 件目の名前 }。形が違う・取り込みが古い時は null */
  function summarize(j) {
    if (!j || typeof j !== 'object' || j.version !== 1 || !Array.isArray(j.stopped) || j.ingestOld !== false) return null;
    var seen = {}, names = [];
    for (var i = 0; i < j.stopped.length; i++) {
      var x = j.stopped[i];
      if (!x || typeof x !== 'object' || typeof x.id !== 'string' || typeof x.name !== 'string' || !x.name || typeof x.kind !== 'string') return null;
      if (x.kind !== 'incident' || seen[x.id]) continue;
      seen[x.id] = true;
      names.push(x.name);
    }
    return { n: names.length, first: names[0] || '' };
  }
  /** summarize の返り → 箱の 3 つの字 */
  function lines(s) {
    if (!s) return null;
    var sp = /[A-Za-z0-9]$/.test(s.first) ? ' ' : '';   // 英数字で終わる名前の後は、サイトの書き方（半角の英数と日本語の間）に合わせて 1 字空ける（見本の「Cloudflare が障害を発表中」）
    var out = s.n === 0 ? '障害の発表は 0 件' : s.n === 1 ? s.first + sp + 'が障害を発表中' : s.first + sp + 'ほか ' + (s.n - 1) + ' 件が障害を発表中';
    return { i: 'いま', o: out, g: 'ストップボード' };
  }
  root.YorozuTopStop = { summarize: summarize, lines: lines, URL_NOW: URL_NOW, HREF: HREF, TIMEOUT_MS: TIMEOUT_MS };
  if (typeof document === 'undefined' || !root.fetch) return;
  var who = document.querySelector('#it .yt-who');
  if (!who || !who.parentNode) return;
  var ac = root.AbortController ? new AbortController() : null;
  var timer = ac ? setTimeout(function () { ac.abort(); }, TIMEOUT_MS) : null;
  root.fetch(URL_NOW, { method: 'GET', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: ac ? ac.signal : undefined })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (timer) clearTimeout(timer);
      var t = lines(summarize(j));
      if (!t || document.querySelector('#it .yt-ans')) return;
      var a = document.createElement('a');
      a.className = 'yt-ans';
      a.href = HREF;
      [['yt-ai', t.i], ['yt-ao', t.o], ['yt-ag', t.g]].forEach(function (p) {
        var s = document.createElement('span');
        s.className = p[0];
        s.textContent = p[1];
        a.appendChild(s);
      });
      who.parentNode.insertBefore(a, who.nextSibling);
    })
    .catch(function () { /* 取れなければ箱は出さない */ });
})(typeof window !== 'undefined' ? window : globalThis);
