/* トップの 1 画面目のリンクが押された回数（yorozu-plans ROADMAP 7.57 の 4、K168 第 2 版の見直し。公開 2 週後に前の 2 週と比べる）。
   押したリンクが、押した時点の画面の 1 画面目（ページの上から画面の高さまで）にあれば、移った先の場所と「top1」の印だけを送る。
   入力・端末の情報・Cookie は送らない。top.js は通信をしない決まり（検索の入力を送らない）なので、このファイルに分けてトップだけが読む */
(function () {
  'use strict';
  var main = document.getElementById('main');
  if (!main || !navigator.sendBeacon) return;
  main.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="./"]');
    if (!a) return;
    if (a.getBoundingClientRect().top + window.scrollY >= window.innerHeight) return;   // 1 画面目より下は数えない
    var path = '/' + a.getAttribute('href').slice(2).replace(/[?#].*$/, '');
    if (!/^\/[a-z0-9\-/._]{0,120}$/.test(path)) return;
    try { navigator.sendBeacon('https://yorozu-ai.oonuki-youhei.workers.dev/v1/ping', new Blob([JSON.stringify({ page: path, event: 'top1' })], { type: 'text/plain' })); } catch (err) {}
  });
})();
