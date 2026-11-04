// agent 向けの読み口（tools/build-agent.mjs。yorozu-plans ROADMAP 7.184 F・QUEUE Q-090、7.186 D477）
// ネットにも yorozu-api にも依らない: 計算の API の定義は tests/fixtures/agent-api.json（yorozu-api の原文から
// `AGENT_API_DIR=<yorozu-api> node tools/build-agent.mjs --write-fixture` で書いた写し）を使う。
// 写しが今のコードと同じかは最後の 1 本が確かめる（yorozu-api が YOROZU_API_DIR か隣にあるときだけ。無ければ skip）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { API, SITE, EXTRA_TOOLS, FIXTURE, buildOpenApi, bodySchema, buildLlms, buildApiJson, buildApiHtml, pageInfo, apiFixture, readApiDir, openApiSignature } from '../tools/build-agent.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const api = { index: fx.index, tools: fx.tools, maxBody: fx.maxBody };
const doc = buildOpenApi(api);
const extras = (c) => (c.extra || []).map((u) => u.slice(API.length));

test('OpenAPI は JSON として読み戻せ、3.1 の形（info・servers・paths、どの操作にも responses、$ref は解決する）', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(doc)), doc);
  assert.equal(doc.openapi, '3.1.0');
  assert.ok(doc.info.title && doc.info.version);
  assert.deepEqual(doc.servers, [{ url: API }]);
  const ids = [];
  for (const [p, ops] of Object.entries(doc.paths)) {
    assert.match(p, /^\//);
    for (const [m, op] of Object.entries(ops)) {
      assert.ok(op.responses && (op.responses[200] || op.responses[202]), p + ' ' + m + ' に responses');
      ids.push(op.operationId);
    }
  }
  assert.equal(new Set(ids).size, ids.length, 'operationId が重ならない');
  for (const r of JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)) assert.ok(doc.components.schemas[r[1]], r[1]);
});

test('口の集合 ＝ Worker のルートの集合（app.mjs の固定の道 ＋ 計算の名前 ＋ 別の口）', () => {
  assert.ok(fx.routes.includes('/mcp') && fx.routes.includes('/v1/now'), '固定の道: ' + fx.routes);
  const worker = new Set([...fx.routes, ...fx.index.calcs.map((c) => '/v1/' + c.name), ...fx.index.calcs.flatMap(extras)]);
  assert.deepEqual(new Set(Object.keys(doc.paths)), worker);
});

test('方法: /mcp は POST だけ（GET は 405）、計算は GET と POST、ほかは GET', () => {
  const calcs = new Set(fx.index.calcs.map((c) => '/v1/' + c.name));
  for (const [p, ops] of Object.entries(doc.paths)) {
    const want = p === '/mcp' ? ['post'] : calcs.has(p) ? ['get', 'post'] : ['get'];
    assert.deepEqual(Object.keys(ops), want, p);
  }
});

test('GET の引数 ＝ 計算の params（名前・必須）。POST の本文の必須 ＝ required', () => {
  for (const c of fx.index.calcs) {
    const op = doc.paths['/v1/' + c.name];
    assert.deepEqual(op.get.parameters.map((x) => x.name), Object.keys(c.params), c.name);
    assert.deepEqual(op.get.parameters.filter((x) => x.required).map((x) => x.name), c.required || [], c.name);
    assert.deepEqual(op.post.requestBody.content['application/json'].schema.required || [], c.required || [], c.name);
    assert.equal(op.get['x-mcp-tool'], c.mcp_tool);
  }
});

test('MCP のツールの集合 ＝ tools/list。どのツールにも同じ中身の HTTP の口がある。/mcp の説明の本数も同じ', () => {
  const names = fx.tools.map((t) => t.name).sort();
  assert.deepEqual([...doc.paths['/mcp'].post['x-mcp-tools']].sort(), names);
  const onOps = new Set(Object.values(doc.paths).flatMap((ops) => Object.values(ops).map((o) => o['x-mcp-tool']).filter(Boolean)));
  assert.deepEqual([...onOps].sort(), names);
  assert.match(doc.paths['/mcp'].post.description, new RegExp('ツール ' + names.length + ' 本'));
});

test('別の口と同じ中身のツール（EXTRA_TOOLS）: 口とツールがどちらもあり、引数はツールの inputSchema', () => {
  const allExtras = new Set(fx.index.calcs.flatMap(extras));
  for (const [sub, tool] of Object.entries(EXTRA_TOOLS)) {
    assert.ok(allExtras.has('/v1/' + sub), sub);
    const t = fx.tools.find((x) => x.name === tool);
    assert.ok(t, tool);
    assert.deepEqual(doc.paths['/v1/' + sub].get.parameters.map((x) => x.name), Object.keys(t.inputSchema.properties));
  }
});

