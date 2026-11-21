// トップの困りごと検索（yorozu-plans ROADMAP 7.81.1 K166、7.96 D365・D367）: 3〜200 字で名前とぴったり一致しなければ、Enter か「探す」を押した時だけ
// /v1/find に送り（D604。押す前に自動で送らない）、近い道具を語の結果の下に足す（2 段）。数えるのは件数だけ（find_used・find_zero・find_click。文は送らない）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = read('top-find.js');

/** top-find.js を偽の document・fetch・タイマー・sendBeacon で動かす。fire(type, detail) で合図（返りは preventDefault されたか）、flush() でタイマーを進める */
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
    fire: (type, detail) => { const ev = { detail, prevented: false, preventDefault() { this.prevented = true; } }; (listeners[type] || []).forEach((f) => f(ev)); return ev.prevented; },
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

test('押した時に語で当たっても送り、1 回 POST、近い道具を渡す。件数は find_used だけ（0 件でない）', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/toban/', title: '当番表', line: '公平に回す' }] }));
  let shown = null;
  assert.equal(t.fire('yt-go', { q: '当番を公平に', hits: 2, exact: false, show: (rows) => { shown = rows; } }), true, '送ったら top.js に候補を開かせない');
  await settle();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(t.calls[0][1].body), { text: '当番を公平に' });
  assert.deepEqual(shown.map((r) => r.p), ['/toban/']);
  assert.deepEqual(t.events(), [{ page: '/', event: 'find_used' }]);
});

test('語が 0 件なら find_zero も数える。近い道具から進めば find_click（行き先の道だけ）。文は件数に入らない', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/x/', title: 'x' }] }));
  t.fire('yt-go', { q: '親の医療費が高い', hits: 0, exact: false, show: () => {} });
  await settle();
  t.fire('yt-pick', { near: true, href: './seido-keisan/kogaku-ryoyohi/' });
  t.fire('yt-pick', { near: false, href: './toban/' });
  const ev = t.events();
  assert.deepEqual(ev, [{ page: '/', event: 'find_used' }, { page: '/', event: 'find_zero' }, { page: '/seido-keisan/kogaku-ryoyohi/', event: 'find_click' }]);
  assert.ok(!JSON.stringify(ev).includes('医療費が高い'), '文を送らない');
});

test('ぴったり一致・短い文は押しても送らず、top.js に候補を開かせる（preventDefault しない）。届かなければ何も足さない', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/x/', title: 'x' }] }));
  assert.equal(t.fire('yt-go', { q: '年末調整', hits: 1, exact: true, show: () => assert.fail('出さない') }), false);
  assert.equal(t.fire('yt-go', { q: 'ab', hits: 0, exact: false, show: () => assert.fail('出さない') }), false);
  t.flush();
  await settle();
  assert.equal(t.calls.length, 0);
  assert.equal(t.events().length, 0);
  for (const f of [() => Promise.reject(new Error('x')), () => Promise.resolve({ ok: false }), ok({ ok: true, results: [] })]) {
    const u = run(f);
    u.fire('yt-go', { q: '親の医療費が高い', hits: 0, exact: false, show: () => assert.fail('出さない') });
    await settle();
  }
});

