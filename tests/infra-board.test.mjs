// インフラダッシュボードの配る形の芯 tools/common/calc/infra-board.js のテスト（yorozu-plans QUEUE Q-771）
// 相手の一覧も区間も合成（相手の名前・題・URL は作った物。実在の相手の値ではない）。外の口に要求を出さない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SRC = fileURLToPath(new URL('../tools/common/calc/infra-board.js', import.meta.url));
const B = require(SRC);
const T = require(fileURLToPath(new URL('../tools/common/calc/teishi.js', import.meta.url)));

const NOW = '2026-11-24T03:00';            // 火曜 3 時（JST）
const NOW_Z = '2026-11-23T18:00:00.000Z';  // 同じ時刻（UTC）
const READ = '2026-11-23T17:55:00.000Z';   // 5 分前に読めた
const base = { scope: 'world', country: 'global', field: '業務の SaaS', column: 'shigoto', mode: 'auto', checked: READ };
const auto = (id, name) => ({ ...base, id, name, services: ['全体'], source: { url: `https://status.example.com/${id}`, how: 'api' } });
const kurashi = (o) => ({ column: 'kurashi', field: '銀行', scope: 'national', country: 'JP', mode: 'ledger', checked: '2026-11-19',
  source: { url: `https://example.invalid/${o.id}`, how: '公式のページを開く' }, rules: [], extra: [], ...o });

const SA = auto('sa', '相手 A');
const SB = auto('sb', '相手 B');
const SC = auto('sc', '相手 C');
const SM = { ...auto('sm', '相手 M'), mode: 'link', checked: '2026-11-20' };            // しごとのリンクだけ
const KA = kurashi({ id: 'ka', name: '相手 K', services: ['ネットバンキング', 'ATM'],
  rules: [{ service: 'ATM', every: 'day', from: '23:30', to: '05:00' }],
  extra: [{ service: 'ネットバンキング', start: '2026-11-28T00:00', end: '2026-11-28T06:00' }] });
const KN = kurashi({ id: 'kn', name: '相手 N', services: ['ATM'] });                    // 予定なし
const KO = kurashi({ id: 'ko', name: '相手 O', checked: '2026-11-15', services: ['ATM'],  // 9 日前 → 古い
  rules: [{ service: 'ATM', every: 'day', from: '00:00', to: '06:00' }] });
const KL = kurashi({ id: 'kl', name: '相手 L', mode: 'link', services: ['ATM'] });
const PARTNERS = [SA, SB, SC, SM, KA, KN, KO, KL];

// 止まる予定（Q-770 の出力）。古い KO・リンクだけの KL の分も、わざと混ぜる
const teishi = T.upcoming([KA, KN, KO, KL].map(r => ({ ...r, checked: '2026-11-19', mode: 'ledger' })), NOW);
// 障害と予定メンテナンス（yorozu-cron の Q-739・Q-777・Q-779 の形。時刻は UTC）
const inc = (o) => ({ id: 'i1', start: '2026-11-23T17:00:00.000Z', end: null, impact: 'major', title: '作った題', url: 'https://status.example.com/i/1', ...o });
const SPANS_BUSY = [
  inc({ service: 'sa', id: 'a1', start: '2026-11-23T17:00:00.000Z', impact: 'major' }),                                   // Q-739: kind 無し
  inc({ service: 'sb', id: 'b1', start: '2026-11-23T16:00:00.000Z', end: '2026-11-23T20:00:00.000Z', impact: 'minor', kind: 'planned' }), // Q-777
  ...teishi,
];

const build = (spans, o = {}) => B.build(o.partners ?? PARTNERS, spans, o.now ?? NOW, 'ing' in o ? o.ing : NOW_Z);