test('POST の本文の上限は app.mjs の MAX_BODY（写しの maxBody）から。413 と /api/ の KB', () => {
  assert.ok(fx.maxBody > 0);
  assert.match(doc.paths['/v1/wareki'].post.responses[413].description, new RegExp(fx.maxBody / 1024 + ' KB'));
  assert.ok(!doc.paths['/v1/wareki'].get.responses[413], 'GET に 413 は無い');
  assert.ok(buildApiHtml([], api).includes(`${fx.maxBody / 1024} KB まで`));
});

test('POST の本文の形は入れ子（kogaku の rows.0.cost → rows: [{ cost }]）', () => {
  const s = doc.paths['/v1/kogaku'].post.requestBody.content['application/json'].schema;
  assert.equal(s.properties.rows.type, 'array');
  assert.ok(s.properties.rows.items.properties.cost.description);
  assert.ok(!('rows.0.cost' in s.properties));
});

test('bodySchema: a.b は入れ子、a.0.b は配列、親にも説明がある欄はそのまま残す', () => {
  const s = bodySchema({ x: 'X', 'spouse.has': 'H', items: 'I', 'items.0.watt': 'W' }, ['x']);
  assert.deepEqual(s.required, ['x']);
  assert.equal(s.properties.spouse.type, 'object');
  assert.equal(s.properties.spouse.properties.has.description, 'H');
  assert.equal(s.properties.items.description, 'I');
  assert.equal(s.properties.items.type, 'array');
  assert.equal(s.properties.items.items.properties.watt.description, 'W');
});

test('答えの欄: Meta ＝ 答えの meta の欄、/v1/now の答えの欄', () => {
  assert.deepEqual(Object.keys(doc.components.schemas.Meta.properties).sort(), fx.metaKeys);
  assert.deepEqual(Object.keys(doc.paths['/v1/now'].get.responses[200].content['application/json'].schema.properties).sort(), fx.nowKeys);
});

/* ---------- llms.txt と /api/ ---------- */
const page = (title, desc, alt = '') => `<html><head><title>${title}</title><meta name="description" content="${desc}">${alt}</head></html>`;
const hl = (lang, u) => `<link rel="alternate" hreflang="${lang}" href="${u}">`;
const site = (() => {
  const pages = {
    sections: [{ id: 'kurashi', name: 'くらし・お金' }, { id: 'it', name: '情シス・IT' }],
    pages: [
      { path: '/t/a/', title: '計算 A', section: 'kurashi', priority: 3 },
      { path: '/t/b/', title: '計算 B', section: 'kurashi', priority: 9 },
      { path: '/u/', title: '道具 U', section: 'it', priority: 1 },
    ],
    en: { pages: [{ path: '/t/en/a/', title: 'Calc A' }] },
  };
  const urls = [SITE, SITE + 'en/', SITE + 'all/', SITE + 't/a/', SITE + 't/a/guide.html', SITE + 't/b/', SITE + 'u/', SITE + 't/en/a/', SITE + 't/en/a/guide.html'];
  const html = {
    [SITE]: page('トップ', 'top'), [SITE + 'en/']: page('Top', 'Free tools.'), [SITE + 'all/']: page('一覧', '全部'),
    [SITE + 't/a/']: page('A｜y', 'A の説明', hl('ja', SITE + 't/a/') + hl('en', SITE + 't/en/a/')),
    [SITE + 't/b/']: page('B｜y', 'B の説明'), [SITE + 'u/']: page('U｜y', 'U の説明'),
    [SITE + 't/en/a/']: page('A en', 'About A', hl('ja', SITE + 't/a/') + hl('en', SITE + 't/en/a/')),
  };
  return { pages, urls, info: Object.fromEntries(Object.entries(html).map(([u, h]) => [u, pageInfo(u, h)])) };
})();
const ds = [{ name: 'D', what: 'd', url: SITE + 'd.json', format: 'JSON', license: 'CC0-1.0', checked: '2026-01-01', generated: '2026-01-02', source: ['https://e.example/'], homepage: null }];

