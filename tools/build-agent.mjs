// agent 向けの読み口（yorozu-plans ROADMAP 7.17 の K133、7.184 F の Q-090）: /llms.txt と /api/index.html・/api/index.json・/api/openapi.json を書き出す
// サイトのビルド（yorozu-plans tools/deploy/build.ps1）が、組み立てた配信フォルダから毎回作る（yorozu-plans 7.70 D342。手で作り直す人を置かない）:
//   AGENT_SITE_DIR=<dist> AGENT_OUT=<dist> node tools/build-agent.mjs   配信フォルダの robots.txt・sitemap・pages.json・ページ・データを読んで、配信フォルダに書く
//   node tools/build-agent.mjs            本番を読んで、このリポジトリの直下に書く（手で試すとき。生成物は git に入れない）
// 手で直さない。道具の一覧は data/pages.json（トップと同じ一覧。節・題名）と各ページの meta description・hreflang から、
// pages.json に無いページ（トップ・/all/・/api/ など）は各 sitemap.xml から、
// データの一覧は下の DATASETS の各ファイルの中の license・checked・generated・source から、
// 計算の API（OpenAPI と MCP の節）は yorozu-api の GET /v1（計算の一覧）と MCP の tools/list から作る（どちらも yorozu-api の src/calcs*.mjs の同じ定義）。
// データを足したら DATASETS に 1 行足して、走らせ直す。robots.txt は変えない（7.17: 全部許可のまま）。
//
// まだ本番に出ていないデータを読むとき（各リポジトリの枝で確かめるとき）は、AGENT_LOCAL に手元のフォルダの型を渡す:
//   AGENT_LOCAL='/home/user/{repo}' node tools/build-agent.mjs   （{repo} がリポジトリ名に置き換わる。無いファイルは本番から読む）
// 計算の API の定義は、手元の yorozu-api の原文（AGENT_API_DIR。無ければこのリポジトリの隣の yorozu-api）の src/app.mjs を呼んで読む。
//   本番の Worker は呼ばない（yorozu-plans 7.186 D477）。読めなければ理由を出して終了コード 1（古いものや推測で作らない）。
//   build.ps1 は AGENT_API_DIR に Claude\Projects\yorozu-api を渡す。本番の Worker との一致は check-site.mjs が警告で見る。
//   node tools/build-agent.mjs --write-fixture   tests/fixtures/agent-api.json（テストがネットにも yorozu-api にも依らずに使う写し）を書き直す
// プロキシのある環境では NODE_USE_ENV_PROXY=1 を付ける。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = 'https://yorozu-craft.com/';
// 計算の API（yorozu-api。Cloudflare Workers の workers.dev）。独自ドメインにしたらここ 1 か所を変える
export const API = 'https://yorozu-api.oonuki-youhei.workers.dev';
// 計算の「別の口」（/v1/<計算>/<名前>）のうち、MCP に同じ中身のツールがあるもの。yorozu-api src/app.mjs の callTool の対応（テストが答えの一致で確かめる）
export const EXTRA_TOOLS = { 'kogaku/categories': 'list_high_cost_medical_categories' };

// 公開データ（どれも CC0。ファイルの中に license・checked・generated・source がある。ACCEPTANCE 7.10.3 e）
export const DATASETS = [
  { path: 'seido-keisan/data/kaitei.json', name: '制度の改定カレンダー', what: '税・社会保険・給付の施行日と出典' },
  { path: 'seido-keisan/data/kaitei.ics', name: '制度の改定カレンダー（iCalendar）', what: '同じ施行日の購読用カレンダー' },
  { path: 'gakko-keisan/data/naishin.json', name: '都道府県別の内申点の計算式', what: '公立高校入試の調査書点の式と値、計算例' },
  { path: 'hoshizora-sanpo/data/tenmon.json', name: '天文カレンダー', what: '新月・上弦・満月・下弦、流星群の極大、日食・月食（国立天文台の発表）' },
  { path: 'hoshizora-sanpo/data/tenmon.ics', name: '天文カレンダー（iCalendar）', what: '同じ予定の購読用カレンダー' },
  { path: 'quiz-hiroba/data/genso.json', name: '元素の「おお」の一言', what: '118 元素の名前の由来・発見・周期表の位置（1 文ずつ出典つき）' },
  { path: 'quiz-hiroba/data/shuto.json', name: '世界の首都の「おお」の一言', what: '首都の名前の由来・創設の年・そばの水域（Wikidata から）' },
  { path: 'gengo/data/gengo.json', name: '元号表', what: '明治〜令和の始まりと終わりの日と出典' },
  { path: 'gengo/data/gakunen.json', name: '学年早見表', what: '2020〜2035 年度の生年月日と学年の対応' },
];

