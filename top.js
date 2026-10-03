/* トップ・すべての道具・用途別の入口・英語トップで共有する部品（yorozu-plans ROADMAP 7.23「トップの構成」）
   - 検索: ページに埋めた一覧（<script type="application/json" id="yt-index">、tools/build-top.mjs が data/pages.json から作る）を
     端末の中だけで絞る。入力はどこにも送らない（<form> を使わない。通信は一切しない）
   - いまの時期: 埋めた季節表（id="yt-season"、data/season.json から）から、今日の月の 3 枚を出す（作った月と違えば入れ替える）
   tools/build-top.mjs とテスト（tests/top.test.mjs）も同じ関数を使う（node では vm で読む） */
(function (root) {
  'use strict';
  // 比べる形: 全角半角をそろえ（NFKC）、英字は小文字、カタカナはひらがなに
  function norm(s) {
    return String(s || '').normalize('NFKC').toLowerCase()
      .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
      .replace(/\s+/g, ' ').trim();
  }
  // 1 行の点（小さいほど上）。語ごとに、題名の完全一致 0・先頭一致 1・題名に含む 2・別名 3・節や一言 4。どこにも無ければ null
  function scoreTerm(row, term) {
    var t = norm(row.t), s = norm(row.s || '');
    if (t === term || s === term) return 0;
    if (t.indexOf(term) === 0 || s.indexOf(term) === 0) return 1;
    if (t.indexOf(term) >= 0 || s.indexOf(term) >= 0) return 2;
    var a = (row.a || []).map(norm);
    for (var i = 0; i < a.length; i++) if (a[i].indexOf(term) >= 0) return 3;
    if (norm(row.g).indexOf(term) >= 0 || norm(row.n || '').indexOf(term) >= 0) return 4;
    return null;
  }
  // 語（空白で区切る）がすべて当たる行を、点の小さい順（同点は一覧の順）に limit 件まで
  function search(rows, q, limit) {
    var full = norm(q); if (!full) return [];
    var terms = full.split(' ');
    var hit = [];
    rows.forEach(function (row, i) {
      var sum = 0;
      if (norm(row.t) === full || norm(row.s || '') === full) sum = -1; // 題名そのものは必ず先頭
      else for (var k = 0; k < terms.length; k++) { var v = scoreTerm(row, terms[k]); if (v === null) return; sum += v; }
      hit.push({ row: row, sum: sum, i: i });
    });
    hit.sort(function (a, b) { return a.sum - b.sum || a.i - b.i; });
    return hit.slice(0, limit || 8).map(function (h) { return h.row; });
  }
  // 今日（Date）の月の季節表。無い月は空
  function seasonFor(season, date) {
    var m = String((date || new Date()).getMonth() + 1);
    return (season && season.months && season.months[m]) || [];
  }
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  // いまの時期の 3 枚（静的な HTML と、月が変わったときの入れ替えで同じ形）
  function seasonItemsHtml(items, base) {
    return items.map(function (x) {
      return '<li><a href="' + esc(base + x.path.slice(1)) + '"><strong>' + esc(x.name) + '</strong><span>' + esc(x.reason) + '</span></a></li>';
    }).join('');
  }
  var api = { norm: norm, search: search, seasonFor: seasonFor, seasonItemsHtml: seasonItemsHtml, esc: esc };
  root.YorozuTop = api;
  if (typeof document === 'undefined') return;

  function json(id) { var e = document.getElementById(id); if (!e) return null; try { return JSON.parse(e.textContent); } catch (_) { return null; } }

  // いまの時期: 作った月と今日の月が違えば入れ替える
  var season = json('yt-season');
  var list = document.querySelector('[data-season-month]');
  if (season && list) {
    var now = new Date(), m = now.getMonth() + 1;
    if (String(m) !== list.getAttribute('data-season-month')) {
      var items = seasonFor(season, now);
      if (items.length) {
        list.innerHTML = seasonItemsHtml(items, list.getAttribute('data-base') || './');
        list.setAttribute('data-season-month', String(m));
        var mh = document.querySelector('[data-season-label]');
        if (mh) mh.textContent = mh.getAttribute('data-season-label').replace('{m}', String(m));
      }
    }
  }

  // 検索（WAI-ARIA の combobox ＋ listbox。矢印キーで選び Enter で開く。件数は aria-live で読む）
  var index = json('yt-index');
  Array.prototype.forEach.call(document.querySelectorAll('.yt-search'), function (box) {
    var input = box.querySelector('input'), lb = box.querySelector('[role="listbox"]'), status = box.querySelector('.yt-status');
    var empty = box.querySelector('.yt-empty');
    if (!input || !lb || !index) return;
    var base = box.getAttribute('data-base') || './';
    var en = document.documentElement.lang === 'en';
    var active = -1, results = [];
    function setActive(i) {
      var opts = lb.querySelectorAll('[role="option"]');
      active = i;
      Array.prototype.forEach.call(opts, function (o, k) { o.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      if (i >= 0 && opts[i]) { input.setAttribute('aria-activedescendant', opts[i].id); opts[i].scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function close() { lb.hidden = true; input.setAttribute('aria-expanded', 'false'); setActive(-1); }
    function render() {
      var q = input.value;
      results = search(index.rows, q, 8);
      lb.innerHTML = results.map(function (r, k) {
        return '<li role="none"><a role="option" aria-selected="false" tabindex="-1" id="' + lb.id + '-' + k + '" href="' + esc(base + r.p.slice(1)) + '">' +
          '<strong>' + esc(r.s || r.t) + '</strong><span>' + esc(r.g) + '</span></a></li>';
      }).join('');
      var has = results.length > 0;
      lb.hidden = !has;
      input.setAttribute('aria-expanded', has ? 'true' : 'false');
      if (empty) empty.hidden = !(norm(q) && !has);
      active = -1; input.removeAttribute('aria-activedescendant');
      if (status) status.textContent = !norm(q) ? '' : has ? (en ? results.length + (results.length === 1 ? ' result' : ' results') : results.length + ' 件') : (en ? 'No results' : '見つかりません');
    }
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      var n = results.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (lb.hidden && n) { lb.hidden = false; input.setAttribute('aria-expanded', 'true'); } if (n) setActive((active + 1) % n); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) setActive(active <= 0 ? n - 1 : active - 1); }
      else if (e.key === 'Enter') {
        e.preventDefault(); // 送信しない（form は無いが、念のため）
        var i = active >= 0 ? active : (n ? 0 : -1);
        if (i >= 0) location.href = lb.querySelectorAll('[role="option"]')[i].href;
      } else if (e.key === 'Escape') { if (!lb.hidden) close(); else { input.value = ''; render(); } }
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (!box.contains(document.activeElement)) close(); }, 150); });
    input.addEventListener('focus', function () { if (results.length) { lb.hidden = false; input.setAttribute('aria-expanded', 'true'); } });
  });
})(typeof window !== 'undefined' ? window : globalThis);
