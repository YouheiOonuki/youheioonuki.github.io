// 止まる予定の暦（K248）の芯 tools/common/calc/teishi.js のテスト（yorozu-plans QUEUE Q-770・Q-989・Q-996）
// 台帳は合成（相手の名前も区間も作った物。実在の相手の値ではない）。外の口に要求を出さない
// 決まった休止の規則（rules）は台帳に書かない（D757・Q-996）。区間はどれも、お知らせの URL を持つ臨時の区間
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SRC = fileURLToPath(new URL('../tools/common/calc/teishi.js', import.meta.url));
const T = require(SRC);

const PAGE = 'https://example.invalid/maint';
const row = (o) => ({ column: 'kurashi', field: '銀行', scope: 'national', country: 'JP', mode: 'ledger',
  page: PAGE, source: { method: 'page', urls: [] }, checked: '2026-11-19', extra: [], ...o });
// 臨時の区間。url は区間ごとのお知らせ（作った URL）
const x = (service, start, end, o = {}) => ({ service, start, end, url: `https://example.invalid/notice/${start}`, ...o });

// 2026-11-23 は月曜
const A = row({ id: 'a', name: '架空銀行あ', stops: ['ネットバンキング', 'ATM'],
  extra: [x('ATM', '2026-11-22T23:30', '2026-11-23T05:00'), x('ATM', '2026-11-23T23:30', '2026-11-24T05:00')] });
const B = row({ id: 'b', name: '架空銀行い', stops: ['ネットバンキング'],
  extra: [x('ネットバンキング', '2026-11-29T01:00', '2026-11-29T06:00'), x('ネットバンキング', '2027-01-31T01:00', '2027-01-31T06:00')] });
const C = row({ id: 'c', name: '架空の申告', field: '行政の電子サービス', stops: ['申告の受付'],
  extra: [x('申告の受付', '2026-11-30T21:00', '2026-12-01T03:00'), x('申告の受付', '2026-12-30T21:00', '2026-12-31T03:00')] });
const D = row({ id: 'd', name: '架空の予約', field: '交通の予約・IC', stops: ['予約'],
  extra: [x('予約', '2026-11-29T00:00', '2026-11-29T06:00'), x('予約', '2026-11-29T05:00', '2026-11-29T08:00'),   // 重なる
          x('予約', '2026-12-06T00:00', '2026-12-06T06:00'), x('予約', '2026-12-06T06:00', '2026-12-06T07:00'),   // 接する
          x('予約', '2026-12-13T00:00', '2026-12-13T06:00')] });
const OLD = row({ id: 'o', name: '架空の古い', checked: '2026-11-14', stops: ['ATM'], extra: [x('ATM', '2026-11-23T00:00', '2026-11-23T01:00')] });
const NONE = row({ id: 'n', name: '架空の予定なし', stops: ['ATM'] });
const LEDGER = [A, B, C, D, OLD, NONE];
const NOW = '2026-11-23T00:00';   // 月曜 0 時

const pick = (list, id, service) => list.filter(s => s.id === id && (!service || s.service === service)).map(s => [s.start, s.end]);

test('合成の台帳は検査を通る。読めない区間は検査が名指しし、ほかの関数は飛ばす', () => {
  assert.deepEqual(T.validate(LEDGER), []);
  const bad = row({ id: 'x', name: '架空の誤り', stops: ['ATM', '窓口', '電話'], checked: '11/19',
    extra: [x('ATM', '2027-02-29T00:00', '2027-03-01T00:00'), x('ATM', '2026-11-24T05:00', '2026-11-24T05:00'),
            x('無い物', '2026-11-24T01:00', '2026-11-24T02:00'), x('ATM', '2026-11-24T01:00', '2026-11-24T02:00', { limited: 'yes' })] });
  const p = T.validate([bad, A, { ...A }, row({ id: 'y', name: '', mode: 'link', stops: ['ATM'], extra: [x('ATM', '2026-11-24T01:00', '2026-11-24T02:00')] })]);
  const of = (id) => p.filter(q => q.id === id).map(q => q.problem);
  assert.deepEqual(of('x'), ['stops は 0〜2 つ', 'checked が YYYY-MM-DD でない', '臨時の区間の日時が読めない',   // 2027 年 2 月 29 日は無い
    '臨時の区間の終わりが始まり以前', '臨時の区間の止まる物が stops に無い: 無い物', 'limited が true・false でない']);
  assert.deepEqual(of('a'), ['id が重なる']);
  assert.deepEqual(of('y'), ['name が無い', 'mode が auto・ledger でない']);   // リンクだけの型は無くした（Q-1256）
  // 誤りの区間は出ない
  const ok = row({ ...bad, checked: '2026-11-19', stops: ['ATM'] });
  assert.deepEqual(T.upcoming([ok], NOW), []);
});

