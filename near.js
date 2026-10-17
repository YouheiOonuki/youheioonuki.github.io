/* 道具のページの「近い道具」から進んだ数（yorozu-plans ROADMAP 7.96 D367 near_click）。送るのは行き先の道と event だけ（入力・Cookie は送らない） */
(function () {
  'use strict';
  var PING = 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/ping';
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-near-link]') : null;
    if (!a || !navigator.sendBeacon) return;
    try { navigator.sendBeacon(PING, new Blob([JSON.stringify({ page: a.getAttribute('href'), event: 'near_click' })], { type: 'text/plain' })); } catch (err) { /* 数えられなくても移る */ }
  });
})();