const local = process.env.AGENT_LOCAL || '';
const siteDir = process.env.AGENT_SITE_DIR || '';   // 配信フォルダ（ビルドの dist）。あれば本番の代わりにここを読む
async function get(url) {
  if (siteDir && url.startsWith(SITE)) {
    let p = url.slice(SITE.length).split('?')[0];
    if (!p || p.endsWith('/')) p += 'index.html';
    const f = join(siteDir, ...p.split('/'));
    if (existsSync(f)) return readFileSync(f, 'utf8');
    throw new Error(url + ' → 配信フォルダに無い');
  }
  const r = await fetch(url, { headers: { 'user-agent': 'yorozu-craft build-agent (+https://yorozu-craft.com/llms.txt)' } });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.text();
}
// データ: AGENT_LOCAL に同じファイルがあればそれを、無ければ本番を読む
async function getData(path) {
  if (local) {
    const [repo, ...rest] = path.split('/');
    const f = join(local.replace('{repo}', repo), ...rest);
    if (existsSync(f)) return readFileSync(f, 'utf8');
  }
  return get(SITE + path);
}

const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (s) => String(s).replace(/([\[\]])/g, '\\$1');

// iCalendar の X-WR-CALDESC から license・確認日・生成日・出典の URL を読む（RFC 5545 の折り返しを戻す）
function icsMeta(text) {
  const u = text.replace(/\r\n[ \t]/g, '');
  const m = u.match(/^X-WR-CALDESC:(.*)\r?$/m);
  const desc = m ? m[1].replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1') : '';
  const lines = desc.split('\n');
  const at = lines.findIndex((l) => /^出典/.test(l));
  return {
    title: (u.match(/^X-WR-CALNAME:(.*)\r?$/m) || [])[1] || '',
    license: /CC0 1\.0/.test(desc) ? 'CC0-1.0' : null,
    // 確認日の行に日付が複数あるとき（天文カレンダーは現象ごと）は一番新しい日
    checked: ((desc.match(/確認日: [^\n]*/) || [''])[0].match(/\d{4}-\d{2}-\d{2}/g) || []).sort().at(-1) || null,
    generated: (desc.match(/生成日: (\d{4}-\d{2}-\d{2})/) || [])[1] || null,
    source: at >= 0 ? lines.slice(at + 1).filter((l) => /^https:\/\//.test(l)) : [],
    homepage: (desc.match(/ページ: (https:\/\/\S+)/) || [])[1] || null,
    starts_ok: text.startsWith('BEGIN:VCALENDAR'),
  };
}

async function readDatasets() {
  const out = [];
  for (const d of DATASETS) {
    const text = await getData(d.path);
    const url = SITE + d.path;
    if (d.path.endsWith('.ics')) {
      const m = icsMeta(text);
      out.push({ ...d, url, format: 'iCalendar', license: m.license, checked: m.checked, generated: m.generated, source: m.source, homepage: m.homepage });
    } else {
      const j = JSON.parse(text);
      out.push({ ...d, url, format: 'JSON', license: j.license || null, checked: j.checked || null, generated: j.generated || null,
        source: Array.isArray(j.source) ? j.source : j.source ? [j.source] : [], homepage: j.homepage || null });
    }
  }
  return out;
}

// 足りない項目（ACCEPTANCE 7.10.3 e・K133 の規則: license・checked・generated・source）
export function problems(ds) {
  const bad = [];
  for (const d of ds) {
    if (d.license !== 'CC0-1.0') bad.push(d.path + ': license が CC0-1.0 でない');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.checked || '')) bad.push(d.path + ': checked が無い');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.generated || '')) bad.push(d.path + ': generated が無い');
    if (!d.source.length || !d.source.every((u) => /^https:\/\//.test(u))) bad.push(d.path + ': source（https の URL）が無い');
  }
  return bad;
}