test('検査（Q-996）: 区間は、お知らせの URL を https で必ず持つ。無い・空・http の区間は誤りで、出さない', () => {
  const one = (o) => row({ id: 'u', name: '架空の URL', stops: ['ATM'], extra: [{ service: 'ATM', start: '2026-11-24T01:00', end: '2026-11-24T02:00', ...o }] });
  for (const o of [{}, { url: '' }, { url: 'http://example.invalid/notice' }, { url: 'javascript:alert(1)' }, { url: 1 }]) {
    assert.deepEqual(T.validate([one(o)]).map(q => q.problem), ['臨時の区間の url が https でない'], JSON.stringify(o));
    assert.deepEqual(T.upcoming([one(o)], NOW), [], JSON.stringify(o));
  }
  assert.deepEqual(T.validate([one({ url: 'https://example.invalid/notice' })]), []);
});

test('検査（Q-996・D757）: 決まった休止の規則 rules は、空の並びでも欄が在れば誤り。規則から区間は作らない', () => {
  const R = (rules) => row({ id: 'r', name: '架空の規則', stops: ['ATM'], rules });
  for (const rules of [[], [{ service: 'ATM', every: 'day', from: '23:30', to: '05:00' }]]) {
    assert.deepEqual(T.validate([R(rules)]).map(q => q.problem), ['rules は持たない（決まった休止の規則は台帳に書かない。D757）']);
    assert.deepEqual(T.upcoming([R(rules)], NOW), []);
  }
  assert.deepEqual(T.nextStops([R([{ service: 'ATM', every: 'day', from: '23:30', to: '05:00' }])], NOW), []);   // 区間の無い相手は並べない
});

test('日またぎ: 23:30〜翌 5:00。from の時点で続いている区間も入る', () => {
  assert.deepEqual(pick(T.upcoming(LEDGER, NOW), 'a', 'ATM'), [
    ['2026-11-22T23:30+09:00', '2026-11-23T05:00+09:00'],
    ['2026-11-23T23:30+09:00', '2026-11-24T05:00+09:00'],
  ]);
  assert.deepEqual(pick(T.stoppedAt(LEDGER, '2026-11-24T03:00'), 'a'), [['2026-11-23T23:30+09:00', '2026-11-24T05:00+09:00']]);
});

test('月またぎ: 11/30 21:00〜12/1 3:00。終わりの前は止まっている', () => {
  assert.deepEqual(pick(T.upcoming(LEDGER, NOW), 'c'), [
    ['2026-11-30T21:00+09:00', '2026-12-01T03:00+09:00'],
    ['2026-12-30T21:00+09:00', '2026-12-31T03:00+09:00'],
  ]);
  assert.equal(T.stoppedAt(LEDGER, '2026-12-01T02:59', { now: NOW }).filter(s => s.id === 'c').length, 1);
});

test('長さ: 既定の 60 日に入らない区間は、days を広げると出る', () => {
  assert.deepEqual(pick(T.upcoming(LEDGER, NOW), 'b'), [['2026-11-29T01:00+09:00', '2026-11-29T06:00+09:00']]);
  assert.deepEqual(pick(T.upcoming(LEDGER, NOW, { days: 70 }), 'b'), [
    ['2026-11-29T01:00+09:00', '2026-11-29T06:00+09:00'],
    ['2027-01-31T01:00+09:00', '2027-01-31T06:00+09:00'],
  ]);
});

