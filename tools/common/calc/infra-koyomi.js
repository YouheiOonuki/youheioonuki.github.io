// ===========================
// ストップボードの暦の芯（純粋関数）: 相手 1 つの区間の並びから、日 × 時刻の升・曜日 × 時間帯の升・月の回数と時間を作る
// yorozu-plans QUEUE Q-1035、D801。企画書 117 の 1・9
// 外の口に要求を出さない。ほかのファイルは teishi.js（Q-770）だけを使う（ブラウザでは先に teishi.js を読む）
// ブラウザでは window.InfraKoyomi、Node（テスト）では module.exports で使う
// 画面・R2 にはまだ繋いでいない（CALC の表に配り先が無い。繋ぐのは企画書 117 の枝 3）
//
// 区間: { start, end } の並び（ほかの欄は読まない）。yorozu-cron の D1 の infra_interval と同じ形で、時刻は ISO（秒の小数・時差つきも読む）
//   end が null・undefined … 終わっていない区間
//   置かない区間（どこにも数えない）: start が読めない・end が読めない・end が start 以前
//   どの区間を渡すか（障害だけか、予定メンテナンスも含めるか）は呼ぶ側が決める。ここでは kind で絞らない
// 分の数え方: 区間の始まりは分に切り捨て、終わりは分に切り上げる（1 分に満たない区間も 1 分に出る）。
//   重なる区間は、和（どこかの区間が掛かっている分）で数える。同じ分を二重に数えない
// 日・月・曜日・時刻はどれも日本時間（JST）
// ===========================
(function (root) {
  'use strict';

  var T = (typeof module !== 'undefined' && module.exports) ? require('./teishi.js') : root.Teishi;

  var MIN = 60000;
  var HOUR = 60 * MIN;
  var DAY = 24 * HOUR;
  var JST = 9 * HOUR;
  var WEEK_MIN_COUNT = 20;   // 曜日 × 時間帯の升は、区間がこの数に満たない時は出さない（D801。少ない数から傾向を読ませない）

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  // 日時 → ミリ秒。teishi.js の読み方に、秒の小数（yorozu-cron の toISOString の形）を足す。読めなければ null
  function toMs(v) {
    if (typeof v === 'string') v = v.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d+(Z|[+-]\d{2}:\d{2})$/, '$1$2');
    return T.toMs(v);
  }
  function mustMs(v, what) { var m = toMs(v); if (m === null) throw new Error(what + 'が読めない: ' + v); return m; }

  var floorMin = function (ms) { return Math.floor(ms / MIN) * MIN; };
  var ceilMin = function (ms) { return Math.ceil(ms / MIN) * MIN; };
  var jstDate = function (ms) { return new Date(ms + JST); };
  var dayStart = function (ms) { return Math.floor((ms + JST) / DAY) * DAY - JST; };
  var dateOf = function (ms) { var d = jstDate(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  var monthOf = function (ms) { var d = jstDate(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
  // その月の次の月の 1 日 0 時（JST）
  var nextMonth = function (ms) { var d = jstDate(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - JST; };

  // 区間を読む。置かない区間は落とす。end が null なら open: true（e は null）
  function read(intervals) {
    var out = [];
    (Array.isArray(intervals) ? intervals : []).forEach(function (x) {
      if (!x) return;
      var s = toMs(x.start);
      if (s === null) return;
      if (x.end === null || x.end === undefined) { out.push({ s: s, e: null }); return; }
      var e = toMs(x.end);
      if (e === null || e <= s) return;
      out.push({ s: s, e: e });
    });
    return out;
  }

  // 区間（e が null なら until まで）を [lo, hi) に切り、分にそろえて、重なりを和にした並び（始まりの順）
  function union(spans, lo, hi, until) {
    var cut = [];
    spans.forEach(function (a) {
      var s = Math.max(floorMin(a.s), lo);
      var e = Math.min(a.e === null ? until : ceilMin(a.e), hi);
      if (e > s) cut.push({ s: s, e: e });
    });
    cut.sort(function (a, b) { return a.s - b.s || a.e - b.e; });
    var merged = [];
    cut.forEach(function (a) {
      var last = merged[merged.length - 1];
      if (last && a.s <= last.e) { if (a.e > last.e) last.e = a.e; }
      else merged.push({ s: a.s, e: a.e });
    });
    return merged;
  }

  // 和の区間を、step の境目（next(ms) が次の境目を返す）で割って、境目ごとに分を足す
  function spread(merged, keyOf, next, add) {
    merged.forEach(function (a) {
      var t = a.s;
      while (t < a.e) {
        var b = Math.min(next(t), a.e);
        add(keyOf(t), (b - t) / MIN);
        t = b;
      }
    });
  }

  // (1) 日 × 時刻の升。[from, to) の日（JST）ごとに、1 時間の升 24 個に、障害の在った分の数
  //   日をまたぐ区間は日ごとに割る。終わっていない区間は to まで。from より前・to 以後の分は数えない
  //   返り値: [{ date: 'YYYY-MM-DD', hours: [24 個の分の数] }]。from の日から to の直前の日まで、区間の無い日も並べる（日の順）
  function dayGrid(intervals, from, to) {
    var f = mustMs(from, 'from'), u = mustMs(to, 'to');
    if (u <= f) throw new Error('to が from 以前: ' + from + ' 〜 ' + to);
    var days = [], index = {};
    for (var d = dayStart(f); d < u; d += DAY) {
      index[dateOf(d)] = days.length;
      days.push({ date: dateOf(d), hours: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    }
    spread(union(read(intervals), f, u, u),
      function (t) { return dateOf(t) + ' ' + jstDate(t).getUTCHours(); },
      function (t) { return Math.floor(t / HOUR) * HOUR + HOUR; },   // JST は UTC から 9 時間ちょうどずれるので、時の境目は UTC と同じ
      function (key, m) { var p = key.split(' '); days[index[p[0]]].hours[+p[1]] += m; });
    return days;
  }

  // (2) 曜日 × 時間帯の升。区間の始まりの曜日（JST）と時（JST）の升に、区間の数を 1 つずつ（升の合計は区間の数）
  //   区間が WEEK_MIN_COUNT に満たない時は null
  //   返り値: 7 行（0 が日曜。Date#getDay と同じ順）× 24 列（0 時〜23 時）の数の並び
  function weekGrid(intervals) {
    var spans = read(intervals);
    if (spans.length < WEEK_MIN_COUNT) return null;
    var grid = [];
    for (var w = 0; w < 7; w++) grid.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    spans.forEach(function (a) { var d = jstDate(a.s); grid[d.getUTCDay()][d.getUTCHours()] += 1; });
    return grid;
  }

  // (3) 月ごとの回数と合計の分。回数は区間が始まった月に 1 つ。分は月ごとに割り、重なりは和で数える
  //   終わっていない区間は to まで（to が無ければ Error）
  //   返り値: [{ month: 'YYYY-MM', count, minutes }]。いちばん早い月からいちばん遅い月まで、間の何も無い月も 0 で並べる（月の順）。区間が無ければ []
  function monthTable(intervals, to) {
    var spans = read(intervals);
    if (!spans.length) return [];
    var open = spans.some(function (a) { return a.e === null; });
    var u = (to === undefined || to === null) ? null : mustMs(to, 'to');
    if (open && u === null) throw new Error('終わっていない区間があるので、to が要る');
    var counts = {}, minutes = {};
    spans.forEach(function (a) { var k = monthOf(a.s); counts[k] = (counts[k] || 0) + 1; });
    var lo = Math.min.apply(null, spans.map(function (a) { return floorMin(a.s); }));
    var hi = Math.max.apply(null, spans.map(function (a) { return a.e === null ? u : ceilMin(a.e); }));
    spread(union(spans, lo, hi, u === null ? hi : u), monthOf, nextMonth,
      function (k, m) { minutes[k] = (minutes[k] || 0) + m; });
    var keys = Object.keys(counts).concat(Object.keys(minutes)).sort();
    var rows = [];
    for (var t = Date.UTC(+keys[0].slice(0, 4), +keys[0].slice(5, 7) - 1, 1) - JST, last = keys[keys.length - 1]; monthOf(t) <= last; t = nextMonth(t)) {
      var k = monthOf(t);
      rows.push({ month: k, count: counts[k] || 0, minutes: minutes[k] || 0 });
    }
    return rows;
  }

  var api = { WEEK_MIN_COUNT: WEEK_MIN_COUNT, dayGrid: dayGrid, weekGrid: weekGrid, monthTable: monthTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.InfraKoyomi = api;
})(typeof window !== 'undefined' ? window : this);
