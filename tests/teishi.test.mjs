// 止まる予定の暦（K248）の芯 tools/common/calc/teishi.js のテスト（yorozu-plans QUEUE Q-770）
// 台帳は合成（相手の名前も区間も作った物。実在の相手の値ではない）。外の口に要求を出さない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SRC = fileURLToPath(new URL('../tools/common/calc/teishi.js', import.meta.url));
const T = require(SRC);

// 2026-11-21 は土曜。11 月の日曜は 1・8・15・22・29（第 5 あり）、12 月は 6・13・20・27（第 5 なし）、2027 年 1 月は 3〜31（第 5 あり）
const row = (o) => ({ column: 'kurashi', field: '銀行', scope: 'national', country: 'JP', mode: 'ledger',
  page: 'https://example.invalid/maint', source: { method: 'page', urls: [] }, checked: '2026-11-19', rules: [], extra: [], ...o });

const A = row({ id: 'a', name: '架空銀行あ', stops: ['ネットバンキング', 'ATM'],
  rules: [{ service: 'ATM', every: 'day', from: '23:30', to: '05:00' }] });
const B = row({ id: 'b', name: '架空銀行い', stops: ['ネットバンキング'],
  rules: [{ service: 'ネットバンキング', every: 'month', nth: 5, dow: 0, from: '01:00', to: '06:00' }] });
const C = row({ id: 'c', name: '架空の申告', field: '行政の電子サービス', stops: ['申告の受付'],
  rules: [{ service: '申告の受付', every: 'month', day: 30, from: '21:00', to: '03:00' }] });
const D = row({ id: 'd', name: '架空の予約', field: '交通の予約・IC', stops: ['予約'],
  rules: [{ service: '予約', every: 'week', dow: 0, from: '00:00', to: '06:00' }],
  extra: [{ service: '予約', start: '2026-11-29T05:00', end: '2026-11-29T08:00' },
          { service: '予約', start: '2026-12-06T06:00', end: '2026-12-06T07:00' }] });
const L = row({ id: 'l', name: '架空のリンクだけ', mode: 'link', stops: ['ネットバンキング'] });
const OLD = row({ id: 'o', name: '架空の古い', checked: '2026-11-14', stops: ['ATM'],
  rules: [{ service: 'ATM', every: 'day', from: '00:00', to: '01:00' }] });
const NONE = row({ id: 'n', name: '架空の予定なし', stops: ['ATM'] });
const LEDGER = [A, B, C, D, L, OLD, NONE];
const NOW = '2026-11-23T00:00';   // 月曜 0 時

const pick = (list, id, service) => list.filter(s => s.id === id && (!service || s.service === service)).map(s => [s.start, s.end]);

test('合成の台帳は検査を通る。読めない規則・区間は検査が名指しし、ほかの関数は飛ばす', () => {
  assert.deepEqual(T.validate(LEDGER), []);
  const bad = row({ id: 'x', name: '架空の誤り', stops: ['ATM', '窓口', '電話'], checked: '11/19',
    rules: [{ service: 'ATM', every: 'day', from: '10:00', to: '10:00' }, { service: 'ATM', every: 'month', nth: 6, dow: 0, from: '01:00', to: '02:00' },
            { service: 'ATM', every: 'week', dow: 7, from: '01:00', to: '02:00' }, { service: 'ATM', every: 'year', from: '01:00', to: '02:00' },
            { service: 'ATM', every: 'day', from: '24:00', to: '02:00' }, { service: '無い物', every: 'day', from: '01:00', to: '02:00' }],
    extra: [{ service: 'ATM', start: '2027-02-29T00:00', end: '2027-03-01T00:00' }, { service: 'ATM', start: '2026-11-24T05:00', end: '2026-11-24T05:00' }] });
  const p = T.validate([bad, A, { ...A }, row({ id: 'y', name: '', mode: 'link', stops: ['ATM'], rules: [{ service: 'ATM', every: 'day', from: '01:00', to: '02:00' }] })]);
  const of = (id) => p.filter(x => x.id === id).map(x => x.problem);
  assert.equal(of('x').length, 10);
  assert.ok(of('x').includes('stops は 0〜2 つ'));
  assert.ok(of('x').includes('checked が YYYY-MM-DD でない'));
  assert.ok(of('x').includes('規則の始まりと終わりが同じ'));
  assert.ok(of('x').includes('臨時の区間の日時が読めない'));   // 2027 年 2 月 29 日は無い
  assert.ok(of('x').includes('臨時の区間の終わりが始まり以前'));
  assert.deepEqual(of('a'), ['id が重なる']);
  assert.deepEqual(of('y'), ['name が無い', 'link の相手が規則か区間を持つ']);
  // 誤りの規則・区間は出ない（stops の 3 つ目も、規則が無いので区間は出ない）
  const ok = row({ ...bad, checked: '2026-11-19', stops: ['ATM'] });
  assert.deepEqual(T.upcoming([ok], NOW), []);
});

