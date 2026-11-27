// ストップボードの暦の芯 tools/common/calc/infra-koyomi.js のテスト（yorozu-plans QUEUE Q-1035）
// 区間は合成（実在の相手の値ではない）。外の口に要求を出さない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const K = require(fileURLToPath(new URL('../tools/common/calc/infra-koyomi.js', import.meta.url)));

const sum = (a) => a.reduce((x, y) => x + y, 0);
const hoursOf = (grid, date) => grid.find((d) => d.date === date).hours;

test('dayGrid: 1 時間の中の区間は、その升に分の数', () => {
  const g = K.dayGrid([{ start: '2026-11-10T10:15+09:00', end: '2026-11-10T10:45+09:00' }], '2026-11-10T00:00+09:00', '2026-11-11T00:00+09:00');
  assert.equal(g.length, 1);
  assert.equal(g[0].date, '2026-11-10');
  assert.equal(g[0].hours[10], 30);
  assert.equal(sum(g[0].hours), 30);
});

test('dayGrid: 日をまたぐ区間は日ごとに割る（UTC の時刻でも JST の日で）', () => {
  // JST 11/10 23:30 〜 11/11 01:20（UTC で書く）
  const g = K.dayGrid([{ start: '2026-11-10T14:30:00.000Z', end: '2026-11-10T16:20:00.000Z' }], '2026-11-10T00:00+09:00', '2026-11-12T00:00+09:00');
  assert.deepEqual(g.map((d) => d.date), ['2026-11-10', '2026-11-11']);
  assert.equal(hoursOf(g, '2026-11-10')[23], 30);
  assert.equal(sum(hoursOf(g, '2026-11-10')), 30);
  assert.equal(hoursOf(g, '2026-11-11')[0], 60);
  assert.equal(hoursOf(g, '2026-11-11')[1], 20);
  assert.equal(sum(hoursOf(g, '2026-11-11')), 80);
});

test('dayGrid: 終わっていない区間は to まで', () => {
  const g = K.dayGrid([{ start: '2026-11-10T22:10+09:00', end: null }], '2026-11-10T00:00+09:00', '2026-11-11T02:30+09:00');
  assert.deepEqual(g.map((d) => d.date), ['2026-11-10', '2026-11-11']);
  assert.equal(hoursOf(g, '2026-11-10')[22], 50);
  assert.equal(hoursOf(g, '2026-11-10')[23], 60);
  assert.equal(hoursOf(g, '2026-11-11')[1], 60);
  assert.equal(hoursOf(g, '2026-11-11')[2], 30);
  assert.equal(sum(hoursOf(g, '2026-11-11')), 150);
});

test('dayGrid: 重なる 2 つの区間の分を二重に数えない', () => {
  const g = K.dayGrid([
    { start: '2026-11-10T10:00+09:00', end: '2026-11-10T10:40+09:00' },
    { start: '2026-11-10T10:20+09:00', end: '2026-11-10T11:10+09:00' },
  ], '2026-11-10T00:00+09:00', '2026-11-11T00:00+09:00');
  assert.equal(g[0].hours[10], 60);
  assert.equal(g[0].hours[11], 10);
  assert.equal(sum(g[0].hours), 70);
});

test('dayGrid: from・to の外は数えない、区間の無い日も並ぶ、置かない区間は落とす', () => {
  const g = K.dayGrid([
    { start: '2026-11-09T23:00+09:00', end: '2026-11-10T00:30+09:00' },   // from の前から
    { start: '2026-11-12T23:50+09:00', end: '2026-11-13T05:00+09:00' },   // to の後まで
    { start: 'きのう', end: null },                                       // 読めない
    { start: '2026-11-11T10:00+09:00', end: '2026-11-11T09:00+09:00' },   // 終わりが始まり以前
  ], '2026-11-10T00:00+09:00', '2026-11-13T00:00+09:00');
  assert.deepEqual(g.map((d) => d.date), ['2026-11-10', '2026-11-11', '2026-11-12']);
  assert.equal(sum(hoursOf(g, '2026-11-10')), 30);
  assert.equal(sum(hoursOf(g, '2026-11-11')), 0);
  assert.equal(sum(hoursOf(g, '2026-11-12')), 10);
  assert.throws(() => K.dayGrid([], '2026-11-10T00:00+09:00', '2026-11-10T00:00+09:00'));
  assert.throws(() => K.dayGrid([], 'x', '2026-11-10T00:00+09:00'));
});