test('top.js は通信しないまま、打った語と件数・ぴったりかを合図し、近い道具は区切りの下に足す。読むのはトップ（日英）だけ', () => {
  const top = read('top.js');
  assert.doesNotMatch(top, /fetch\(|sendBeacon|XMLHttpRequest/);
  assert.match(top, /new CustomEvent\('yt-go', \{ cancelable: true, detail: \{ q: q, hits: results\.length, exact: exact/);
  assert.doesNotMatch(top, /yt-query/, '打つたびの合図は出さない（D604）');
  assert.match(top, /class="yt-near-h">' \+ \(en \? 'Closest tools' : '近い道具'\)/);
  assert.match(top, /new CustomEvent\('yt-pick'/);
  assert.match(read('index.html'), /<script src="\.\/top-find\.js" defer><\/script>/);
  assert.match(read('en/index.html'), /<script src="\.\.\/top-find\.js" defer><\/script>/);
  for (const f of ['all/index.html', 'for/it/index.html', 'for/kaigo/index.html', 'for/teachers/index.html']) assert.doesNotMatch(read(f), /top-find\.js/, f);
  assert.match(read('privacy-policy.html'), /7\.11 近い道具を探す（トップの検索・LINE 版・メール）/);
  assert.match(read('privacy-policy.html'), /道具の名前と同じ語（名前の頭が同じものを含む）のときは送りません/);
  assert.match(read('en/privacy-policy.html'), /When your words are a tool's name \(or the start of one\), nothing is sent/);
});

test('accessibility-review の 3 点: 近い道具に読み上げの印、描き直しても選んだ行を残す、選んだ行に本文の色の線', () => {
  const top = read('top.js');
  assert.match(top, /r\.near \? '<span class="visually-hidden">' \+ \(en \? '\(closest tool\)' : '（近い道具）'\)/);
  assert.match(top, /paint\(\);\s*if \(active >= 0\) setActive\(active\);/);
  assert.match(read('top.css'), /\[role="option"\]\[aria-selected="true"\] \{ border-left: 4px solid var\(--text\); padding-left: calc\(var\(--sp-3\) - 4px\); \}/);
});

test('D604: 打つだけでは送らない（待ちのタイマーも打つたびの合図も無い）。続けて同じ文を押したら送らず、top.js に最初の候補を開かせる', async () => {
  const t = run(ok({ ok: true, results: [{ url: '/x/', title: 'x' }] }));
  t.fire('yt-query', { q: '親の医療費が高い', hits: 0, exact: false, show: () => assert.fail('出さない') });
  t.fire('input', {});
  t.flush();
  await settle();
  assert.equal(t.calls.length, 0, '打っただけでは 0');
  assert.doesNotMatch(src, /setTimeout\([^)]*WAIT_MS|addEventListener\('yt-query'|addEventListener\('input'/);
  assert.equal(t.fire('yt-go', { q: '親の医療費が高い', hits: 0, exact: false, show: () => {} }), true);
  await settle();
  assert.equal(t.calls.length, 1, '押すと 1');
  assert.equal(t.fire('yt-go', { q: '親の医療費が高い', hits: 0, exact: false, show: () => {} }), false, '同じ文の 2 度目は送らない');
  assert.equal(t.fire('yt-go', { q: '親の医療費が高くて困る', hits: 0, exact: false, show: () => {} }), true, '文を変えたら送る');
  await settle();
  assert.equal(t.calls.length, 2);
});

test('D604: トップの箱は「探す」のボタンと送ることの 1 行を持つ（すべての道具・使う人からの箱は今のまま）', () => {
  const top = read('index.html');
  assert.match(top, /<div class="yt-row"><input id="yt-q"[^>]*aria-describedby="yt-q-hint yt-q-send"[^>]*><button type="button" class="yt-go">探す<\/button><\/div>/);
  assert.match(top, /<p class="yt-send" id="yt-q-send">入れた文は、探すためにサーバーへ送ります。保存しません。<\/p>/);
  assert.match(read('top.css'), /\.yt-search \.yt-go \{[^}]*min-height: 52px; min-width: var\(--tap\);/);
  assert.doesNotMatch(top, /\.yt-search \.yt-go \{/, '押す所の形は top.css の 1 か所だけ');
  assert.match(read('top.js'), /goBtn\.addEventListener\('click'/);
  for (const f of ['all/index.html', 'for/it/index.html']) assert.doesNotMatch(read(f), /yt-go|yt-send/, f);
});

test('D625: 英語のトップの箱も Search のボタンと送ることの 1 行を持ち、押した時だけ送る（lead は今のまま）', () => {
  const en = read('en/index.html');
  assert.match(en, /<label for="yt-q">Find a tool<\/label>/);
  assert.match(en, /<div class="yt-row"><input id="yt-q"[^>]*aria-describedby="yt-q-send"[^>]*><button type="button" class="yt-go">Search<\/button><\/div>/);
  assert.match(en, /<p class="yt-send" id="yt-q-send">The text you enter is sent to a server to find tools\. It is not stored\.<\/p>/);
  assert.match(en, /<script src="\.\.\/top-find\.js" defer><\/script>/);
  assert.match(en, /<p class="lead">Small, free tools\. No sign-up\. The browser tools keep what you enter in your browser\.<\/p>/);
  assert.match(en, /<link rel="stylesheet" href="\.\.\/top\.css">/);
});

test('D604・D595: privacy-policy の 7.11 は押した時に送ると書き、トップの lead は全体を言い切らない', () => {
  assert.match(read('privacy-policy.html'), /3〜200 字を入れて、Enter か「探す」を押すと、その文を/);
  assert.match(read('en/privacy-policy.html'), /on the top page and press Enter or the search button, we send that text/);
  assert.doesNotMatch(read('privacy-policy.html') + read('en/privacy-policy.html'), /入力が止まってから|stop typing/);
  assert.match(read('index.html'), /登録なし。多くの道具は、入力を端末の外に出しません。<\/p>/);
  assert.doesNotMatch(read('index.html'), /入力は端末の外に出ません/);
});