test('日またぎ: 毎日 23:30〜翌 5:00。from の時点で続いている区間も入り、60 日ぶん出る', () => {
  const s = pick(T.upcoming(LEDGER, NOW), 'a', 'ATM');
  assert.deepEqual(s[0], ['2026-11-22T23:30+09:00', '2026-11-23T05:00+09:00']);
  assert.deepEqual(s[1], ['2026-11-23T23:30+09:00', '2026-11-24T05:00+09:00']);
  assert.equal(s.length, 61);   // 11-22 夜の回（続いている）＋ 11-23〜2027-01-21 の 60 回
  assert.deepEqual(s[60], ['2027-01-21T23:30+09:00', '2027-01-22T05:00+09:00']);
  assert.deepEqual(pick(T.stoppedAt(LEDGER, '2026-11-24T03:00'), 'a'), [['2026-11-23T23:30+09:00', '2026-11-24T05:00+09:00']]);
});

test('月またぎ: 毎月 30 日 21:00〜翌 3:00 は 11/30 → 12/1。2 月（30 日が無い）は出ない', () => {
  assert.deepEqual(pick(T.upcoming(LEDGER, NOW), 'c'), [
    ['2026-11-30T21:00+09:00', '2026-12-01T03:00+09:00'],
    ['2026-12-30T21:00+09:00', '2026-12-31T03:00+09:00'],
  ]);
  assert.deepEqual(pick(T.upcoming(LEDGER, '2027-01-25T00:00', { now: NOW, days: 70 }), 'c'), [
    ['2027-01-30T21:00+09:00', '2027-01-31T03:00+09:00'],
    ['2027-03-30T21:00+09:00', '2027-03-31T03:00+09:00'],
  ]);
  assert.equal(T.stoppedAt(LEDGER, '2026-12-01T02:59', { now: NOW }).filter(s => s.id === 'c').length, 1);
});

test('第 5 日曜の無い月: 70 日で 11 月 29 日と 2027 年 1 月 31 日だけで、12 月は出ない', () => {
  assert.deepEqual(pick(T.upcoming(LEDGER, NOW, { days: 70 }), 'b'), [
    ['2026-11-29T01:00+09:00', '2026-11-29T06:00+09:00'],
    ['2027-01-31T01:00+09:00', '2027-01-31T06:00+09:00'],
  ]);
});

test('うるう日: 毎月 29 日は 2028 年 2 月に出て、2027 年 2 月には出ない。臨時の区間も 2/29 をまたげる', () => {
  const R = row({ id: 'r', name: '架空の月末', checked: '2028-02-01', stops: ['ATM'],
    rules: [{ service: 'ATM', every: 'month', day: 29, from: '22:00', to: '24:00' }],
    extra: [{ service: 'ATM', start: '2028-02-28T23:00', end: '2028-03-01T01:00' }] });
  assert.deepEqual(pick(T.upcoming([R], '2028-02-01T00:00', { days: 60 }), 'r'), [
    ['2028-02-28T23:00+09:00', '2028-03-01T01:00+09:00'],   // 臨時が 2/29 22:00〜24:00 の規則を含むので 1 つに
    ['2028-03-29T22:00+09:00', '2028-03-30T00:00+09:00'],
  ]);
  assert.equal(T.upcoming([R], '2028-02-01T00:00', { days: 60 })[0].kind, 'mixed');
  const R27 = { ...R, checked: '2027-02-01', extra: [] };
  assert.deepEqual(pick(T.upcoming([R27], '2027-02-01T00:00', { days: 60 }), 'r'), [['2027-03-29T22:00+09:00', '2027-03-30T00:00+09:00']]);
});