test('うるう日: 臨時の区間は 2028 年 2/29 をまたげる', () => {
  const R = row({ id: 'r', name: '架空の月末', checked: '2028-02-01', stops: ['ATM'], extra: [x('ATM', '2028-02-28T23:00', '2028-03-01T01:00')] });
  assert.deepEqual(pick(T.upcoming([R], '2028-02-01T00:00'), 'r'), [['2028-02-28T23:00+09:00', '2028-03-01T01:00+09:00']]);
  assert.equal(T.stoppedAt([R], '2028-02-29T12:00', { now: '2028-02-01T00:00' }).length, 1);
});

test('区間が重なる・接する時は、同じ相手・同じ止まる物で 1 つにまとめる', () => {
  const s = T.upcoming(LEDGER, NOW).filter(q => q.id === 'd');
  const at = (d) => s.filter(q => q.start.startsWith(d)).map(q => [q.start, q.end, q.kind]);
  assert.deepEqual(at('2026-11-29'), [['2026-11-29T00:00+09:00', '2026-11-29T08:00+09:00', 'extra']]);   // 重なる
  assert.deepEqual(at('2026-12-06'), [['2026-12-06T00:00+09:00', '2026-12-06T07:00+09:00', 'extra']]);   // 接する
  assert.deepEqual(at('2026-12-13'), [['2026-12-13T00:00+09:00', '2026-12-13T06:00+09:00', 'extra']]);
  // 止まる物が違えば、まとめない
  const both = T.stoppedAt(LEDGER, '2026-11-24T00:00');
  assert.deepEqual(both.map(q => q.id + '/' + q.service), ['a/ATM']);
});

test('t が区間の始まりちょうどは止まっている側、終わりちょうどは止まっていない側', () => {
  const ids = (t) => T.stoppedAt(LEDGER, t, { now: NOW }).map(q => q.id);
  assert.deepEqual(ids('2026-11-29T01:00'), ['d', 'b']);   // b は 1:00 に始まる（並びは始まる順）
  assert.deepEqual(ids('2026-11-29T00:59'), ['d']);
  assert.deepEqual(ids('2026-11-29T06:00'), ['d']);        // b は 6:00 に終わる
  assert.deepEqual(ids('2026-11-29T08:00'), []);           // d（まとめた区間）も 8:00 に終わる
  assert.deepEqual(ids('2026-11-29T07:59'), ['d']);
  // 時差つきの文字列・ミリ秒・Date でも同じ
  assert.deepEqual(T.stoppedAt(LEDGER, '2026-11-28T16:00Z', { now: NOW }).map(q => q.id), ['d', 'b']);
  assert.deepEqual(T.stoppedAt(LEDGER, new Date('2026-11-29T01:00+09:00'), { now: NOW }).map(q => q.id), ['d', 'b']);
});

test('t が先の日時: 古さは opts.now で測り、並びは始まる順・台帳の行の順', () => {
  const s = T.stoppedAt(LEDGER, '2027-01-31T02:00', { now: NOW });
  assert.deepEqual(s.map(q => [q.id, q.service, q.start, q.end]), [['b', 'ネットバンキング', '2027-01-31T01:00+09:00', '2027-01-31T06:00+09:00']]);
  assert.deepEqual(Object.keys(s[0]), ['id', 'name', 'column', 'service', 'start', 'end', 'kind', 'limited', 'url', 'checked']);
  assert.equal(s[0].url, PAGE);   // deeplink の無い相手の行き先は page
  // now を渡さないと t で測る: 2027-01-31 から見ると確かめた日 11-19 は 8 日より古いので、どれも出さない
  assert.deepEqual(T.stoppedAt(LEDGER, '2027-01-31T02:00'), []);
  // (a) の並びも始まる順
  const u = T.upcoming(LEDGER, NOW);
  for (let i = 1; i < u.length; i++) assert.ok(T.toMs(u[i - 1].start) <= T.toMs(u[i].start));
});

test('相手ごとの「次に止まる」: from より後に始まる最初の区間。続いている区間は「次」に数えない', () => {
  const n = T.nextStops(LEDGER, '2026-11-23T02:00');
  assert.deepEqual(n.map(q => [q.id, q.next && q.next.start]), [
    ['a', '2026-11-23T23:30+09:00'],
    ['b', '2026-11-29T01:00+09:00'],
    ['c', '2026-11-30T21:00+09:00'],
    ['d', '2026-11-29T00:00+09:00'],
  ]);   // n は止まる物を持つが、臨時の区間が無いので並べない（D642）
  assert.equal(T.nextStops(LEDGER, '2026-11-29T00:00', { now: NOW }).find(q => q.id === 'd').next.start, '2026-12-06T00:00+09:00');
});