test('dayGrid: 秒は始まりを切り捨て・終わりを切り上げて分に', () => {
  const g = K.dayGrid([{ start: '2026-11-10T01:00:40.123Z', end: '2026-11-10T01:00:50.000Z' }], '2026-11-10T00:00+09:00', '2026-11-11T00:00+09:00');
  assert.equal(g[0].hours[10], 1);
});

// 区間を n 個（11/2〈月〉から 1 日 1 つ、JST 9:30〜9:45）
const many = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, 2 + i));
  const day = d.toISOString().slice(0, 10);
  return { start: `${day}T09:30+09:00`, end: `${day}T09:45+09:00` };
});

test('weekGrid: 区間 19 は null、20 は升', () => {
  assert.equal(K.WEEK_MIN_COUNT, 20);
  assert.equal(K.weekGrid(many(19)), null);
  const g = K.weekGrid(many(20));
  assert.equal(g.length, 7);
  g.forEach((row) => assert.equal(row.length, 24));
  assert.equal(sum(g.map(sum)), 20);
  // 11/2〈月〉〜11/21〈土〉の 20 日: 月〜土が 3 回、日が 2 回。どれも 9 時の升
  assert.deepEqual(g.map((row) => row[9]), [2, 3, 3, 3, 3, 3, 3]);
});

test('weekGrid: 曜日と時は JST の始まりで。置かない区間は 20 に数えない', () => {
  const xs = many(19).concat([{ start: '2026-11-07T15:30:00.000Z', end: null }]);   // JST 11/8〈日〉0:30、終わっていない
  const g = K.weekGrid(xs);
  assert.equal(g[0][0], 1);
  assert.equal(K.weekGrid(many(19).concat([{ start: 'x', end: null }])), null);
});

test('monthTable: 月をまたぐ区間は、回数は始まった月、分は月ごとに割る', () => {
  const t = K.monthTable([
    { start: '2026-10-31T23:00+09:00', end: '2026-11-01T01:30+09:00' },
    { start: '2026-11-05T10:00+09:00', end: '2026-11-05T10:20+09:00' },
  ]);
  assert.deepEqual(t, [
    { month: '2026-10', count: 1, minutes: 60 },
    { month: '2026-11', count: 1, minutes: 110 },
  ]);
});

test('monthTable: 重なる 2 つの区間の分を二重に数えない（回数は 2）', () => {
  const t = K.monthTable([
    { start: '2026-11-05T10:00+09:00', end: '2026-11-05T11:00+09:00' },
    { start: '2026-11-05T10:30+09:00', end: '2026-11-05T11:30+09:00' },
  ]);
  assert.deepEqual(t, [{ month: '2026-11', count: 2, minutes: 90 }]);
});

test('monthTable: 終わっていない区間は to まで、to が無ければ Error', () => {
  const xs = [{ start: '2026-11-30T23:00+09:00', end: null }];
  assert.deepEqual(K.monthTable(xs, '2026-12-01T00:45+09:00'), [
    { month: '2026-11', count: 1, minutes: 60 },
    { month: '2026-12', count: 0, minutes: 45 },
  ]);
  assert.throws(() => K.monthTable(xs));
});

test('monthTable: 間の何も無い月は 0 で並ぶ、年をまたぐ、区間が無ければ空', () => {
  const t = K.monthTable([
    { start: '2026-11-05T10:00+09:00', end: '2026-11-05T10:10+09:00' },
    { start: '2027-02-01T00:00+09:00', end: '2027-02-01T00:05+09:00' },
  ]);
  assert.deepEqual(t.map((r) => r.month), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.deepEqual(t.map((r) => r.count), [1, 0, 0, 1]);
  assert.deepEqual(t.map((r) => r.minutes), [10, 0, 0, 5]);
  assert.deepEqual(K.monthTable([]), []);
});

test('dayGrid と monthTable の分の合計がそろう', () => {
  const xs = [
    { start: '2026-10-31T22:00+09:00', end: '2026-11-01T03:00+09:00' },
    { start: '2026-11-01T02:00+09:00', end: '2026-11-01T04:10+09:00' },
    { start: '2026-11-03T12:00:30.000Z', end: '2026-11-03T13:00:10.000Z' },
  ];
  const g = K.dayGrid(xs, '2026-10-01T00:00+09:00', '2026-12-01T00:00+09:00');
  const t = K.monthTable(xs);
  assert.equal(sum(g.map((d) => sum(d.hours))), sum(t.map((r) => r.minutes)));
});