// サイトの読み取り: pages.json（道具の一覧・節）、各 sitemap の URL（使い方ページの有無と、pages.json に無いページ）、各ページの題名・説明・hreflang
// own: この script 自身が書き出すページ（/api/）の HTML。配信フォルダにはまだ無いので、読む代わりに渡す
const url = (path) => SITE + path.replace(/^\//, '');
function alternate(html, lang) {
  for (const tag of html.match(/<link\b[^>]*>/g) || []) {
    if (/\brel="alternate"/.test(tag) && new RegExp('\\bhreflang="' + lang + '"').test(tag)) return (tag.match(/\bhref="([^"]+)"/) || [])[1] || null;
  }
  return null;
}
export function pageInfo(u, html) {
  return {
    url: u,
    title: decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || ''),
    desc: decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || ''),
    ja: alternate(html, 'ja'),
    en: alternate(html, 'en'),
  };
}
async function readSite(own = {}) {
  const robots = await get(SITE + 'robots.txt');
  const maps = [...robots.matchAll(/^Sitemap:\s*(\S+)/gm)].map((m) => m[1]);
  const urls = [];
  for (const sm of maps) urls.push(...[...(await get(sm)).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));
  const pages = JSON.parse(await get(SITE + 'data/pages.json'));
  const want = new Set([...urls.filter((u) => u.endsWith('/')), ...pages.pages.map((p) => url(p.path)), ...pages.en.pages.map((p) => url(p.path))]);
  const info = {};
  for (const u of want) info[u] = pageInfo(u, own[u] ?? await get(u));
  return { pages, urls, info };
}