test('何も止まっていない: stopped は空で nothing が真。区間の無い相手は「予定なし」、取り込みの時刻を持つ', () => {
  const { now, ahead } = build(teishi, { now: '2026-11-24T12:00', ing: '2026-11-24T11:58' });
  assert.deepEqual(now.stopped, []);
  assert.equal(now.nothing, true);
  assert.equal(now.ingestOld, false);
  assert.equal(now.ingestedAt, '2026-11-24T11:58+09:00');
  // sa・sb・sc は 5 分前でなく 12 時から見て 9 時間前に読めた → 確かめられていない
  assert.deepEqual(now.unconfirmed.map(p => p.id), ['sa', 'sb', 'sc', 'sm', 'ko', 'kl']);
  assert.deepEqual(now.none, { count: 1, partners: [{ id: 'kn', name: '相手 N', column: 'kurashi', url: 'https://example.invalid/kn', checked: '2026-11-19' }] });
  assert.equal(ahead.items[0].start, '2026-11-24T23:30+09:00');
});

test('同時に 3 つ: 重い順（major → minor → 欄の無い止まる予定は unknown）、同じ重さは始まりの早い順', () => {
  const { now } = build(SPANS_BUSY);
  assert.equal(now.nothing, false);
  assert.deepEqual(now.stopped.map(x => [x.id, x.kind, x.impact]), [['sa', 'incident', 'major'], ['sb', 'planned', 'minor'], ['ka', 'planned', 'unknown']]);
  assert.deepEqual(now.stopped[0], { id: 'sa', name: '相手 A', column: 'shigoto', service: null, title: '作った題', kind: 'incident', impact: 'major',
    start: '2026-11-24T02:00+09:00', end: null, url: 'https://status.example.com/i/1', checked: null });
  assert.deepEqual(now.stopped[2], { id: 'ka', name: '相手 K', column: 'kurashi', service: 'ATM', title: null, kind: 'planned', impact: 'unknown',
    start: '2026-11-23T23:30+09:00', end: '2026-11-24T05:00+09:00', url: 'https://example.invalid/ka', checked: '2026-11-19' });
  // 同じ重さ（minor）: sc の障害は 0 時から、sb の予定メンテナンスは 1 時から → sc が先
  const more = build([...SPANS_BUSY, inc({ service: 'sc', id: 'c1', start: '2026-11-23T15:00:00Z', impact: 'minor' })]).now;
  assert.deepEqual(more.stopped.map(x => x.id), ['sa', 'sc', 'sb', 'ka']);
  // 古い KO・リンクだけの KL の止まる予定は出ない
  assert.ok(!more.stopped.some(x => x.id === 'ko' || x.id === 'kl'));
});

test('日またぎ: 23:30〜翌 5:00 の区間は、3 時のいまに出て、ahead の並びでも夜 23:30 に始まる回が続く', () => {
  const { now, ahead } = build(teishi);
  assert.ok(now.stopped.some(x => x.id === 'ka' && x.start === '2026-11-23T23:30+09:00' && x.end === '2026-11-24T05:00+09:00'));
  const ka = ahead.items.filter(x => x.id === 'ka' && x.service === 'ATM');
  assert.deepEqual([ka[0].start, ka[1].start], ['2026-11-23T23:30+09:00', '2026-11-24T23:30+09:00']);
  assert.equal(ahead.from, '2026-11-24T03:00+09:00');
  assert.equal(ahead.until, '2027-01-23T03:00+09:00');
  // 障害（終わりが決まらない）は ahead に入らない。予定メンテナンスは入る
  const a2 = build(SPANS_BUSY).ahead;
  assert.ok(!a2.items.some(x => x.kind === 'incident'));
  assert.ok(a2.items.some(x => x.id === 'sb'));
  assert.deepEqual(a2.items.map(x => x.start), [...a2.items.map(x => x.start)].sort());
});

