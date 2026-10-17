// トップの困りごと検索（yorozu-plans ROADMAP 7.81.1 K166、企画書 95）: 語が 0 件のときだけ、3〜200 字の文を、入力が止まってから /v1/find に送る
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = read('top-find.js');

/** top-find.js を偽の document・fetch・タイマーで動かす。fire(type, detail) で合図、flush() でタイマーを進める */
function run(fetchImpl) {
  const listeners = {}, timers = [], calls = [];
  const document = { addEventListener: (t, f) => { (listeners[t] ||= []).push(f); } };
  const window = { fetch: (u, o) => { calls.push([u, o]); return fetchImpl(u, o); }, AbortController };
  window.window = window;
  const ctx = { window, document, setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout: (id) => { if (id) timers[id - 1] = null; }, AbortController, globalThis: window };
  vm.runInNewContext(src, ctx);
  return {
    api: window.YorozuTopFind, calls,
    fire: (type, detail) => (listeners[type] || []).forEach((f) => f({ detail })),
    flush: () => { const t = timers.splice(0); t.forEach((f) => f && f()); },
  };
}
const settle = () => new Promise((r) => setTimeout(r, 10));
const ok = (j) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });

test('送るのは 3〜200 字だけ。返りはこのサイトの道を持つ 3 行まで', () => {
  const { api } = run(ok({}));
  assert.equal(api.shouldSend('医療'), false);
  assert.equal(api.shouldSend('親の医療費が高い'), true);
  assert.equal(api.shouldSend('あ'.repeat(200)), true);
  assert.equal(api.shouldSend('あ'.repeat(201)), false);
  const rows = api.toRows({ ok: true, results: [
    { url: '/seido-keisan/kogaku-ryoyohi/', title: '高額療養費', line: '上限' }, { url: 'https://evil.example/', title: 'x' },
    { url: '//evil.example/', title: 'x' }, { url: '/a/', title: 'A' }, { url: '/b/', title: 'B' }, { url: '/c/', title: 'C' }] });
  assert.deepEqual(rows.map((r) => r.p), ['/seido-keisan/kogaku-ryoyohi/', '/a/', '/b/']);
  assert.equal(api.toRows({ ok: false }).length, 0);
});

test('語が 0 件の合図のあと、待ってから 1 回だけ POST し、近い道具を一覧に渡す', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/toban/', title: '当番表', line: '公平に回す' }] }));
  let shown = null;
  t.fire('yt-nohit', { q: '掃除当番を公平に回したい', show: (rows) => { shown = rows; } });
  assert.equal(t.calls.length, 0, '打った直後は送らない');
  t.flush();
  await settle();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0][0], 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/find');
  assert.equal(t.calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(t.calls[0][1].body), { text: '掃除当番を公平に回したい' });
  assert.deepEqual(shown.map((r) => r.p), ['/toban/']);
});

test('打ち続けたら待ちを取り消す・短い文は送らない・届かなければ何も出さない', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/x/', title: 'x' }] }));
  t.fire('yt-nohit', { q: '親の医療費', show: () => assert.fail('出さない') });
  t.fire('input', {});
  t.flush();
  t.fire('yt-nohit', { q: 'ab', show: () => assert.fail('出さない') });
  t.flush();
  await settle();
  assert.equal(t.calls.length, 0);
  for (const f of [() => Promise.reject(new Error('x')), () => Promise.resolve({ ok: false }), ok({ ok: true, results: [] })]) {
    const u = run(f);
    u.fire('yt-nohit', { q: '親の医療費が高い', show: () => assert.fail('出さない') });
    u.flush();
    await settle();
  }
});

test('top.js は通信しないまま、語が 0 件のときだけ合図を出す。読むのはトップ（日英）だけ', () => {
  const top = read('top.js');
  assert.doesNotMatch(top, /fetch\(|sendBeacon|XMLHttpRequest/);
  assert.match(top, /if \(!has && norm\(q\) && typeof CustomEvent === 'function'\) \{\s*box\.dispatchEvent\(new CustomEvent\('yt-nohit'/);
  assert.match(read('index.html'), /<script src="\.\/top-find\.js" defer><\/script>/);
  assert.match(read('en/index.html'), /<script src="\.\.\/top-find\.js" defer><\/script>/);
  for (const f of ['all/index.html', 'for/it/index.html', 'for/kaigo/index.html', 'for/teachers/index.html']) assert.doesNotMatch(read(f), /top-find\.js/, f);
  assert.match(read('privacy-policy.html'), /7\.11 トップの検索で近い道具を探す/);
  assert.match(read('en/privacy-policy.html'), /7\.11 Finding similar tools from the top-page search/);
});