// 計算の API の定義: GET /v1（計算の一覧。名前・入力・必須・説明・道具のページ・別の口）と MCP の tools/list（ツールの名前と入力）
// call(Request) → Response（yorozu-api の handler.fetch か fetch）
export async function readApi(call) {
  const v1 = await call(new Request(API + '/v1'));
  if (!v1.ok) throw new Error(API + '/v1 → ' + v1.status);
  const index = await v1.json();
  const r = await call(new Request(API + '/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }));
  if (!r.ok) throw new Error(API + '/mcp tools/list → ' + r.status);
  const tools = (await r.json()).result?.tools;
  if (!Array.isArray(tools) || !tools.length) throw new Error(API + '/mcp tools/list にツールが無い');
  if (!Array.isArray(index.calcs) || !index.calcs.length) throw new Error(API + '/v1 に計算が無い');
  return { index, tools };
}
// yorozu-api の原文（dir）から読む。handler を手元で呼び（HTTP に出ない）、本文の上限と固定の道は src/app.mjs の原文から読む
export async function readApiDir(dir) {
  const app = join(dir || '', 'src', 'app.mjs');
  if (!dir || !existsSync(app)) throw new Error('yorozu-api の原文が無い: ' + app + '（AGENT_API_DIR に yorozu-api のフォルダを渡す）');
  const src = readFileSync(app, 'utf8');
  const maxBody = Number((src.match(/const MAX_BODY = (\d+);/) || [])[1]);
  if (!maxBody) throw new Error(app + ' に MAX_BODY が無い（本文の上限を書けない）');
  const routes = [...src.matchAll(/path === '(\/[^']*)'/g)].map((m) => m[1]);
  const { handler } = await import(pathToFileURL(app).href);
  const call = (req) => handler.fetch(req);
  return { ...(await readApi(call)), maxBody, routes, call };
}
// テストの写し（tests/fixtures/agent-api.json）: 定義と、答えの欄の名前（meta・/v1/now）
export async function apiFixture(dir) {
  const { index, tools, maxBody, routes, call } = await readApiDir(dir);
  const meta = (await (await call(new Request(API + '/v1/wareki?date=2019-04-30'))).json()).meta;
  const now = await (await call(new Request(API + '/v1/now?date=2026-01-01'))).json();
  return { index, tools, maxBody, routes, metaKeys: Object.keys(meta).sort(), nowKeys: Object.keys(now).sort() };
}
export const FIXTURE = join(root, 'tests', 'fixtures', 'agent-api.json');
export const apiDirDefault = () => process.env.AGENT_API_DIR || join(root, '..', 'yorozu-api');

// OpenAPI の口の要約（口・方法・operationId・引数の名前と必須・MCP のツール）。check-site が本番の openapi.json と本番の Worker から作ったものを比べる
export function openApiSignature(doc) {
  const out = [];
  for (const [p, ops] of Object.entries(doc.paths)) {
    for (const [m, op] of Object.entries(ops)) {
      const params = (op.parameters || []).map((x) => x.name + (x.required ? '*' : '')).join(',');
      const body = op.requestBody?.content?.['application/json']?.schema;
      out.push(`${m.toUpperCase()} ${p} ${op.operationId} [${params}]${body?.required ? ' body*' + body.required.join(',') : ''}${op['x-mcp-tool'] ? ' mcp=' + op['x-mcp-tool'] : ''}${op['x-mcp-tools'] ? ' tools=' + op['x-mcp-tools'].join(',') : ''}`);
    }
  }
  return out.sort();
}

/* ---------- OpenAPI 3.1（/api/openapi.json）。口と入力は yorozu-api の定義から。ここに口を書き足さない ---------- */
// MCP の入力の名前（spouse.has・rows.0.cost）を、POST の JSON の本文の形（{ spouse: { has } }・{ rows: [{ cost }] }）にする。
// GET のクエリは名前のまま（Worker の parseQuery が入れ子に直す）。POST の本文は直さずに計算に渡るので、入れ子で送る
export function bodySchema(params, required = []) {
  const top = { type: 'object', properties: {}, additionalProperties: true };
  if (required.length) top.required = [...required];
  for (const [key, desc] of Object.entries(params)) {
    const segs = key.split('.');
    let node = top;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (/^\d+$/.test(s)) continue;   // 配列の添字は、ひとつ上の欄が配列であることで表す
      node.properties ??= {};
      const c = (node.properties[s] ??= {});
      const next = segs[i + 1];
      if (next === undefined) { c.description = desc; break; }
      if (/^\d+$/.test(next)) { c.type = 'array'; c.items ??= { type: 'object', additionalProperties: true }; node = c.items; }
      else { c.type = 'object'; c.additionalProperties = true; node = c; }
    }
  }
  return top;
}

const ref = (name) => ({ $ref: '#/components/schemas/' + name });
const jsonContent = (schema) => ({ 'application/json': { schema } });

export function buildOpenApi({ index, tools, maxBody }) {
  const MAX_BODY = maxBody;
  const base = API;
  const toolNames = tools.map((t) => t.name);
  const toolByName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const calcResponses = (post) => ({
    200: { description: '計算の結果と meta（出典・確認日・免責の文） / Result with meta', content: jsonContent(ref('CalcResponse')) },
    400: { description: '入力の誤り（result.ok が false）か、計算できなかった / Invalid input or calculation failed', content: jsonContent({ anyOf: [ref('CalcResponse'), ref('Error')] }) },
    ...(post ? { 413: { description: `本文が ${MAX_BODY / 1024} KB（${MAX_BODY.toLocaleString('en-US')} バイト）を超えた / Body over ${MAX_BODY / 1024} KB`, content: jsonContent(ref('Error')) } } : {}),
  });
  const paths = {};
  const indexOp = (id) => ({ get: { operationId: id, summary: index.title, responses: { 200: { description: '計算の一覧 / List of calculations', content: jsonContent({ type: 'object' }) } } } });
  paths['/'] = indexOp('index_root');
  paths['/v1'] = indexOp('index');
  paths['/v1/now'] = {
    get: {
      operationId: 'next_system_change',
      summary: '次の改定（今日より後の最初の施行日。制度の改定カレンダーから）',
      parameters: [{ name: 'date', in: 'query', required: false, description: '基準の日（YYYY-MM-DD。省略すると日本時間の今日）', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } }],
      responses: { 200: { description: '次の施行日と項目 / Next effective date', content: jsonContent({ type: 'object', properties: { today: { type: 'string' }, next: { type: ['object', 'null'] }, checked: { type: 'string' }, page: { type: 'string' } } }) } },
    },
  };
  for (const c of index.calcs) {
    const p = '/v1/' + c.name;
    const description = [c.description?.ja, c.description?.en].filter(Boolean).join('\n');
    const required = c.required || [];
    const common = { summary: c.title, description, externalDocs: { url: c.page }, 'x-mcp-tool': c.mcp_tool };
    paths[p] = {
      get: {
        operationId: c.mcp_tool, ...common,
        parameters: Object.entries(c.params).map(([k, v]) => ({ name: k, in: 'query', required: required.includes(k), description: v, schema: { type: 'string' } })),
        responses: calcResponses(false),
      },
      post: {
        operationId: c.mcp_tool + '_post', ...common,
        requestBody: { required: required.length > 0, content: jsonContent(bodySchema(c.params, required)) },
        responses: calcResponses(true),
      },
    };
    for (const x of c.extra || []) {
      const sub = x.slice(base.length);   // /v1/<計算>/<名前>
      const key = sub.slice('/v1/'.length);
      const tool = toolByName[EXTRA_TOOLS[key]];
      const props = tool?.inputSchema?.properties || {};
      paths[sub] = {
        get: {
          operationId: tool ? tool.name : c.mcp_tool + '_' + key.split('/')[1],
          summary: tool ? tool.title : c.title + ' / ' + key.split('/')[1],
          ...(tool ? { description: tool.description, 'x-mcp-tool': tool.name } : {}),
          externalDocs: { url: c.page },
          parameters: Object.entries(props).map(([k, v]) => ({ name: k, in: 'query', required: (tool.inputSchema.required || []).includes(k), description: v.description, schema: { type: 'string' } })),
          responses: { 200: { description: '結果と meta / Result with meta', content: jsonContent(ref('CalcResponse')) }, 400: { description: '計算できなかった / calculation failed', content: jsonContent(ref('Error')) } },
        },
      };
    }
  }
  paths['/mcp'] = {
    post: {
      operationId: 'mcp',
      summary: 'MCP（Streamable HTTP。JSON-RPC 2.0 を POST で送り、JSON で答える。状態を持たない）',
      description: 'MCP に対応したクライアントに、リモートの MCP サーバーとしてこの URL を足す。ツール ' + toolNames.length + ' 本: ' + toolNames.join(', ') + '。GET（SSE）は無く 405。',
      'x-mcp-tools': toolNames,
      requestBody: { required: true, content: jsonContent({ oneOf: [ref('JsonRpcRequest'), { type: 'array', items: ref('JsonRpcRequest') }] }) },
      responses: {
        200: { description: 'JSON-RPC の答え / JSON-RPC response', content: jsonContent({ type: ['object', 'array'] }) },
        202: { description: '通知（id なし）だけのとき、本文なし / Notifications only' },
        400: { description: 'JSON が読めない（-32700） / Parse error', content: jsonContent({ type: 'object' }) },
        413: { description: `本文が ${MAX_BODY / 1024} KB を超えた（-32600） / Body over ${MAX_BODY / 1024} KB`, content: jsonContent({ type: 'object' }) },
      },
    },
  };
  return {
    openapi: '3.1.0',
    info: {
      title: index.title,
      version: index.version,
      description: [index.disclaimer, index.disclaimer_en, 'MCP: ' + index.mcp].filter(Boolean).join('\n\n'),
    },
    servers: [{ url: base }],
    externalDocs: { url: index.docs || SITE + 'api/' },
    paths,
    components: {
      schemas: {
        // 形は yorozu-api src/app.mjs の meta()（テストが答えの欄の名前と突き合わせる）
        Meta: {
          type: 'object',
          properties: {
            calc: { type: 'string' }, page: { type: 'string' },
            source: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } } } },
            checked: { type: 'string' }, disclaimer: { type: 'string' }, disclaimer_en: { type: 'string' },
            lib: { type: 'object', properties: { repo: { type: 'string' }, commit: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } } },
            api_version: { type: 'string' },
          },
        },
        CalcResponse: { type: 'object', required: ['result', 'meta'], properties: { result: { type: 'object' }, meta: ref('Meta') } },
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' }, meta: ref('Meta') } },
        JsonRpcRequest: { type: 'object', required: ['jsonrpc', 'method'], properties: { jsonrpc: { const: '2.0' }, id: { type: ['string', 'integer', 'null'] }, method: { type: 'string' }, params: { type: 'object' } } },
      },
    },
  };
}