test('8 日の境目: 確かめた日から 8 日は予定を出し、9 日で出さない側に移る。残りの区間なしは「予定なし」', () => {
  const sum = T.summary(LEDGER, NOW);
  assert.deepEqual(sum, {
    stale: { count: 1, names: ['架空の古い'] },                 // 11-14 から 11-23 は 9 日
    none: { count: 1, names: ['架空の予定なし'] },
  });
  const edge = { ...OLD, checked: '2026-11-15', extra: [x('ATM', '2026-11-23T00:00', '2026-11-24T01:00')] };   // 8 日
  assert.equal(T.summary([edge], '2026-11-23T23:59').stale.count, 0);
  assert.equal(T.summary([edge], '2026-11-24T00:00').stale.count, 1);
  assert.equal(T.stoppedAt([edge], '2026-11-23T00:30').length, 1);
  assert.equal(T.stoppedAt([edge], '2026-11-24T00:30').length, 0);   // 区間の中でも、古くなったので出さない
  // 古い相手の区間は (a)〜(c) に出ない
  const ids = new Set(T.upcoming(LEDGER, NOW).map(q => q.id));
  assert.ok(!ids.has('o'));
  assert.ok(!T.nextStops(LEDGER, NOW).some(q => q.id === 'o'));
  // 確かめた日の無い ledger の相手も出さない側
  assert.equal(T.summary([{ ...NONE, checked: undefined }], NOW).stale.count, 1);
});

test('台帳が空: どの関数も空を返す（並び・{ targets }・無し）', () => {
  for (const L0 of [[], { targets: [] }, undefined, null, {}]) {
    assert.deepEqual(T.upcoming(L0, NOW), []);
    assert.deepEqual(T.stoppedAt(L0, NOW), []);
    assert.deepEqual(T.nextStops(L0, NOW), []);
    assert.deepEqual(T.summary(L0, NOW), { stale: { count: 0, names: [] }, none: { count: 0, names: [] } });
    assert.deepEqual(T.validate(L0), []);
  }
  assert.deepEqual(T.upcoming({ targets: LEDGER }, NOW), T.upcoming(LEDGER, NOW));
  assert.throws(() => T.upcoming(LEDGER, '2026/11/23'), /日時が読めない/);
});

test('台帳の名前（D630）: region null・stops 空は検査を通る。limited は区間まで運び、まとめた全部が limited の時だけ true。auto は「予定なし」に数えない', () => {
  const G = { ...row({ id: 'g', name: '架空の機械で読む', mode: 'auto', checked: null, stops: [] }), region: null };
  const E = { ...row({ id: 'e', name: '架空の止まる物なし', stops: [] }), region: null };
  const H = row({ id: 'h', name: '架空の一部制限', stops: ['ネットバンキング', 'ATM'],
    extra: [x('ネットバンキング', '2026-11-29T21:00', '2026-11-29T23:00', { limited: true }),
            x('ATM', '2026-11-29T21:00', '2026-11-29T22:00', { limited: true }), x('ATM', '2026-11-29T22:00', '2026-11-29T23:00')] });
  assert.deepEqual(T.validate({ targets: [G, E, H] }), []);
  const p = T.validate([{ ...E, region: '関東' }, { ...E, id: 'e2', checked: '11/19' }]);
  assert.deepEqual(p.map(q => q.problem), ['region は scope が regional の時だけ', 'checked が YYYY-MM-DD でない']);
  const s = T.upcoming([H], NOW, { days: 7 }).map(q => [q.service, q.start, q.end, q.kind, q.limited]);
  assert.deepEqual(s, [
    ['ネットバンキング', '2026-11-29T21:00+09:00', '2026-11-29T23:00+09:00', 'extra', true],
    ['ATM', '2026-11-29T21:00+09:00', '2026-11-29T23:00+09:00', 'extra', false],   // limited の区間と limited でない区間が接する → 止まる側
  ]);
  assert.deepEqual(T.summary([G, E], NOW), { stale: { count: 0, names: [] }, none: { count: 1, names: ['架空の止まる物なし'] } });
  assert.deepEqual(T.nextStops([G, E, H], NOW).map(q => q.id), ['h']);   // 臨時の区間の無い相手は「次に止まる」を並べない
});

