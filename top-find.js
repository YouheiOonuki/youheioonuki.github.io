/* トップの困りごと検索（yorozu-plans ROADMAP 7.81.1 K166、7.96 D365・D367）。
   検索の箱に 3〜200 字が入り、名前とぴったり一致する語でないとき（top.js が箱に yt-query を出す）、入力が 0.8 秒止まってから
   yorozu-ai の /v1/find に文を送り、近い道具を 3 つ、語で当たった道具の下に足す（2 段）。文は yorozu-ai が保存しない（プライバシーポリシー 7.11）。
   数えるのは件数だけ（D367。/v1/ping に page と event だけ。文は送らない）: find_used（送った）・find_zero（語の一致が 0 件だった）・find_click（近い道具から進んだ）。
   top.js は通信をしない決まりなので、通信はこのファイルに分けてトップだけが読む（top-next.js と同じ形）。3 秒で返らなければ何も足さない */
(function (root) {
  'use strict';
  var API = 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/find';
  var PING = 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/ping';
  var WAIT_MS = 800;
  /** 送るか: 3〜200 字（NFKC・空白を詰めた長さ）で、名前とぴったり一致する語でない */
  function shouldSend(q, exact) {
    var n = Array.from(String(q || '').normalize('NFKC').replace(/\s+/g, ' ').trim()).length;
    return !exact && n >= 3 && n <= 200;
  }
  /** /v1/find の返り → top.js の一覧の行（このサイトの道を持つものだけ） */
  function toRows(j) {
    if (!j || j.ok !== true || !Array.isArray(j.results)) return [];
    return j.results.filter(function (r) { return r && typeof r.url === 'string' && /^\/[a-z0-9-]/.test(r.url) && typeof r.title === 'string'; })
      .slice(0, 3).map(function (r) { return { p: r.url, s: r.title, t: r.title, g: String(r.line || '') }; });
  }
  /** 件数を 1 つ（page と event だけ。届かなくても何もしない） */
  function ping(page, event) {
    try { if (root.navigator && root.navigator.sendBeacon) root.navigator.sendBeacon(PING, new Blob([JSON.stringify({ page: page, event: event })], { type: 'text/plain' })); } catch (e) { /* 数えられなくても検索は止めない */ }
  }
  /** 一覧の href（./x/ や ../x/）→ サイトの道（/x/） */
  function pathOf(href) { return '/' + String(href || '').replace(/^(\.\.?\/)+/, '').replace(/^\//, ''); }
  root.YorozuTopFind = { shouldSend: shouldSend, toRows: toRows, pathOf: pathOf, API: API, PING: PING, WAIT_MS: WAIT_MS };
  if (typeof document === 'undefined' || !root.fetch) return;
  var timer = null;
  var here = function () { return (root.location && root.location.pathname) || '/'; };
  document.addEventListener('yt-query', function (e) {
    clearTimeout(timer);
    var d = e.detail || {};
    if (!shouldSend(d.q, d.exact) || typeof d.show !== 'function') return;
    timer = setTimeout(function () {
      ping(here(), 'find_used');
      if (d.hits === 0) ping(here(), 'find_zero');
      var ac = root.AbortController ? new AbortController() : null;
      if (ac) setTimeout(function () { ac.abort(); }, 3000);
      root.fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: d.q }), signal: ac ? ac.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { var rows = toRows(j); if (rows.length) d.show(rows); })
        .catch(function () { /* 届かなければ語の結果のまま */ });
    }, WAIT_MS);
  }, true);
  // 近い道具から進んだ（行き先の道だけを数える）
  document.addEventListener('yt-pick', function (e) {
    var d = e.detail || {};
    if (d.near && typeof d.href === 'string') ping(pathOf(d.href), 'find_click');
  }, true);
  // 箱に文字が入るたびに待ちを取り消す
  document.addEventListener('input', function () { clearTimeout(timer); }, true);
})(typeof window !== 'undefined' ? window : globalThis);