// llms.txt の 1 行（llmstxt.org の `- [名前](URL): 説明`）
function llmsLine(name, info, extra) {
  return `- [${md(name)}](${info.url})${info.desc ? ': ' + info.desc : ''}${extra}`;
}
export function buildLlms({ pages, urls, info }, ds, api) {
  const all = new Set(urls);
  const guide = (u) => (all.has(u + 'guide.html') ? u + 'guide.html' : null);
  const other = (i, lang) => (i[lang] && i[lang] !== i.url ? i[lang] : null);
  const L = [];
  L.push('# yorozu-craft');
  L.push('');
  L.push('> 登録なしで使える無料のブラウザの道具（制度の計算機・学校の計算・印刷物・クイズ・情シスの道具など）。入力は端末の中で計算し、サーバーに送りません。運営は個人（Youhei Oonuki）。');
  L.push('');
  const enTop = info[SITE + 'en/'];
  if (enTop && enTop.desc) L.push(`- English: ${enTop.desc} (${enTop.url})`);
  L.push('- 制度・税・法令の値は一次資料（e-Gov 法令検索・国税庁・厚生労働省など）の原文で確かめ、各ページと各データに出典と確認日があります。結果は目安で、個別の判断は原文と窓口で確かめてください。');
  L.push('- データ（下の「データ」）は CC0 1.0 で、ファイルの中に license・checked（確認日）・generated（生成日）・source（出典の URL）があります。認証なし・CORS は `Access-Control-Allow-Origin: *` で、ブラウザや agent から直接読めます。');
  L.push('- 引用・リンクに連絡は要りません。運営者情報: ' + SITE + 'about.html');
  L.push('- このファイルは tools/build-agent.mjs が、道具の一覧（data/pages.json）・sitemap・データ・計算の API の定義から書き出したものです（https://github.com/YouheiOonuki/youheioonuki.github.io）。');
  L.push('- 作成日: ' + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10) + '（サイトのビルドのたびに作り直す）');
  L.push('');
  L.push('## 計算の API と MCP');
  L.push('');
  L.push(`- [OpenAPI 3.1](${SITE}api/openapi.json): 計算 ${api.index.calcs.length} 本の HTTP の口（GET か POST の ${API}/v1/<名前>）と入力・答えの形。認証なし、入力は保存しない`);
  L.push(`- [MCP](${api.index.mcp}): Streamable HTTP（POST、JSON の応答、状態なし）。ツール ${api.tools.length} 本: ${api.tools.map((t) => t.name).join(', ')}`);
  L.push(`- [計算の一覧](${API}/v1): 名前・入力・出典・計算に使ったファイルの commit。接続のしかたは ${SITE}api/#calc-api`);
  L.push('');
  L.push('## データ（CC0）');
  L.push('');
  L.push('- [データの一覧](' + SITE + 'api/): 各ファイルの出典・確認日・ライセンス（機械で読むなら ' + SITE + 'api/index.json）');
  for (const d of ds) L.push(`- [${md(d.name)}](${d.url}): ${d.what}。${d.format}、${d.license}、確認日 ${d.checked}、生成日 ${d.generated}`);
  L.push('');
  // 入口: sitemap にあって pages.json に無い「/ で終わるページ」（トップ・英語のトップ・一覧・更新情報など）
  const listed = new Set([...pages.pages, ...pages.en.pages].map((p) => url(p.path)));
  L.push('## 入口');
  L.push('');
  L.push(`- [yorozu-craft トップ](${SITE}): 全部の道具の一覧`);
  for (const u of urls.filter((x) => x.endsWith('/') && x !== SITE && !listed.has(x))) L.push(llmsLine(info[u].title, info[u], ''));
  L.push('');
  // 道具（日本語）: pages.json の節の順、節の中は priority の高い順（トップと同じ並び）
  const jaLine = (p) => {
    const i = info[url(p.path)];
    const g = guide(i.url), en = other(i, 'en');
    return llmsLine(p.title, i, `${g ? `（使い方: ${g}）` : ''}${en ? `（English: ${en}）` : ''}`);
  };
  L.push('## 道具（日本語）');
  const known = new Set(pages.sections.map((s) => s.id));
  const groups = [...pages.sections.map((s) => ({ name: s.name, rows: pages.pages.filter((p) => p.section === s.id) })),
    { name: 'その他', rows: pages.pages.filter((p) => !known.has(p.section)) }];
  for (const g of groups) {
    if (!g.rows.length) continue;
    L.push('');
    L.push('### ' + g.name);
    L.push('');
    for (const p of [...g.rows].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) L.push(jaLine(p));
  }
  L.push('');
  L.push('## English');
  L.push('');
  for (const p of pages.en.pages) {
    const i = info[url(p.path)];
    const g = guide(i.url), ja = other(i, 'ja');
    L.push(llmsLine(p.title, i, `${g ? ` (guide: ${g})` : ''}${ja ? ` (Japanese: ${ja})` : ''}`));
  }
  L.push('');
  L.push('## Optional');
  L.push('');
  L.push(`- [プライバシーポリシー](${SITE}privacy-policy.html)`);
  L.push(`- [スマホで印刷する](${SITE}print-help.html)`);
  L.push(`- [カレンダーに登録する](${SITE}calendar-help.html)`);
  return L.join('\n') + '\n';
}