test('規則と臨時が重なる・接する時は、同じ相手・同じ止まる物で 1 つにまとめる', () => {
  const s = T.upcoming(LEDGER, NOW).filter(x => x.id === 'd');
  const at = (d) => s.filter(x => x.start.startsWith(d)).map(x => [x.start, x.end, x.kind]);
  assert.deepEqual(at('2026-11-29'), [['2026-11-29T00:00+09:00', '2026-11-29T08:00+09:00', 'mixed']]);   // 重なる
  assert.deepEqual(at('2026-12-06'), [['2026-12-06T00:00+09:00', '2026-12-06T07:00+09:00', 'mixed']]);   // 接する
  assert.deepEqual(at('2026-12-13'), [['2026-12-13T00:00+09:00', '2026-12-13T06:00+09:00', 'rule']]);
  // 止まる物が違えば、まとめない
  const both = T.stoppedAt(LEDGER, '2026-11-24T00:00');
  assert.deepEqual(both.map(x => x.id + '/' + x.service), ['a/ATM']);
});

test('t が区間の始まりちょうどは止まっている側、終わりちょうどは止まっていない側', () => {
  const ids = (t) => T.stoppedAt(LEDGER, t, { now: NOW }).map(x => x.id);
  assert.deepEqual(ids('2026-11-29T01:00'), ['a', 'd', 'b']);   // b は 1:00 に始まる（並びは始まる順）
  assert.deepEqual(ids('2026-11-29T00:59'), ['a', 'd']);
  assert.deepEqual(ids('2026-11-29T06:00'), ['d']);             // b は 6:00 に終わる。a は 5:00 に終わった
  assert.deepEqual(ids('2026-11-29T08:00'), []);                // d（まとめた区間）も 8:00 に終わる
  assert.deepEqual(ids('2026-11-29T07:59'), ['d']);
  // 時差つきの文字列・ミリ秒・Date でも同じ
  assert.deepEqual(T.stoppedAt(LEDGER, '2026-11-28T16:00Z', { now: NOW }).map(x => x.id), ['a', 'd', 'b']);
  assert.deepEqual(T.stoppedAt(LEDGER, new Date('2026-11-29T01:00+09:00'), { now: NOW }).map(x => x.id), ['a', 'd', 'b']);
});

test('t が先の日時: 古さは opts.now で測り、並びは始まる順・台帳の行の順', () => {
  const s = T.stoppedAt(LEDGER, '2027-01-31T02:00', { now: NOW });
  assert.deepEqual(s.map(x => [x.id, x.service, x.start, x.end]), [
    ['c', '申告の受付', '2027-01-30T21:00+09:00', '2027-01-31T03:00+09:00'],
    ['a', 'ATM', '2027-01-30T23:30+09:00', '2027-01-31T05:00+09:00'],
    ['d', '予約', '2027-01-31T00:00+09:00', '2027-01-31T06:00+09:00'],
    ['b', 'ネットバンキング', '2027-01-31T01:00+09:00', '2027-01-31T06:00+09:00'],
  ]);
  assert.deepEqual(Object.keys(s[0]), ['id', 'name', 'column', 'service', 'start', 'end', 'kind', 'limited', 'url', 'checked']);
  assert.equal(s[0].url, 'https://example.invalid/maint');
  // now を渡さないと t で測る: 2027-01-31 から見ると確かめた日 11-19 は 8 日より古いので、どれも出さない
  assert.deepEqual(T.stoppedAt(LEDGER, '2027-01-31T02:00'), []);
  // (a) の並びも始まる順
  const u = T.upcoming(LEDGER, NOW);
  for (let i = 1; i < u.length; i++) assert.ok(T.toMs(u[i - 1].start) <= T.toMs(u[i].start));
});

test('相手ごとの「次に止まる」: from より後に始まる最初の区間。続いている区間は「次」に数えない', () => {
  const n = T.nextStops(LEDGER, '2026-11-23T02:00');
  assert.deepEqual(n.map(x => [x.id, x.next && x.next.start]), [
    ['a', '2026-11-23T23:30+09:00'],
    ['b', '2026-11-29T01:00+09:00'],
    ['c', '2026-11-30T21:00+09:00'],
    ['d', '2026-11-29T00:00+09:00'],
  ]);   // n は止まる物を持つが、規則も臨時の区間も無いので並べない（D642）
  assert.equal(T.nextStops(LEDGER, '2026-11-29T00:00', { now: NOW }).find(x => x.id === 'd').next.start, '2026-12-06T00:00+09:00');
});

