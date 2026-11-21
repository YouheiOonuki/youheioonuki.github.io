// ===========================
// インフラダッシュボード（K241・K248）の配る形の芯（純粋関数）: 相手の一覧と区間の並びから、now.json（いま）と ahead.json（これから 60 日）を作る
// yorozu-plans QUEUE Q-771・Q-798・D603・D606・D608・D609・D618・D619・D622・D623・D630・D631。企画書 113 の 14.2・14.3・15.2
// 外の口に要求を出さない。ほかのファイルは teishi.js（Q-770）だけを使う（ブラウザでは先に teishi.js を読む）
// ブラウザでは window.InfraBoard、Node（テスト）では module.exports で使う
//
// 相手の一覧: 台帳（infra-dashboard の data/targets.json。{ targets: [...] } か行の並び）をそのまま受ける。欄の名前は台帳が正（D630）
//   page    … 公式のページ（出す URL の基点）
//   source.every … 機械で読む間隔（分）。'auto' の線はその 3 回ぶん、欄が無ければ 15 分（D619）
//   checked … 'auto' は最後に読めた時刻（時差つきの ISO。yorozu-cron の取り込みの lastRead）、
//             'ledger' は最後に確かめた日 'YYYY-MM-DD'、'link' はその日か null
// 区間の並び: 2 つの形を同じ並びで受ける
//   止まる予定（teishi.js の upcoming の出力）… { id: 相手, name, column, service: 止まる物, start, end, kind: 'rule'|'extra'|'mixed', limited, url, checked }
//   障害と予定メンテナンス（D618 の形）… { service: 相手, id: 障害の id, start, end|null, impact, title, url, kind? }
//     kind は 'incident' か 'planned'。欄が無い物は 'incident' と読む
//   形は kind で分ける（'rule'・'extra'・'mixed' なら止まる予定、ほかは障害と予定メンテナンス）
//
// 置かない区間（unplaced の数に入れる）: 一覧に無い相手・時刻が読めない・終わりが始まり以前・kind が知らない値
// end が null: 障害は続いている。予定は終わりを公式が出していない —— 始まりの時刻で ahead に並べ（end は null のまま）、始まった後は now に入れる
// start が「いま」より後の区間は now に入れない（kind によらず。D618）
//
// 重さ（いまの並びの順）: critical > major > minor > unknown > none。impact の無い区間（止まる予定）は unknown
// 色の段（color）: planned は blue、critical・major は red、minor・unknown・none は amber（D623）
// 相手の分け方（D622）:
//   確かめられていない（unconfirmed）… 'auto' で線を超えた（読めた時刻が無い・読めない時も）、'ledger' で確かめた日が 8 日より古い
//     'auto' の確かめられていない相手の区間は出し、その相手を最後に読めた時刻を lastRead に付ける（取り込みは前の値を消さない）
//     'ledger' の古い相手の区間は出さない（D602）
//   リンクだけ（link）… 区間を出さず、名前と公式のページだけを別の並びに。数も別
//   「予定なし」（none）… 'auto'・'ledger' で確かめられていて、いまにも 60 日の中にも区間が無い相手
// 出す字は、相手の名前・止まる物の名前・公式の題（しごとの列だけ）・URL・日時だけ。日時は 'YYYY-MM-DDTHH:MM+09:00'
// 同じ入力から同じ JSON（バイトまで）: 欄の順は固定、並びは 時刻 → 一覧の行の順 → 止まる物 → id の順
// ===========================
(function (root) {
  'use strict';

  var T = (typeof module !== 'undefined' && module.exports) ? require('./teishi.js') : root.Teishi;

  var MIN = 60000;
  var DAY = 86400000;
  var DAYS = T.DAYS;            // ahead の長さ（日）。teishi.js と同じ
  var STALE_MIN = 15;           // 取り込みがこれより古ければ「いま」を出さない（D609）。'auto' の相手で source.every が無い時の線
  var EVERY_TIMES = 3;          // 'auto' の線は読む間隔のこの回数ぶん（D619）
  var IMPACT_RANK = { critical: 4, major: 3, minor: 2, unknown: 1, none: 0 };
  var TEISHI_KINDS = ['rule', 'extra', 'mixed'];

  var cmp = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };

  // 日時 → ミリ秒。teishi.js の読み方に、秒の小数（yorozu-cron の toISOString の形）を足す。読めなければ null
  function toMs(v) {
    if (typeof v === 'string') v = v.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d+(Z|[+-]\d{2}:\d{2})$/, '$1$2');
    return T.toMs(v);
  }
  function mustMs(v, what) { var m = toMs(v); if (m === null) throw new Error(what + 'が読めない: ' + v); return m; }

  var httpUrl = function (u) { return typeof u === 'string' && /^https?:\/\//.test(u) ? u : null; };
  var pageOf = function (p) { return httpUrl(p.page); };

  // 'auto' の相手の線（分）: source.every の 3 回ぶん。欄が無い・正の数でなければ 15 分
  function lineMin(p) {
    var e = p.source && p.source.every;
    return typeof e === 'number' && isFinite(e) && e > 0 ? e * EVERY_TIMES : STALE_MIN;
  }

  // 相手を、確かめられた（ok）・確かめられていない（un）・リンクだけ（link）に分ける。並びは一覧の行の順
  function partition(partners, nowMs) {
    var sp = T.split(partners, nowMs);
    var link = {}, stale = {};
    sp.link.forEach(function (p) { link[p.id] = true; });
    sp.stale.forEach(function (p) { stale[p.id] = true; });
    var ok = [], un = [], li = [];
    partners.forEach(function (p) {
      if (!p || typeof p !== 'object' || typeof p.id !== 'string') return;
      if (link[p.id]) { li.push(p); return; }
      var bad = stale[p.id];
      if (!bad && p.mode === 'auto') { var r = toMs(p.checked); bad = r === null || nowMs - r > lineMin(p) * MIN; }
      (bad ? un : ok).push(p);
    });
    return { ok: ok, un: un, link: li };
  }

  // 区間 1 つを、一覧の相手に当てて読む。置けなければ null
  function readSpan(s, byId) {
    if (!s || typeof s !== 'object') return null;
    var teishi = TEISHI_KINDS.indexOf(s.kind) >= 0;
    var pid = teishi ? s.id : s.service;
    var p = typeof pid === 'string' && Object.prototype.hasOwnProperty.call(byId, pid) ? byId[pid] : null;
    if (!p) return null;
    var kind = teishi ? 'planned' : (s.kind === undefined || s.kind === 'incident') ? 'incident' : s.kind === 'planned' ? 'planned' : null;
    if (!kind) return null;
    var st = toMs(s.start), en = s.end === null ? null : toMs(s.end);
    if (st === null || (en === null && s.end !== null) || (en !== null && en <= st)) return null;
    var impact = !teishi && Object.prototype.hasOwnProperty.call(IMPACT_RANK, s.impact) ? s.impact : 'unknown';
    return {
      partner: p.row, ri: p.ri, kind: kind, s: st, e: en,
      service: teishi && typeof s.service === 'string' ? s.service : null,
      si: teishi ? (p.row.stops || []).indexOf(s.service) : -1,
      title: !teishi && p.row.column === 'shigoto' && typeof s.title === 'string' ? s.title : null,
      impact: impact,
      color: kind === 'planned' ? 'blue' : IMPACT_RANK[impact] >= IMPACT_RANK.major ? 'red' : 'amber',
      limited: teishi && s.limited === true,
      url: (!teishi && httpUrl(s.url)) || pageOf(p.row),
      lastRead: p.lastRead,
      sid: teishi ? '' : String(s.id === undefined ? '' : s.id)
    };
  }

  var order = function (a, b) { return a.s - b.s || a.ri - b.ri || a.si - b.si || cmp(a.sid, b.sid); };

  // 出す 1 行（欄の順は固定）
  function itemOut(a) {
    var p = a.partner;
    return { id: p.id, name: p.name, column: p.column, service: a.service, title: a.title, kind: a.kind, impact: a.impact,
      color: a.color, limited: a.limited, start: T.toJst(a.s), end: a.e === null ? null : T.toJst(a.e), url: a.url,
      checked: p.mode === 'ledger' ? p.checked : null, lastRead: a.lastRead };
  }
  var partnerOut = function (p) {
    var c = p.mode === 'auto' || p.checked === undefined ? null : p.checked;
    return { id: p.id, name: p.name, column: p.column, url: pageOf(p), checked: c };
  };
  var linkOut = function (list) {
    var ps = list.map(function (p) { return { id: p.id, name: p.name, column: p.column, url: pageOf(p) }; });
    return { count: ps.length, partners: ps };
  };

  // 入力を読み、確かめた相手と区間に分ける
  function prepare(partnerList, spans, nowMs) {
    var partners = T.rowsOf(partnerList);
    var parts = partition(partners, nowMs);
    var byId = {};
    parts.ok.forEach(function (row) { byId[row.id] = { row: row, ri: partners.indexOf(row), lastRead: null }; });
    // 確かめられていない 'auto' の相手の区間は、最後に読めた時刻を付けて出す（ledger の古い相手と link は出さない）
    parts.un.forEach(function (row) {
      if (row.mode !== 'auto') return;
      var r = toMs(row.checked);
      byId[row.id] = { row: row, ri: partners.indexOf(row), lastRead: r === null ? null : T.toJst(r) };
    });
    var placed = [], unplaced = 0;
    (Array.isArray(spans) ? spans : []).forEach(function (s) {
      var a = readSpan(s, byId);
      if (a) placed.push(a); else unplaced++;
    });
    return { parts: parts, placed: placed, unplaced: unplaced };
  }

  var isOldMs = function (ingMs, tMs) { return ingMs === null || tMs - ingMs > STALE_MIN * MIN; };

  // 取り込みの時刻 ingestedAt が、日時 t から見て 15 分より古いか（画面が「いま」を出さない線。D609）
  function isOld(ingestedAt, t) { return isOldMs(toMs(ingestedAt), mustMs(t, '日時')); }

  // 確かめた相手のうち、区間を 1 つも持たない相手（予定なし）
  function noneOf(ok, busy) {
    var list = ok.filter(function (p) { return !busy[p.id]; }).map(partnerOut);
    return { count: list.length, partners: list };
  }

  // (a) now.json と (b) ahead.json を作る。now は「いま」、ingestedAt は取り込みの時刻
  function build(partnerList, spans, now, ingestedAt) {
    var n = mustMs(now, 'いま'), ing = toMs(ingestedAt), until = n + DAYS * DAY;
    var pre = prepare(partnerList, spans, n);
    var old = isOldMs(ing, n);
    var current = pre.placed.filter(function (a) { return a.s <= n && (a.e === null || n < a.e); });
    current.sort(function (a, b) { return IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact] || order(a, b); });
    // これから: 予定（止まる予定と予定メンテナンス）だけ。障害は終わりが決まらないので「いま」だけに出す（14.2）
    var ahead = pre.placed.filter(function (a) { return a.kind === 'planned' && (a.e === null || a.e > n) && a.s < until; }).sort(order);
    var busy = {};
    current.concat(ahead).forEach(function (a) { busy[a.partner.id] = true; });
    var un = pre.parts.un.map(partnerOut);
    var link = linkOut(pre.parts.link);
    var ingOut = ing === null ? null : T.toJst(ing);
    var stopped = old ? [] : current.map(itemOut);
    return {
      now: { version: 1, at: T.toJst(n), ingestedAt: ingOut, ingestOld: old, stopped: stopped, nothing: !old && !stopped.length,
        none: noneOf(pre.parts.ok, busy), unconfirmed: un, link: link, unplaced: pre.unplaced },
      ahead: { version: 1, from: T.toJst(n), until: T.toJst(until), ingestedAt: ingOut, items: ahead.map(itemOut),
        partners: pre.parts.ok.map(partnerOut), unconfirmed: un, link: link, unplaced: pre.unplaced }
    };
  }

  // (c) ahead.json と日時 t から、t に止まっている物・「ほか N 件は予定なし」・いちばん古い確かめた日。端末の中だけで絞る
  //     返すのは予定（planned）だけ。いま続いている障害を t に持ち込まない。終わりが null の予定は、t が始まり以後なら返す
  //     opts.column: 'shigoto' か 'kurashi' で片方の列だけ。t が ahead の範囲の外なら inRange: false で、何も言わない
  function at(ahead, t, opts) {
    var tm = mustMs(t, '日時');
    var col = opts && opts.column;
    var inCol = function (x) { return !col || x.column === col; };
    var partners = (ahead.partners || []).filter(inCol);
    var dates = partners.map(function (p) { return p.checked; }).filter(Boolean).sort();
    var oldest = dates.length ? dates[0] : null;
    var f = toMs(ahead.from), u = toMs(ahead.until);
    if (f === null || u === null || tm < f || tm >= u) return { inRange: false, stopped: [], none: null, oldestChecked: oldest };
    var stopped = (ahead.items || []).filter(function (x) {
      return inCol(x) && x.kind === 'planned' && toMs(x.start) <= tm && (x.end === null || tm < toMs(x.end));
    });
    var busy = {};
    stopped.forEach(function (x) { busy[x.id] = true; });
    var list = partners.filter(function (p) { return !busy[p.id]; });
    return { inRange: true, stopped: stopped, none: { count: list.length, partners: list }, oldestChecked: oldest };
  }

  // 配る JSON の文字列（末尾に改行 1 つ）
  var toJson = function (doc) { return JSON.stringify(doc, null, 2) + '\n'; };

  var api = { STALE_MIN: STALE_MIN, DAYS: DAYS, build: build, at: at, isOld: isOld, toJson: toJson };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InfraBoard = api;
})(typeof window !== 'undefined' ? window : this);