export function buildApiJson(ds, api) {
  const latest = (k) => ds.map((d) => d[k]).filter(Boolean).sort().at(-1) || null;
  return JSON.stringify({
    title: 'yorozu-craft の公開データの一覧',
    license: 'CC0-1.0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/deed.ja',
    homepage: SITE + 'api/',
    checked: latest('checked'),
    generated: latest('generated'),
    source: [...new Set(ds.flatMap((d) => d.source))],
    note: '各ファイルの checked・generated・source はそのファイルの中の値を写したもの。認証なし、CORS は Access-Control-Allow-Origin: *。',
    datasets: ds.map((d) => ({ name: d.name, what: d.what, url: d.url, format: d.format, license: d.license, checked: d.checked, generated: d.generated, homepage: d.homepage, source: d.source })),
    api: { openapi: SITE + 'api/openapi.json', calcs: API + '/v1', mcp: api.index.mcp, mcp_tools: api.tools.length },
  }, null, 2) + '\n';
}

export function buildApiHtml(ds, api) {
  const MAX_BODY = api.maxBody;
  const rows = ds.map((d) => `        <tr>
          <th scope="row"><a href="${esc(d.url)}">${esc(d.name)}</a><br><span class="fmt">${esc(d.format)}</span></th>
          <td>${esc(d.what)}${d.homepage ? `<br><a href="${esc(d.homepage)}">画面で見る</a>` : ''}</td>
          <td>${esc(d.license)}</td>
          <td>${esc(d.checked)}</td>
          <td>${esc(d.generated)}</td>
          <td><details><summary>${d.source.length} 件</summary><ul class="src">${d.source.map((u) => `<li><a href="${esc(u)}" rel="noopener">${esc(u)}</a></li>`).join('')}</ul></details></td>
        </tr>`).join('\n');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>公開データの一覧（CC0・出典と確認日つき）｜yorozu-craft</title>
  <meta name="description" content="yorozu-craft の公開データ（改定カレンダー・内申点の式・天文カレンダー・元素と首都の一言・元号表・学年早見表）の一覧。どれも CC0 で、ファイルの中に出典・確認日・生成日があります。認証なしで読めます。">
  <meta name="robots" content="index, follow">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${SITE}api/">
  <link rel="alternate" type="application/json" href="${SITE}api/index.json">
  <meta property="og:title" content="公開データの一覧（CC0・出典と確認日つき）｜yorozu-craft">
  <meta property="og:description" content="改定カレンダー・内申点の式・天文カレンダー・元素と首都の一言・元号表・学年早見表。どれも CC0。">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${SITE}api/">
  <meta property="og:image" content="${SITE}og-image.png">
  <meta property="og:site_name" content="yorozu-craft">
  <meta property="og:locale" content="ja_JP">
  <meta name="twitter:card" content="summary">

  <!-- Google AdSense（サイト所有確認 + 広告配信スクリプト） -->
  <meta name="google-adsense-account" content="ca-pub-5375267956079717">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5375267956079717"
     crossorigin="anonymous"></script>

  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <style>body{margin:0}</style>
  <link rel="stylesheet" href="../legal.css">
  <!-- このページだけの追加（calendar-help.html と同じ型）: ダークモードと表 -->
  <style>
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1c1814; --bg-2: #25201a; --card: #2b251e; --text: #ece4d6;
        --muted: #b9ab96; --accent: #e0a066; --border: #4a3f33; --shadow: rgba(0, 0, 0, 0.4);
      }
    }
    .wrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 0.86rem; }
    th, td { border-bottom: 1px solid var(--border); padding: 0.45rem 0.4rem; text-align: left; vertical-align: top; }
    thead th { font-size: 0.8rem; color: var(--muted); }
    @media (min-width: 641px) { td:nth-of-type(n+2):not(:last-child), td:last-child summary { white-space: nowrap; } }
    .fmt { font-weight: 400; font-size: 0.78rem; color: var(--muted); }
    summary { cursor: pointer; color: var(--accent); }
    .src { margin: 0.3rem 0 0; padding-left: 1rem; }
    .src li { overflow-wrap: anywhere; font-size: 0.78rem; }
    code { overflow-wrap: anywhere; }
    @media (max-width: 640px) {
      thead { display: none; }
      table, tbody, tr, th, td { display: block; width: auto; }
      tr { border-bottom: 1px solid var(--border); padding: 0.4rem 0; }
      th, td { border: 0; padding: 0.15rem 0; }
      td:nth-of-type(2)::before { content: "ライセンス: "; color: var(--muted); }
      td:nth-of-type(3)::before { content: "確認日: "; color: var(--muted); }
      td:nth-of-type(4)::before { content: "生成日: "; color: var(--muted); }
    }
  </style>