test('8 日の境目: 確かめた日から 8 日は予定を出し、9 日で出さない側に移る。link は出さない側。残りの区間なしは「予定なし」', () => {
  const sum = T.summary(LEDGER, NOW);
  assert.deepEqual(sum, {
    link: { count: 1, names: ['架空のリンクだけ'] },
    stale: { count: 1, names: ['架空の古い'] },                 // 11-14 から 11-23 は 9 日
    none: { count: 1, names: ['架空の予定なし'] },
  });
  const edge = { ...OLD, checked: '2026-11-15' };                // 8 日
  assert.equal(T.summary([edge], '2026-11-23T23:59').stale.count, 0);
  assert.equal(T.summary([edge], '2026-11-24T00:00').stale.count, 1);
  assert.equal(T.stoppedAt([edge], '2026-11-23T00:30').length, 1);
  assert.equal(T.stoppedAt([edge], '2026-11-24T00:30').length, 0);
  // link・古い相手の区間は (a)〜(c) に出ない
  const ids = new Set(T.upcoming(LEDGER, NOW).map(x => x.id));
  assert.ok(!ids.has('l') && !ids.has('o'));
  assert.ok(!T.nextStops(LEDGER, NOW).some(x => x.id === 'l' || x.id === 'o'));
  // 確かめた日の無い ledger の相手も出さない側
  assert.equal(T.summary([{ ...NONE, checked: undefined }], NOW).stale.count, 1);
});

test('台帳が空: どの関数も空を返す（並び・{ targets }・無し）', () => {
  for (const L0 of [[], { targets: [] }, undefined, null, {}]) {
    assert.deepEqual(T.upcoming(L0, NOW), []);
    assert.deepEqual(T.stoppedAt(L0, NOW), []);
    assert.deepEqual(T.nextStops(L0, NOW), []);
    assert.deepEqual(T.summary(L0, NOW), { link: { count: 0, names: [] }, stale: { count: 0, names: [] }, none: { count: 0, names: [] } });
    assert.deepEqual(T.validate(L0), []);
  }
  assert.deepEqual(T.upcoming({ targets: LEDGER }, NOW), T.upcoming(LEDGER, NOW));
  assert.throws(() => T.upcoming(LEDGER, '2026/11/23'), /日時が読めない/);
});

test('台帳の名前（D630）: region null・stops 空・link の checked null は検査を通る。limited は区間まで運び、まとめた全部が limited の時だけ true。auto は「予定なし」に数えない', () => {
  const G = { ...row({ id: 'g', name: '架空の機械で読む', mode: 'auto', checked: null, stops: [] }), region: null };
  const E = { ...row({ id: 'e', name: '架空の止まる物なし', stops: [] }), region: null };
  const Z = { ...row({ id: 'z', name: '架空のリンク', mode: 'link', stops: [] }), region: null, checked: null };
  const H = row({ id: 'h', name: '架空の一部制限', stops: ['ネットバンキング', 'ATM'],
    rules: [{ service: 'ネットバンキング', every: 'week', dow: 0, from: '21:00', to: '23:00', limited: true },
            { service: 'ATM', every: 'week', dow: 0, from: '21:00', to: '22:00', limited: true }],
    extra: [{ service: 'ATM', start: '2026-11-29T22:00', end: '2026-11-29T23:00' }] });
  assert.deepEqual(T.validate({ targets: [G, E, Z, H] }), []);
  const p = T.validate([{ ...H, rules: [{ ...H.rules[0], limited: 'yes' }] }, { ...E, region: '関東' }, { ...Z, checked: '11/19' }]);
  assert.deepEqual(p.map(x => x.problem), ['limited が true・false でない', 'region は scope が regional の時だけ', 'checked が YYYY-MM-DD でない']);
  const s = T.upcoming([H], NOW, { days: 7 }).map(x => [x.service, x.start, x.end, x.kind, x.limited]);
  assert.deepEqual(s, [
    ['ネットバンキング', '2026-11-29T21:00+09:00', '2026-11-29T23:00+09:00', 'rule', true],
    ['ATM', '2026-11-29T21:00+09:00', '2026-11-29T23:00+09:00', 'mixed', false],   // limited の規則と limited でない臨時が接する → 止まる側
  ]);
  assert.deepEqual(T.summary([G, E, Z], NOW), { link: { count: 1, names: ['架空のリンク'] }, stale: { count: 0, names: [] }, none: { count: 1, names: ['架空の止まる物なし'] } });
  assert.deepEqual(T.nextStops([G, E, H], NOW).map(x => x.id), ['h']);   // 規則も臨時の区間も無い相手は「次に止まる」を並べない
});