test('llms.txt: H1・要約・作成日（check.ps1 が読む形）、計算の API と MCP の節、pages.json の節の順と priority の並び', () => {
  const t = buildLlms(site, ds, api);
  assert.match(t, /^# yorozu-craft\n\n> /);
  assert.match(t, /^- 作成日: \d{4}-\d{2}-\d{2}/m);
  assert.match(t, /^- English: Free tools\. \(https:\/\/yorozu-craft\.com\/en\/\)$/m);
  assert.ok(t.includes(`- [OpenAPI 3.1](${SITE}api/openapi.json)`));
  assert.ok(t.includes(`- [MCP](${API}/mcp): `) && t.includes(`ツール ${fx.tools.length} 本: `));
  const heads = [...t.matchAll(/^##+ (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(heads, ['計算の API と MCP', 'データ（CC0）', '入口', '道具（日本語）', 'くらし・お金', '情シス・IT', 'English', 'Optional']);
  assert.ok(t.indexOf('[計算 B]') < t.indexOf('[計算 A]'), '節の中は priority の高い順');
});

test('llms.txt: 道具の行に使い方と英語の対、英語の行に日本語の対。入口は pages.json に無い sitemap のページ', () => {
  const t = buildLlms(site, ds, api);
  assert.ok(t.includes(`- [計算 A](${SITE}t/a/): A の説明（使い方: ${SITE}t/a/guide.html）（English: ${SITE}t/en/a/）`));
  assert.ok(t.includes(`- [計算 B](${SITE}t/b/): B の説明\n`), '対も使い方も無い行は説明だけ');
  assert.ok(t.includes(`- [Calc A](${SITE}t/en/a/): About A (guide: ${SITE}t/en/a/guide.html) (Japanese: ${SITE}t/a/)`));
  const entry = t.slice(t.indexOf('## 入口'), t.indexOf('## 道具'));
  assert.ok(entry.includes(`(${SITE}all/)`) && entry.includes(`(${SITE}en/)`));
  assert.ok(!entry.includes(`(${SITE}t/a/)`), 'pages.json の道具は入口に出さない');
});

test('/api/: index.json に OpenAPI と MCP の URL、index.html に MCP の接続の節（URL・ツールの本数・openapi.json）', () => {
  const j = JSON.parse(buildApiJson(ds, api));
  assert.deepEqual(j.api, { openapi: SITE + 'api/openapi.json', calcs: API + '/v1', mcp: API + '/mcp', mcp_tools: fx.tools.length });
  const h = buildApiHtml(ds, api);
  const sec = h.slice(h.indexOf('<h2 id="calc-api">'), h.indexOf('<h2 id="use">'));
  assert.ok(sec.includes(`<code>${API}/mcp</code>`));
  assert.ok(sec.includes(`ツールは ${fx.tools.length} 本`));
  assert.ok(sec.includes('href="./openapi.json"'));
});

/* ---------- 写し ＝ 今の yorozu-api（手元にあるときだけ。ネットには出ない） ---------- */
const apiDir = process.env.YOROZU_API_DIR || join(root, '..', 'yorozu-api');
const hasApi = existsSync(join(apiDir, 'src', 'app.mjs'));
test('写し（fixtures/agent-api.json）＝ yorozu-api の今のコード。書いた口はどれも Worker が答え、答えの形も合う', { skip: hasApi ? false : 'yorozu-api が無い（YOROZU_API_DIR で場所を渡す）: ' + apiDir }, async () => {
  assert.deepEqual(await apiFixture(apiDir), fx, '違えば `AGENT_API_DIR=<yorozu-api> node tools/build-agent.mjs --write-fixture` で書き直す');
  const local = await readApiDir(apiDir);
  const call = local.call;
  for (const [p, ops] of Object.entries(doc.paths)) {
    for (const m of Object.keys(ops)) {
      const init = m === 'post' ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: p === '/mcp' ? JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) : '{}' } : {};
      const r = await call(new Request(API + p, init));
      assert.ok(r.status !== 404 && r.status !== 405, `${m.toUpperCase()} ${p} → ${r.status}`);
    }
  }
  assert.equal((await call(new Request(API + '/v1/no-such-calc'))).status, 404);
  assert.equal((await call(new Request(API + '/mcp'))).status, 405);
  // 本文の上限を超えると 413
  assert.equal((await call(new Request(API + '/v1/wareki', { method: 'POST', body: JSON.stringify({ date: 'x'.repeat(fx.maxBody) }) }))).status, 413);
  // POST の入れ子 ＝ GET のクエリ（README の例、ACCEPTANCE 2.1 の検算 1 行目）
  const get = await (await call(new Request(API + '/v1/kogaku?period=r8&cat=u&rows.0.cost=1000000&rows.0.age=u70&rows.0.place=in&rows.0.rate=0.3'))).json();
  const post = await (await call(new Request(API + '/v1/kogaku', { method: 'POST', body: JSON.stringify({ period: 'r8', cat: 'u', rows: [{ cost: 1000000, age: 'u70', place: 'in', rate: 0.3 }] }) }))).json();
  assert.equal(get.result.limit, 92940);
  assert.deepEqual(post.result, get.result);
  // 別の口 ＝ 同じ中身のツール
  for (const [sub, tool] of Object.entries(EXTRA_TOOLS)) {
    const viaHttp = await (await call(new Request(API + '/v1/' + sub + '?period=r8'))).json();
    const viaMcp = await (await call(new Request(API + '/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: { period: 'r8' } } }) }))).json();
    assert.deepEqual(viaMcp.result.structuredContent.result, viaHttp.result, sub + ' ＝ ' + tool);
  }
  // check-site の突き合わせに使う要約は、同じ定義なら同じ
  assert.deepEqual(openApiSignature(buildOpenApi(local)), openApiSignature(doc));
});
