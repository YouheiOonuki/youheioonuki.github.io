// ===========================
// 止まる予定の暦（K248）の芯（純粋関数）: 台帳の決まった休止の規則と臨時の区間から、これからの止まる区間と、ある日時に止まっている物を出す
// yorozu-plans QUEUE Q-770・D602・D606〜D609・D484。企画書 113 の 14.2・15.2
// 時刻はすべて日本時間（JST、+09:00。夏時間は無い）。外の口に要求を出さない。ほかのファイルを読まない（祝日の表も読まない）
// ブラウザでは window.Teishi、Node（テスト）では module.exports で使う
//
// 台帳は行の並び（または infra-dashboard の data/targets.json の形 { targets: [...] }）。欄の名前は台帳が正（D630。写して合わせる層を置かない）。1 行の欄（企画書 113 の 15.2）:
//   id      相手の識別子（台帳の中で 1 つ）
//   name    相手の名前（載せる時の呼び名）
//   column  列: 'shigoto' | 'kurashi'
//   field   分野（15.3 の表の名前）
//   scope   範囲: 'world' | 'national' | 'regional'（拠点の値は持たない）
//   country 国: 'global' | 国の 2 文字（'JP'）
//   region  地域（scope が 'regional' の時だけ。ほかは null か欄なし）
//   mode    載せ方: 'auto'（機械で読む）| 'ledger'（台帳で予定を出す）| 'link'（リンクだけ）
//   stops   止まる物の名前（1 相手 2 つまで。規則・臨時の区間の無い相手は空でよい）
//   page    公式のページ（https）
//   source  読み方 { method, urls, every? }（ここでは見ない。every の線は配る側〈infra-board.js〉）
//   checked 確認: 'ledger' は最後に確かめた日 'YYYY-MM-DD'。'link' はその日か null。'auto' は最後に読めた時刻（ここでは見ない）
//   rules   決まった休止の規則（下の 4 つの形）
//   extra   臨時の区間 [{ service, start: 'YYYY-MM-DDTHH:MM', end: 'YYYY-MM-DDTHH:MM' }]（JST。+09:00 を付けてもよい）
//   規則と臨時の区間は、任意の欄 limited（true は「止まる」でなく「一部が使えない」。D631）を持てる。出す区間まで運ぶ
//
// 規則の形 4 つ（from・to は 'hh:mm'。to が from 以下なら翌日に終わる。to は '24:00' も可）:
//   毎日            { service, every: 'day', from, to }
//   毎週 何曜       { service, every: 'week', dow, from, to }            dow: 0 = 日曜 〜 6 = 土曜
//   毎月 第 n 何曜  { service, every: 'month', nth, dow, from, to }      nth: 1〜5（第 5 の無い月は出ない）
//   毎月 n 日       { service, every: 'month', day, from, to }           day: 1〜31（その日の無い月は出ない。2 月 29 日はうるう年だけ）
// 祝日で規則が変わる相手は、規則に持たせず臨時の区間で足す。
// 同じ相手・同じ止まる物の区間が重なるか接する時は 1 つにまとめる（kind: 'rule' | 'extra' | 'mixed'。limited は、まとめた全部が limited の時だけ true）。
// 区間は始まりを含み、終わりを含まない（終わりちょうどは止まっていない側）。
// ===========================
(function (root) {
  'use strict';

  var MIN = 60000;
  var DAY = 86400000;
  var JST = 9 * 60 * MIN;
  var DAYS = 60;          // 出す区間の長さ（日）
  var STALE_DAYS = 8;     // 確かめた日がこれより古い 'ledger' の相手は予定を出さない（D602 の (5)）
  var MODES = ['auto', 'ledger', 'link'];
  var COLUMNS = ['shigoto', 'kurashi'];
  var SCOPES = ['world', 'national', 'regional'];

  var rowsOf = function (ledger) { return Array.isArray(ledger) ? ledger : (ledger && Array.isArray(ledger.targets) ? ledger.targets : []); };
  var stopsOf = function (row) { return Array.isArray(row.stops) ? row.stops : []; };
  var limitedProblem = function (x) { return x.limited === undefined || typeof x.limited === 'boolean' ? null : 'limited が true・false でない'; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  // 'hh:mm' → 分。'24:00' は to の時だけ。読めなければ null
  function minutesOf(s, allow24) {
    var m = /^(\d{2}):(\d{2})$/.exec(String(s));
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (mi > 59) return null;
    if (h === 24 && mi === 0 && allow24) return 1440;
    if (h > 23) return null;
    return h * 60 + mi;
  }

  // 日時 → ミリ秒（UTC の基点から）。数・Date・ISO の文字列（時差が無ければ JST と読む）。読めなければ null
  function toMs(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v instanceof Date) return isFinite(v.getTime()) ? v.getTime() : null;
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?$/.exec(String(v));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = m[6] ? +m[6] : 0;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
    var base = Date.UTC(y, mo - 1, d, h, mi, s);
    if (new Date(base).getUTCDate() !== d) return null;   // 2 月 30 日などは読まない
    var off = JST;
    if (m[7] === 'Z') off = 0;
    else if (m[7]) off = (m[7][0] === '-' ? -1 : 1) * (+m[7].slice(1, 3) * 60 + +m[7].slice(4, 6)) * MIN;
    return base - off;
  }

  // ミリ秒 → 'YYYY-MM-DDTHH:MM+09:00'
  function toJst(ms) {
    var d = new Date(ms + JST);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
      'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + '+09:00';
  }

  // JST の日付の 0 時（ミリ秒）
  var dayStart = function (ms) { return Math.floor((ms + JST) / DAY) * DAY - JST; };

  // 'YYYY-MM-DD' → その日の JST の 0 時。読めなければ null
  function dateMs(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) return null;
    var base = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if (new Date(base).getUTCDate() !== +m[3]) return null;
    return base - JST;
  }

  // 規則 1 つの誤り（無ければ null）
  function ruleProblem(row, r) {
    if (!r || typeof r !== 'object') return '規則が物でない';
    if (stopsOf(row).indexOf(r.service) < 0) return '規則の止まる物が stops に無い: ' + r.service;
    if (limitedProblem(r)) return limitedProblem(r);
    var f = minutesOf(r.from, false), t = minutesOf(r.to, true);
    if (f === null || t === null) return '規則の時刻が hh:mm でない';
    if (f === t) return '規則の始まりと終わりが同じ';
    var isDow = function (x) { return Number.isInteger(x) && x >= 0 && x <= 6; };
    if (r.every === 'day') return null;
    if (r.every === 'week') return isDow(r.dow) ? null : '毎週の dow が 0〜6 でない';
    if (r.every === 'month') {
      if (r.day !== undefined) return (r.nth === undefined && Number.isInteger(r.day) && r.day >= 1 && r.day <= 31) ? null : '毎月の day が 1〜31 でない';
      return (Number.isInteger(r.nth) && r.nth >= 1 && r.nth <= 5 && isDow(r.dow)) ? null : '毎月の nth が 1〜5 か dow が 0〜6 でない';
    }
    return '規則の every が day・week・month でない';
  }

  function extraProblem(row, x) {
    if (!x || typeof x !== 'object') return '臨時の区間が物でない';
    if (stopsOf(row).indexOf(x.service) < 0) return '臨時の区間の止まる物が stops に無い: ' + x.service;
    if (limitedProblem(x)) return limitedProblem(x);
    var s = toMs(x.start), e = toMs(x.end);
    if (s === null || e === null) return '臨時の区間の日時が読めない';
    if (e <= s) return '臨時の区間の終わりが始まり以前';
    return null;
  }

  // 台帳の検査: [{ id, problem }]。誤りの在る規則・区間は、ほかの関数では飛ばす
  function validate(ledger) {
    var out = [], ids = {};
    rowsOf(ledger).forEach(function (row, i) {
      var id = row && row.id !== undefined ? row.id : '#' + i;
      var add = function (p) { if (p) out.push({ id: id, problem: p }); };
      if (!row || typeof row !== 'object') { add('行が物でない'); return; }
      if (typeof row.id !== 'string' || !row.id) add('id が無い');
      else if (ids[row.id]) add('id が重なる'); else ids[row.id] = true;
      if (typeof row.name !== 'string' || !row.name) add('name が無い');
      if (COLUMNS.indexOf(row.column) < 0) add('column が shigoto・kurashi でない');
      if (SCOPES.indexOf(row.scope) < 0) add('scope が world・national・regional でない');
      if (typeof row.country !== 'string' || !/^(global|[A-Z]{2})$/.test(row.country)) add('country が global か国の 2 文字でない');
      if (row.scope === 'regional' ? !row.region : (row.region !== undefined && row.region !== null)) add('region は scope が regional の時だけ');
      if (MODES.indexOf(row.mode) < 0) add('mode が auto・ledger・link でない');
      if (!Array.isArray(row.stops) || row.stops.length > 2) add('stops は 0〜2 つ');
      if (typeof row.page !== 'string' || !/^https:\/\//.test(row.page)) add('page が https でない');
      if (row.mode === 'ledger' ? dateMs(row.checked) === null : (row.mode === 'link' && row.checked !== null && row.checked !== undefined && dateMs(row.checked) === null)) add('checked が YYYY-MM-DD でない');
      if (row.mode === 'link' && ((row.rules || []).length || (row.extra || []).length)) add('link の相手が規則か区間を持つ');
      (row.rules || []).forEach(function (r) { add(ruleProblem(row, r)); });
      (row.extra || []).forEach(function (x) { add(extraProblem(row, x)); });
    });
    return out;
  }

  // 規則 1 つの、日 day0（JST の 0 時）に始まる区間（無ければ null）
  function ruleOn(r, day0) {
    var d = new Date(day0 + JST);
    var dow = d.getUTCDay(), date = d.getUTCDate();
    if (r.every === 'week' && dow !== r.dow) return null;
    if (r.every === 'month') {
      if (r.day !== undefined) { if (date !== r.day) return null; }
      else if (dow !== r.dow || Math.ceil(date / 7) !== r.nth) return null;
    }
    var f = minutesOf(r.from, false), t = minutesOf(r.to, true);
    var s = day0 + f * MIN, e = day0 + t * MIN;
    if (t <= f) e += DAY;
    return [s, e];
  }

  // 1 相手の区間（まとめた後）。[from, until) に掛かる物
  function rowSpans(row, from, until) {
    var raw = [];
    (row.rules || []).forEach(function (r) {
      if (ruleProblem(row, r)) return;
      // 規則 1 回の長さは 24 時間以下なので、前の日から作れば from に掛かる回を落とさない
      for (var day0 = dayStart(from) - DAY; day0 < until; day0 += DAY) {
        var se = ruleOn(r, day0);
        if (se) raw.push({ service: r.service, s: se[0], e: se[1], kind: 'rule', limited: r.limited === true });
      }
    });
    (row.extra || []).forEach(function (x) {
      if (extraProblem(row, x)) return;
      raw.push({ service: x.service, s: toMs(x.start), e: toMs(x.end), kind: 'extra', limited: x.limited === true });
    });
    var out = [];
    stopsOf(row).forEach(function (svc, si) {
      var list = raw.filter(function (a) { return a.service === svc; }).sort(function (a, b) { return a.s - b.s || a.e - b.e; });
      var cur = null;
      list.forEach(function (a) {
        if (cur && a.s <= cur.e) {   // 重なるか接する → 1 つに
          if (a.e > cur.e) cur.e = a.e;
          if (a.kind !== cur.kind) cur.kind = 'mixed';
          cur.limited = cur.limited && a.limited;
        } else { cur = { service: svc, si: si, s: a.s, e: a.e, kind: a.kind, limited: a.limited }; out.push(cur); }
      });
    });
    return out.filter(function (a) { return a.e > from && a.s < until; });
  }

  // 相手を「予定を出す」と「出さない」（link・確かめた日が 8 日より古い ledger）に分ける。now は判断の時刻
  // shown は 'auto' と確かめた 'ledger'（止まる物の無い相手も入る。区間は出ない）
  function split(ledger, now) {
    var nowMs = toMs(now), today = dayStart(nowMs);
    var shown = [], link = [], stale = [];
    rowsOf(ledger).forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      if (row.mode === 'link') { link.push(row); return; }
      if (row.mode === 'ledger') {
        var c = dateMs(row.checked);
        if (c === null || (today - c) / DAY > STALE_DAYS) { stale.push(row); return; }
      }
      shown.push(row);
    });
    return { shown: shown, link: link, stale: stale };
  }

  var nowOf = function (opts, t) { return opts && opts.now !== undefined ? opts.now : t; };

  function spanOut(row, a) {
    return { id: row.id, name: row.name, column: row.column, service: a.service, start: toJst(a.s), end: toJst(a.e),
      kind: a.kind, limited: a.limited, url: row.page, checked: row.checked };
  }

  // 並びの順: 始まり → 台帳の行の順 → 止まる物の順
  function collect(rows, from, until) {
    var all = [];
    rows.forEach(function (row, ri) {
      rowSpans(row, from, until).forEach(function (a) { all.push({ row: row, ri: ri, a: a }); });
    });
    all.sort(function (p, q) { return p.a.s - q.a.s || p.ri - q.ri || p.a.si - q.a.si; });
    return all;
  }

  // (a) from から days 日（既定 60）に掛かる区間の並び（始まる順）。from の時点で続いている区間も入る
  //     opts.now: 確かめた日の古さを測る時刻（既定は from）。opts.days
  function upcoming(ledger, from, opts) {
    var f = toMs(from); if (f === null) throw new Error('日時が読めない: ' + from);
    var days = opts && opts.days !== undefined ? opts.days : DAYS;
    return collect(split(ledger, nowOf(opts, from)).shown, f, f + days * DAY).map(function (p) { return spanOut(p.row, p.a); });
  }

  // (b) 日時 t に止まっている物の並び（始まり ≤ t < 終わり）。t は「いま」でも先の日時でもよい。opts.now は (a) と同じ
  function stoppedAt(ledger, t, opts) {
    var tm = toMs(t); if (tm === null) throw new Error('日時が読めない: ' + t);
    return collect(split(ledger, nowOf(opts, t)).shown, tm, tm + 1)
      .filter(function (p) { return p.a.s <= tm; })
      .map(function (p) { return spanOut(p.row, p.a); });
  }

  // (c) 相手ごとの「次に止まる」（from より後に始まる最初の区間。days 日の中に無ければ null）。台帳の行の順
  //     規則か臨時の区間を持つ相手は、stops が 0 でも並べる（止まる物の名前は空で、next は null）。規則も臨時の区間も無い相手は並べない（D642）
  function nextStops(ledger, from, opts) {
    var f = toMs(from); if (f === null) throw new Error('日時が読めない: ' + from);
    var days = opts && opts.days !== undefined ? opts.days : DAYS;
    return split(ledger, nowOf(opts, from)).shown.filter(function (row) { return (row.rules || []).length || (row.extra || []).length; }).map(function (row) {
      var n = collect([row], f, f + days * DAY).filter(function (p) { return p.a.s > f; })[0];
      return { id: row.id, name: row.name, next: n ? spanOut(row, n.a) : null };
    });
  }

  // (d) 予定を出さない相手（link・古い）と、確かめた 'ledger' の相手のうち now から days 日に区間が 1 つも無い相手（発表なし）。名前は台帳の行の順
  //     'auto' の相手は「発表なし」に数えない（更新できているかは読めた時刻で決まり、ここでは見ない。配る側〈infra-board.js〉が数える）
  function summary(ledger, now, opts) {
    var n = toMs(now); if (n === null) throw new Error('日時が読めない: ' + now);
    var days = opts && opts.days !== undefined ? opts.days : DAYS;
    var sp = split(ledger, now);
    var names = function (rows) { return rows.map(function (r) { return r.name; }); };
    var none = sp.shown.filter(function (row) { return row.mode === 'ledger' && !rowSpans(row, n, n + days * DAY).length; });
    return {
      link: { count: sp.link.length, names: names(sp.link) },
      stale: { count: sp.stale.length, names: names(sp.stale) },
      none: { count: none.length, names: names(none) }
    };
  }

  var api = { DAYS: DAYS, STALE_DAYS: STALE_DAYS, rowsOf: rowsOf, validate: validate, split: split, upcoming: upcoming,
    stoppedAt: stoppedAt, nextStops: nextStops, summary: summary, toMs: toMs, toJst: toJst };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Teishi = api;
})(typeof window !== 'undefined' ? window : this);
