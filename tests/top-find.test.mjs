// トップの困りごと検索（yorozu-plans ROADMAP 7.81.1 K166、7.96 D365・D367）: 3〜200 字で名前とぴったり一致しなければ、入力が止まってから /v1/find に送り、
// 近い道具を語の結果の下に足す（2 段）。数えるのは件数だけ（find_used・find_zero・find_click。文は送らない）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = read('top-find.js');

/** top-find.js を偽の document・fetch・タイマー・sendBeacon で動かす。fire(type, detail) で合図、flush() でタイマーを進める */
function run(fetchImpl) {
  const listeners = {}, timers = [], calls = [], pings = [];
  const document = { addEventListener: (t, f) => { (listeners[t] ||= []).push(f); } };
  const navigator = { sendBeacon: (u, b) => { pings.push([u, b]); return true; } };
  const window = { fetch: (u, o) => { calls.push([u, o]); return fetchImpl(u, o); }, AbortController, navigator, location: { pathname: '/' } };
  window.window = window;
  const ctx = { window, document, navigator, Blob: class { constructor(parts) { this.text = parts.join(''); } }, setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: (id) => { if (id) timers[id - 1] = null; }, AbortController, globalThis: window };
  vm.runInNewContext(src, ctx);
  return {
    api: window.YorozuTopFind, calls,
    events: () => pings.map(([u, b]) => { assert.equal(u, 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/ping'); return JSON.parse(b.text); }),
    fire: (type, detail) => (listeners[type] || []).forEach((f) => f({ detail })),
    flush: () => { const t = timers.slice(); timers.fill(null); t.forEach((f) => f && f()); },
  };
}
const settle = () => new Promise((r) => setTimeout(r, 10));
const ok = (j) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });

test('送るのは 3〜200 字で、名前とぴったり一致しないときだけ。返りはこのサイトの道を持つ 3 行まで', () => {
  const { api } = run(ok({}));
  assert.equal(api.shouldSend('医療'), false);
  assert.equal(api.shouldSend('親の医療費が高い'), true);
  assert.equal(api.shouldSend('年末調整', true), false, '名前とぴったり一致する語は送らない');
  assert.equal(api.shouldSend('年末調整 いくら戻る', false), true, '語で当たっても、ぴったりでなければ送る（D365）');
  assert.equal(api.shouldSend('あ'.repeat(201)), false);
  const rows = api.toRows({ ok: true, results: [
    { url: '/seido-keisan/kogaku-ryoyohi/', title: '高額療養費', line: '上限' }, { url: 'https://evil.example/', title: 'x' },
    { url: '//evil.example/', title: 'x' }, { url: '/a/', title: 'A' }, { url: '/b/', title: 'B' }, { url: '/c/', title: 'C' }] });
  assert.deepEqual(rows.map((r) => r.p), ['/seido-keisan/kogaku-ryoyohi/', '/a/', '/b/']);
  assert.equal(api.toRows({ ok: false }).length, 0);
  assert.equal(api.pathOf('./toban/'), '/toban/');
  assert.equal(api.pathOf('../seido-keisan/iryohi/'), '/seido-keisan/iryohi/');
});

test('語で当たっても送り、待ってから 1 回 POST、近い道具を渡す。件数は find_used だけ（0 件でない）', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/toban/', title: '当番表', line: '公平に回す' }] }));
  let shown = null;
  t.fire('yt-query', { q: '当番を公平に', hits: 2, exact: false, show: (rows) => { shown = rows; } });
  assert.equal(t.calls.length, 0, '打った直後は送らない');
  t.flush();
  await settle();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(t.calls[0][1].body), { text: '当番を公平に' });
  assert.deepEqual(shown.map((r) => r.p), ['/toban/']);
  assert.deepEqual(t.events(), [{ page: '/', event: 'find_used' }]);
});

test('語が 0 件なら find_zero も数える。近い道具から進めば find_click（行き先の道だけ）。文は件数に入らない', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/x/', title: 'x' }] }));
  t.fire('yt-query', { q: '親の医療費が高い', hits: 0, exact: false, show: () => {} });
  t.flush();
  await settle();
  t.fire('yt-pick', { near: true, href: './seido-keisan/kogaku-ryoyohi/' });
  t.fire('yt-pick', { near: false, href: './toban/' });
  const ev = t.events();
  assert.deepEqual(ev, [{ page: '/', event: 'find_used' }, { page: '/', event: 'find_zero' }, { page: '/seido-keisan/kogaku-ryoyohi/', event: 'find_click' }]);
  assert.ok(!JSON.stringify(ev).includes('医療費が高い'), '文を送らない');
});

test('ぴったり一致・短い文・打ち続けたら送らない。届かなければ何も足さない', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/x/', title: 'x' }] }));
  t.fire('yt-query', { q: '年末調整', hits: 1, exact: true, show: () => assert.fail('出さない') });
  t.fire('yt-query', { q: 'ab', hits: 0, exact: false, show: () => assert.fail('出さない') });
  t.fire('yt-query', { q: '親の医療費', hits: 0, exact: false, show: () => assert.fail('出さない') });
  t.fire('input', {});
  t.flush();
  await settle();
  assert.equal(t.calls.length, 0);
  assert.equal(t.events().length, 0);
  for (const f of [() => Promise.reject(new Error('x')), () => Promise.resolve({ ok: false }), ok({ ok: true, results: [] })]) {
    const u = run(f);
    u.fire('yt-query', { q: '親の医療費が高い', hits: 0, exact: false, show: () => assert.fail('出さない') });
    u.flush();
    await settle();
  }
});

test('top.js は通信しないまま、打った語と件数・ぴったりかを合図し、近い道具は区切りの下に足す。読むのはトップ（日英）だけ', () => {
  const top = read('top.js');
  assert.doesNotMatch(top, /fetch\(|sendBeacon|XMLHttpRequest/);
  assert.match(top, /new CustomEvent\('yt-query', \{ detail: \{ q: q, hits: results\.length, exact: exact/);
  assert.match(top, /class="yt-near-h">' \+ \(en \? 'Closest tools' : '近い道具'\)/);
  assert.match(top, /new CustomEvent\('yt-pick'/);
  assert.match(read('index.html'), /<script src="\.\/top-find\.js" defer><\/script>/);
  assert.match(read('en/index.html'), /<script src="\.\.\/top-find\.js" defer><\/script>/);
  for (const f of ['all/index.html', 'for/it/index.html', 'for/kaigo/index.html', 'for/teachers/index.html']) assert.doesNotMatch(read(f), /top-find\.js/, f);
  assert.match(read('privacy-policy.html'), /7\.11 近い道具を探す（トップの検索・LINE 版・メール）/);
  assert.match(read('privacy-policy.html'), /道具の名前と同じ語（名前の頭が同じものを含む）のときは送りません/);
  assert.match(read('en/privacy-policy.html'), /When your words are a tool's name \(or the start of one\), nothing is sent/);
});
