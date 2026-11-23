// Q-1244（D1084）: トップの情シス・PC の札に、ストップボードの今の 1 件の箱（top-stop.js）。
// 0 件・1 件・3 件の字／形が違う時は箱が無い／fetch の先は now.json の 1 つだけ・1 回だけ・入力も端末の情報も載せない。外へは出ない（fetch を差し替える）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const src = read('top-stop.js');

const item = (id, name, kind = 'incident') => ({ id, name, column: 'shigoto', field: 'x', service: null, title: 't', kind, impact: 'major', color: 'red', limited: false, start: '2026-11-23T10:05+09:00', end: null, url: 'https://example.invalid/', checked: null, lastRead: null });
const now = (stopped, over = {}) => ({ version: 1, at: '2026-11-23T12:05+09:00', ingestedAt: '2026-11-23T12:05+09:00', ingestOld: false, stopped, nothing: !stopped.length, none: { count: 0, partners: [] }, unconfirmed: [], link: { count: 0, partners: [] }, unplaced: 0, ...over });

/** 偽の DOM（#it .yt-who と、そこに足される a）。fetch は差し替え。withWho=false は札が無いページ */
function run(fetchImpl, { withWho = true } = {}) {
  const calls = [], inserted = [], timers = [];
  const make = (tag) => ({ tag, className: '', children: [], textContent: '', appendChild(c) { this.children.push(c); } });
  const parent = { insertBefore: (n) => { inserted.push(n); } };
  const who = { parentNode: parent, nextSibling: null };
  const document = {
    querySelector: (q) => (q === '#it .yt-who' ? (withWho ? who : null) : q === '#it .yt-ans' ? (inserted[0] || null) : null),
    createElement: make,
  };
  const window = { fetch: (u, o) => { calls.push([u, o]); return fetchImpl(u, o); }, AbortController };
  window.window = window;
  vm.runInNewContext(src, { window, document, AbortController, setTimeout: (f, ms) => { timers.push(ms); return 1; }, clearTimeout: () => {} });
  const box = () => { const a = inserted[0]; return a && { href: a.href, cls: a.className, spans: a.children.map((s) => [s.className, s.textContent]) }; };
  return { api: window.YorozuTopStop, calls, box, timers };
}
const settle = () => new Promise((r) => setTimeout(r, 10));
const ok = (j) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });

test('0 件: 「いま」→「障害の発表は 0 件」→「ストップボード」。リンク先はストップボードのトップ', async () => {
  const t = run(ok(now([])));
  await settle();
  assert.deepEqual(t.box(), { href: 'https://stopboard.yorozu-craft.com/', cls: 'yt-ans', spans: [['yt-ai', 'いま'], ['yt-ao', '障害の発表は 0 件'], ['yt-ag', 'ストップボード']] });
});

test('1 件: 相手の名前（now.json の name をそのまま）が障害を発表中', async () => {
  const t = run(ok(now([item('cloudflare', 'Cloudflare')])));
  await settle();
  assert.equal(t.box().spans[1][1], 'Cloudflare が障害を発表中');
  const j = run(ok(now([item('x', 'さくら')])));
  await settle();
  assert.equal(j.box().spans[1][1], 'さくらが障害を発表中');
});

test('3 件: 1 件目の名前ほか 2 件。同じ相手の複数の障害は 1 件、予定メンテナンス（planned）は数えない', async () => {
  const t = run(ok(now([item('google-workspace', 'Google Workspace'), item('google-workspace', 'Google Workspace'), item('github', 'GitHub', 'planned'), item('slack', 'Slack'), item('zoom', 'Zoom')])));
  await settle();
  assert.equal(t.box().spans[1][1], 'Google Workspace ほか 2 件が障害を発表中');
  const t2 = run(ok(now([item('github', 'GitHub', 'planned')])));
  await settle();
  assert.equal(t2.box().spans[1][1], '障害の発表は 0 件');
});

test('形が違う・取り込みが古い・失敗・4 秒を超えた時は、箱を出さない', async () => {
  const bad = [now([item('a', 'A')], { version: 2 }), now([item('a', 'A')], { ingestOld: true }), now([item('a', 'A')], { ingestOld: undefined }), { version: 1, ingestOld: false }, now([{ id: 'a', kind: 'incident' }]), now([item('a', 'A', undefined)].map((x) => ({ ...x, kind: 3 }))), null, 'text', []];
  for (const j of bad) { const t = run(ok(j)); await settle(); assert.equal(t.box(), undefined, JSON.stringify(j)); }
  const t1 = run(() => Promise.resolve({ ok: false, json: () => Promise.resolve(now([])) })); await settle(); assert.equal(t1.box(), undefined);
  const t2 = run(() => Promise.reject(new Error('net'))); await settle(); assert.equal(t2.box(), undefined);
  const t3 = run(() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('not json')) })); await settle(); assert.equal(t3.box(), undefined);
  const t4 = run(() => new Promise(() => {})); await settle(); assert.equal(t4.box(), undefined);
  assert.deepEqual(t4.timers, [4000], '4 秒で中止する');
});

test('fetch の先は now.json の 1 つだけを 1 回。GET だけで、ヘッダ・本文・Cookie・Referer を載せない', async () => {
  const t = run(ok(now([])));
  await settle();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0][0], 'https://stopboard.yorozu-craft.com/now.json');
  const o = t.calls[0][1];
  assert.equal(o.method, 'GET');
  assert.equal(o.credentials, 'omit');
  assert.equal(o.referrerPolicy, 'no-referrer');
  assert.equal(o.headers, undefined);
  assert.equal(o.body, undefined);
  assert.deepEqual(src.match(/https?:\/\/[^'"\s)]+/g).filter((u) => !u.includes('stopboard.yorozu-craft.com')), [], '知らない宛先が無い');
  assert.doesNotMatch(src, /setInterval|sendBeacon|XMLHttpRequest|localStorage|navigator\.|innerHTML/);
});

test('札（#it の .yt-who）が無いページでは、取りにも行かない', async () => {
  const t = run(ok(now([])), { withWho: false });
  await settle();
  assert.equal(t.calls.length, 0);
});

test('トップは top-stop.js を読み、箱の場所は html に先に無い（札の中だけで動く）。情シスの札の静的な答えの箱は 0', () => {
  const html = read('index.html');
  assert.match(html, /<script src="\.\/top-stop\.js" defer><\/script>/);
  assert.doesNotMatch(html, /stopboard\.yorozu-craft\.com\/now\.json/);
  const it = html.match(/<section class="yt-card[^"]*" id="it"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(it, /class="yt-ans"/);
  assert.match(it, /class="yt-who">[^<]*<\/p>\n        <div class="yt-cbody">/);
});

test('top.js は今も通信をしない（通信は top-stop.js に分けた）', () => {
  assert.doesNotMatch(read('top.js'), /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|new Image/);
});

// Q-1253（D1097）: top-stop.js が読む先の host が、プライバシーポリシーの 7.3 に字で在る（作りと文書がずれた時に落ちる）
test('top-stop.js が読む先の host が privacy-policy.html に在り、こちらから送る内容が無い事を言っている', () => {
  const host = new URL(/var URL_NOW = '([^']+)'/.exec(src)[1]).host;
  const policy = read('privacy-policy.html');
  assert.ok(policy.includes(host), `privacy-policy.html に ${host}`);
  assert.match(policy, new RegExp(host.replace(/\./g, '\.') + '[^<]*から今の状態を読み込みます。こちらから送る内容はありません。'));
});