test('「次に止まる」の並べ方（D642）: 規則か臨時の区間を持つ相手は stops が 0 でも並べ、規則も区間も無い相手は止まる物があっても並べない', () => {
  const R0 = row({ id: 'r0', name: '架空の規則だけ', stops: [], rules: [{ service: 'ATM', every: 'day', from: '01:00', to: '02:00' }] });
  const X0 = row({ id: 'x0', name: '架空の臨時だけ', stops: [], extra: [{ service: 'ATM', start: '2026-11-24T01:00', end: '2026-11-24T02:00' }] });
  const S0 = row({ id: 's0', name: '架空の止まる物だけ', stops: ['ATM'] });
  assert.deepEqual(T.nextStops([R0, S0, X0, A], NOW), [
    { id: 'r0', name: '架空の規則だけ', next: null },   // 止まる物の名前は空（stops に無い物の区間は作らない）
    { id: 'x0', name: '架空の臨時だけ', next: null },
    { id: 'a', name: '架空銀行あ', next: T.upcoming([A], NOW).find(s => T.toMs(s.start) > T.toMs(NOW)) },
  ]);
});

test('口に要求を出さない: 正本に fetch・XMLHttpRequest・sendBeacon・WebSocket・require・import が無い', () => {
  const src = readFileSync(SRC, 'utf8');
  for (const w of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'require(', 'import ']) assert.ok(!src.includes(w), w);
});

test('行き先（D752・Q-989）: deeplink が true の相手は臨時の区間の url、欄の無い相手と .csv・.pdf・http(s) でない url は page', () => {
  const ex = (url) => ({ service: 'ATM', start: '2026-11-24T01:00', end: '2026-11-24T02:00', url });
  const urlOf = (o) => T.upcoming([row({ id: 'x', name: '架空の行き先', stops: ['ATM'], ...o })], NOW)[0].url;
  const NOTICE = 'https://example.invalid/notice/1';
  assert.equal(urlOf({ deeplink: true, extra: [ex(NOTICE)] }), NOTICE);                                    // 有り
  assert.equal(urlOf({ extra: [ex(NOTICE)] }), 'https://example.invalid/maint');                           // 無し
  assert.equal(urlOf({ deeplink: true, extra: [ex('https://example.invalid/schedule.csv')] }), 'https://example.invalid/maint');
  assert.equal(urlOf({ deeplink: true, extra: [ex('https://example.invalid/a.PDF')] }), 'https://example.invalid/maint');
  assert.equal(urlOf({ deeplink: true, extra: [ex('javascript:alert(1)')] }), 'https://example.invalid/maint');
  assert.equal(urlOf({ deeplink: true, extra: [ex(undefined)] }), 'https://example.invalid/maint');
  // まとめた区間: 同じ url だけならその url、違えば page。規則とまとまれば page
  const two = (u2) => [ex(NOTICE), { service: 'ATM', start: '2026-11-24T02:00', end: '2026-11-24T03:00', url: u2 }];
  assert.equal(urlOf({ deeplink: true, extra: two(NOTICE) }), NOTICE);
  assert.equal(urlOf({ deeplink: true, extra: two('https://example.invalid/notice/2') }), 'https://example.invalid/maint');
  assert.equal(urlOf({ deeplink: true, extra: [ex(NOTICE)], rules: [{ service: 'ATM', every: 'day', from: '00:30', to: '01:30' }] }), 'https://example.invalid/maint');
});

test('検査（Q-989）: deeplink は ledger の相手だけで、値は true だけ', () => {
  const bad = (o) => T.validate([row({ id: 'x', name: '架空', stops: [], ...o })]).map(p => p.problem);
  assert.deepEqual(bad({ deeplink: true }), []);
  assert.deepEqual(bad({}), []);
  for (const o of [{ deeplink: false }, { deeplink: 'true' }, { deeplink: 1 }, { deeplink: true, mode: 'link', checked: null }, { deeplink: true, mode: 'auto' }])
    assert.ok(bad(o).includes('deeplink は ledger の相手だけで、値は true だけ'), JSON.stringify(o));
});