</head>
<body>

  <header class="site-bar"><a href="../">yorozu-craft</a></header>

  <main>
    <article>
      <h1>公開データの一覧</h1>
      <p>yorozu-craft の道具が使っている値のうち、ほかの道具やプログラムでも使えるものを、ファイルのまま置いています。どれも CC0（パブリック・ドメイン提供）で、ファイルの中に出典（source）・確認日（checked）・生成日（generated）があります。登録や鍵は要らず、ブラウザやプログラムから直接読めます（<code>Access-Control-Allow-Origin: *</code>）。</p>

      <h2 id="list">ファイル</h2>
      <div class="wrap">
      <table>
        <thead><tr><th scope="col">データ</th><th scope="col">中身</th><th scope="col">ライセンス</th><th scope="col">確認日</th><th scope="col">生成日</th><th scope="col">出典</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
      </div>

      <h2 id="calc-api">計算の API と MCP の接続</h2>
      <p>サイトの計算機と同じ計算を、プログラムや AI の道具から呼べます。登録や鍵は要らず、入力は保存しません。結果は目安で、どの結果にも出典と確認日が付きます。</p>
      <dl>
        <dt>MCP</dt>
        <dd><code>${esc(api.index.mcp)}</code> を、MCP に対応したクライアントにリモートの MCP サーバーとして足します（Streamable HTTP。POST の JSON-RPC に JSON で答え、状態は持ちません）。ツールは ${api.tools.length} 本です。</dd>
        <dt>HTTP</dt>
        <dd><code>${esc(API)}/v1/&lt;名前&gt;</code> に GET（入力はクエリ）か POST（JSON の本文、${MAX_BODY / 1024} KB まで）。計算の一覧は <a href="${esc(API)}/v1">/v1</a>、入力と答えの形は <a href="./openapi.json">openapi.json</a>（OpenAPI 3.1）にあります。</dd>
      </dl>

      <h2 id="use">使うときに</h2>
      <ul>
        <li>確認日は出典の原文を確かめた日、生成日はファイルの中身が変わった日です。制度の値は改正で変わるので、判断には出典の原文を確かめてください。</li>
        <li>表示の義務はありませんが、「出典: yorozu-craft（各ページの URL）」と書いてもらえると、どこで使われているかが分かって助かります。</li>
        <li>機械で読むための一覧: <a href="./index.json">index.json</a>。道具の一覧（agent 向け）: <a href="../llms.txt">llms.txt</a>。カレンダーの登録のしかた: <a href="../calendar-help.html">カレンダーに登録する</a>。</li>
        <li>このページと index.json は、各ファイルの中の値から機械で書き出しています（tools/build-agent.mjs）。</li>
      </ul>
    </article>
  </main>

  <footer>
    <nav aria-label="フッターナビゲーション">
      <ul>
        <li><a href="../">yorozu-craft トップ</a></li>
        <li><a href="../about.html">運営者情報</a></li>
        <li><a href="../privacy-policy.html">プライバシーポリシー</a></li>
      </ul>
    </nav>
    <p>&copy; 2026 yorozu-craft. All rights reserved.</p>
  </footer>

  <!-- Cloudflare Web Analytics（Cookie を使わないアクセス解析） --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "b79bf821e1fd4b6683866d493b1de426"}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--write-fixture')) {
  try {
    const fx = await apiFixture(apiDirDefault());
    mkdirSync(dirname(FIXTURE), { recursive: true });
    writeFileSync(FIXTURE, JSON.stringify(fx, null, 2) + '\n');
    console.log(FIXTURE + ' を書いた（計算 ' + fx.index.calcs.length + '・ツール ' + fx.tools.length + '）');
  } catch (e) { console.error('build-agent: ' + e.message); process.exit(1); }
} else if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ds = await readDatasets();
  const bad = problems(ds);
  {
    if (bad.length) { for (const b of bad) console.error(b); process.exit(1); }
    let api;
    try { api = await readApiDir(apiDirDefault()); } catch (e) { console.error('build-agent: ' + e.message); process.exit(1); }
    const html = buildApiHtml(ds, api);
    const site = await readSite({ [SITE + 'api/']: html });
    const openapi = buildOpenApi(api);
    const out = process.env.AGENT_OUT || root;
    mkdirSync(join(out, 'api'), { recursive: true });
    writeFileSync(join(out, 'llms.txt'), buildLlms(site, ds, api));
    writeFileSync(join(out, 'api/index.json'), buildApiJson(ds, api));
    writeFileSync(join(out, 'api/index.html'), html);
    writeFileSync(join(out, 'api/openapi.json'), JSON.stringify(openapi, null, 2) + '\n');
    console.log('llms.txt・api/index.json・api/index.html・api/openapi.json を書き出した（データ ' + ds.length + ' 件、ページ ' + Object.keys(site.info).length +
      ' 件、API の口 ' + Object.keys(openapi.paths).length + '・MCP のツール ' + api.tools.length + '）');
  }
}