test('「次に止まる」の並べ方（D642）: 臨時の区間を持つ相手は stops が 0 でも並べ、区間の無い相手は止まる物があっても並べない', () => {
  const X0 = row({ id: 'x0', name: '架空の臨時だけ', stops: [], extra: [x('ATM', '2026-11-24T01:00', '2026-11-24T02:00')] });
  const S0 = row({ id: 's0', name: '架空の止まる物だけ', stops: ['ATM'] });
  assert.deepEqual(T.nextStops([S0, X0, A], NOW), [
    { id: 'x0', name: '架空の臨時だけ', next: null },   // 止まる物の名前は空（stops に無い物の区間は作らない）
    { id: 'a', name: '架空銀行あ', next: T.upcoming([A], NOW).find(s => T.toMs(s.start) > T.toMs(NOW)) },
  ]);
});

test('口に要求を出さない: 正本に fetch・XMLHttpRequest・sendBeacon・WebSocket・require・import が無い', () => {
  const src = readFileSync(SRC, 'utf8');
  for (const w of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'require(', 'import ']) assert.ok(!src.includes(w), w);
});

test('行き先（D752・Q-989）: deeplink が true の相手は臨時の区間の url、欄の無い相手と .csv・.pdf で終わる url は page', () => {
  const ex = (url) => ({ service: 'ATM', start: '2026-11-24T01:00', end: '2026-11-24T02:00', url });
  const urlOf = (o) => T.upcoming([row({ id: 'x', name: '架空の行き先', stops: ['ATM'], ...o })], NOW)[0].url;
  const NOTICE = 'https://example.invalid/notice/1';
  assert.equal(urlOf({ deeplink: true, extra: [ex(NOTICE)] }), NOTICE);                                    // 有り
  assert.equal(urlOf({ extra: [ex(NOTICE)] }), PAGE);                                                      // 無し
  assert.equal(urlOf({ deeplink: true, extra: [ex('https://example.invalid/schedule.csv')] }), PAGE);
  assert.equal(urlOf({ deeplink: true, extra: [ex('https://example.invalid/a.PDF')] }), PAGE);
  assert.equal(urlOf({ deeplink: true, extra: [ex('https://example.invalid/schedule.csv?d=1')] }), PAGE);
  // まとめた区間: 同じ url だけならその url、違えば page
  const two = (u2) => [ex(NOTICE), { service: 'ATM', start: '2026-11-24T02:00', end: '2026-11-24T03:00', url: u2 }];
  assert.equal(urlOf({ deeplink: true, extra: two(NOTICE) }), NOTICE);
  assert.equal(urlOf({ deeplink: true, extra: two('https://example.invalid/notice/2') }), PAGE);
});

test('検査（Q-989）: deeplink は ledger の相手だけで、値は true だけ', () => {
  const bad = (o) => T.validate([row({ id: 'x', name: '架空', stops: [], ...o })]).map(p => p.problem);
  assert.deepEqual(bad({ deeplink: true }), []);
  assert.deepEqual(bad({}), []);
  for (const o of [{ deeplink: false }, { deeplink: 'true' }, { deeplink: 1 }, { deeplink: true, mode: 'link', checked: null }, { deeplink: true, mode: 'auto' }])
    assert.ok(bad(o).includes('deeplink は ledger の相手だけで、値は true だけ'), JSON.stringify(o));
});

test('検査（Q-1000・D830）: page_top は ledger の相手だけで、値は true だけ', () => {
  const bad = (o) => T.validate([row({ id: 'x', name: '架空', stops: [], ...o })]).map(p => p.problem);
  assert.deepEqual(bad({ page_top: true }), []);
  for (const o of [{ page_top: false }, { page_top: 'true' }, { page_top: true, mode: 'link', checked: null }, { page_top: true, mode: 'auto' }])
    assert.ok(bad(o).includes('page_top は ledger の相手だけで、値は true だけ'), JSON.stringify(o));
});