test('t が先の日時: その時点に止まっている物、「ほか N 件は予定なし」の N、いちばん古い確かめた日。範囲の外は何も言わない', () => {
  const { ahead } = build(SPANS_BUSY);
  const night = B.at(ahead, '2026-11-24T23:45');
  assert.equal(night.inRange, true);
  assert.deepEqual(night.stopped.map(x => [x.id, x.service]), [['ka', 'ATM']]);
  // 確かめた相手は sa・sb・sc（5 分前に読めた）と ka・kn。23:45 に止まっているのは ka だけ → N は 4
  assert.equal(night.none.count, 4);
  assert.deepEqual(night.none.partners.map(p => p.id), ['sa', 'sb', 'sc', 'kn']);
  assert.equal(night.oldestChecked, '2026-11-19');
  const sat = B.at(ahead, '2026-11-28T00:00');                         // 土曜 0 時: ネットバンキング（臨時）と ATM（毎日）
  assert.deepEqual(sat.stopped.map(x => x.service), ['ATM', 'ネットバンキング']);
  const nine = B.at(ahead, '2026-11-25T09:00');                         // あすの朝 9 時: 何も止まっていない
  assert.deepEqual(nine.stopped, []);
  assert.equal(nine.none.count, 5);
  assert.deepEqual(B.at(ahead, '2026-11-24T23:45', { column: 'shigoto' }).none.partners.map(p => p.id), ['sa', 'sb', 'sc']);
  assert.equal(B.at(ahead, '2026-11-24T23:45', { column: 'shigoto' }).oldestChecked, null);
  const far = B.at(ahead, '2027-02-01T00:00');
  assert.deepEqual(far, { inRange: false, stopped: [], none: null, oldestChecked: '2026-11-19' });
  assert.equal(B.at(ahead, '2026-11-24T02:59').inRange, false);       // ahead の始まりより前
});

test('確かめられていない相手は「予定なし」に入らない（auto 15 分超・ledger 8 日超・link）', () => {
  const late = { ...SC, checked: '2026-11-23T17:44:59Z' };            // 15 分 1 秒前
  const edge = { ...SB, checked: '2026-11-23T17:45:00Z' };            // ちょうど 15 分前 → まだ確かめられている
  const none = { ...SA, checked: undefined };                          // 一度も読めていない
  const { now, ahead } = build([], { partners: [none, edge, late, SM, KN, KO, KL] });
  assert.deepEqual(now.unconfirmed.map(p => p.id), ['sa', 'sc', 'sm', 'ko', 'kl']);
  assert.deepEqual(now.none.partners.map(p => p.id), ['sb', 'kn']);
  assert.deepEqual(ahead.partners.map(p => p.id), ['sb', 'kn']);
  assert.deepEqual(B.at(ahead, '2026-11-25T00:00').none.partners.map(p => p.id), ['sb', 'kn']);
  // 8 日の境目: 11-16 は 8 日前でまだ出す、11-15 は 9 日前で出さない（teishi.js と同じ線）
  const k8 = { ...KO, checked: '2026-11-16' };
  assert.ok(build(T.upcoming([k8], NOW), { partners: [k8] }).now.stopped.some(x => x.id === 'ko'));
  assert.deepEqual(build(T.upcoming([{ ...KO, checked: '2026-11-16' }], NOW), { partners: [KO] }).now.stopped, []);
  // 確かめられていない auto の相手の区間は出す（前の値を消さない）が、N には数えない
  const r = build([inc({ service: 'sc', id: 'c9' })], { partners: [late, KN] });
  assert.deepEqual(r.now.stopped.map(x => x.id), ['sc']);
  assert.deepEqual(r.now.none.partners.map(p => p.id), ['kn']);
});

