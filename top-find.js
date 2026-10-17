/* トップの困りごと検索（yorozu-plans ROADMAP 7.81.1 K166、企画書 95「トップ・LINE」）。
   検索の箱で語が 1 件も当たらないとき（top.js が箱に yt-nohit を出す）だけ、文が 3〜200 字なら、入力が 0.8 秒止まってから
   yorozu-ai の /v1/find に文を送り、近い道具を 3 つ一覧に出す。文は yorozu-ai が保存しない（プライバシーポリシー 7.11）。
   top.js は通信をしない決まりなので、通信はこのファイルに分けてトップだけが読む（top-next.js と同じ形）。3 秒で返らなければ何も出さない */
(function (root) {
  'use strict';
  var API = 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/find';
  var WAIT_MS = 800;
  /** 送るか: 3〜200 字（NFKC・空白を詰めた長さ） */
  function shouldSend(q) {
    var n = Array.from(String(q || '').normalize('NFKC').replace(/\s+/g, ' ').trim()).length;
    return n >= 3 && n <= 200;
  }
  /** /v1/find の返り → top.js の一覧の行（このサイトの道を持つものだけ） */
  function toRows(j) {
    if (!j || j.ok !== true || !Array.isArray(j.results)) return [];
    return j.results.filter(function (r) { return r && typeof r.url === 'string' && /^\/[a-z0-9-]/.test(r.url) && typeof r.title === 'string'; })
      .slice(0, 3).map(function (r) { return { p: r.url, s: r.title, t: r.title, g: String(r.line || '') }; });
  }
  root.YorozuTopFind = { shouldSend: shouldSend, toRows: toRows, API: API, WAIT_MS: WAIT_MS };
  if (typeof document === 'undefined' || !root.fetch) return;
  var timer = null;
  document.addEventListener('yt-nohit', function (e) {
    clearTimeout(timer);
    var d = e.detail || {};
    if (!shouldSend(d.q) || typeof d.show !== 'function') return;
    timer = setTimeout(function () {
      var ac = root.AbortController ? new AbortController() : null;
      if (ac) setTimeout(function () { ac.abort(); }, 3000);
      root.fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: d.q }), signal: ac ? ac.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { var rows = toRows(j); if (rows.length) d.show(rows); })
        .catch(function () { /* 届かなければ「見つかりません」のまま */ });
    }, WAIT_MS);
  }, true);
  // 箱に文字が入るたびに待ちを取り消す（当たる語を打ったら送らない）
  document.addEventListener('input', function () { clearTimeout(timer); }, true);
})(typeof window !== 'undefined' ? window : globalThis);