test('取り込みが 15 分より古い: いまの並びを出さず nothing も立てない。ちょうど 15 分は古くない', () => {
  const old = build(SPANS_BUSY, { ing: '2026-11-24T02:44:59' }).now;
  assert.equal(old.ingestOld, true);
  assert.deepEqual(old.stopped, []);
  assert.equal(old.nothing, false);
  assert.equal(old.ingestedAt, '2026-11-24T02:44+09:00');
  const edge = build(SPANS_BUSY, { ing: '2026-11-24T02:45' }).now;
  assert.equal(edge.ingestOld, false);
  assert.equal(edge.stopped.length, 3);
  assert.equal(build(SPANS_BUSY, { ing: null }).now.ingestOld, true);   // 取り込みの時刻が無い
  assert.equal(B.isOld('2026-11-24T02:45+09:00', '2026-11-24T03:00'), false);
  assert.equal(B.isOld('2026-11-24T02:45+09:00', '2026-11-24T03:01'), true);
});

test('形の不揃い: kind 無しは障害、終わりの無い予定メンテナンス（Slack の scheduled）は置かず、その相手を「予定なし」に数えない', () => {
  const spans = [
    { service: 'sa', id: 's1', start: '2026-11-23T10:00:00.000Z', end: null, impact: 'none', title: '作った予定', url: 'https://status.example.com/s1', kind: 'planned' },
    { service: 'sb', id: 's2', start: '2026-11-23T17:30:00.000Z', end: null, impact: 'minor', title: '作った不調', url: 'javascript:alert(1)', kind: 'incident' },
    { service: 'zz', id: 's3', start: '2026-11-23T17:30:00.000Z', end: null, impact: 'major', title: '一覧に無い', url: 'https://x.example/' },
    { service: 'sc', id: 's4', start: 'きのう', end: null, impact: 'major', title: '時刻が読めない', url: 'https://x.example/' },
    { service: 'sc', id: 's5', start: '2026-11-23T17:30:00Z', end: '2026-11-23T17:30:00Z', impact: 'major', title: '長さ 0', url: 'https://x.example/' },
    { service: 'sc', id: 's6', start: '2026-11-23T17:30:00Z', end: null, impact: 'major', title: '知らない kind', url: 'https://x.example/', kind: 'other' },
    { service: 'kn', id: 's7', start: '2026-11-23T17:30:00Z', end: null, impact: 'major', title: 'くらしの題は出さない', url: 'https://x.example/k' },
  ];
  const { now, ahead } = build(spans);
  assert.deepEqual(now.stopped.map(x => [x.id, x.title, x.url]), [['kn', null, 'https://x.example/k'], ['sb', '作った不調', 'https://status.example.com/sb']]);
  assert.equal(now.unplaced, 5);
  assert.deepEqual(ahead.blocked, ['sa']);
  assert.ok(!now.none.partners.some(p => p.id === 'sa'));
  assert.ok(!B.at(ahead, '2026-11-25T00:00').none.partners.some(p => p.id === 'sa'));
});

test('同じ入力から同じ JSON（バイトまで）。入力の欄の順と並びの順を変えても同じ', () => {
  const a = build(SPANS_BUSY);
  const b = build(SPANS_BUSY);
  assert.equal(B.toJson(a.now), B.toJson(b.now));
  assert.equal(B.toJson(a.ahead), B.toJson(b.ahead));
  const flip = (o) => Object.fromEntries(Object.entries(o).reverse());
  const c = B.build(PARTNERS.map(flip), [...SPANS_BUSY].reverse().map(flip), NOW, NOW_Z);
  assert.equal(B.toJson(c.now), B.toJson(a.now));
  assert.equal(B.toJson(c.ahead), B.toJson(a.ahead));
  assert.ok(B.toJson(a.now).endsWith('}\n'));
});

test('出す字は名前・止まる物・題・URL・日時だけ（notes・規則・出どころの読み方を運ばない）。口に要求を出さない', () => {
  const { now, ahead } = build([...SPANS_BUSY.map(s => ({ ...s, notes: '相手の本文' }))]);
  const s = B.toJson(now) + B.toJson(ahead);
  assert.ok(!s.includes('相手の本文'));
  assert.ok(!s.includes('公式のページを開く'));
  assert.ok(!s.includes('"rules"'));
  const src = readFileSync(SRC, 'utf8');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|import\s*\(/.test(src));
});
