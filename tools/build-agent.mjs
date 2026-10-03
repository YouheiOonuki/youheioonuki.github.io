// agent 向けの読み口（yorozu-plans ROADMAP 7.17 の K133）: /llms.txt と /api/index.html・/api/index.json を書き出す
//   node tools/build-agent.mjs            書き出す（本番の sitemap・ページ・データを読む）
//   node tools/build-agent.mjs --verify   書き出したファイルと本番のデータが食い違っていないかだけを確かめる（終了コード 1 で知らせる）
// 手で直さない。ツールの一覧は本番の robots.txt → 各 sitemap.xml → 各ページの <title> と meta description から、
// データの一覧は下の DATASETS の各ファイルの中の license・checked・generated・source から作る。
// データを足したら DATASETS に 1 行足して、走らせ直す。robots.txt は変えない（7.17: 全部許可のまま）。
//
// まだ本番に出ていないデータを読むとき（各リポジトリの枝で確かめるとき）は、AGENT_LOCAL に手元のフォルダの型を渡す:
//   AGENT_LOCAL='/home/user/{repo}' node tools/build-agent.mjs   （{repo} がリポジトリ名に置き換わる。無いファイルは本番から読む）
// プロキシのある環境では NODE_USE_ENV_PROXY=1 を付ける。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://yorozu-craft.com/';

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
async function get(url) {
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
export function icsMeta(text) {
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

export async function readDatasets() {
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

// ツールの一覧: 本番の sitemap にある「/ で終わるページ」（入口・道具・読みもの）。トップ・英語のトップ・用途別の入口は別に並べる
export async function readTools() {
  const robots = await get(SITE + 'robots.txt');
  const maps = [...robots.matchAll(/^Sitemap:\s*(\S+)/gm)].map((m) => m[1]);
  const groups = [];
  for (const sm of maps) {
    const xml = await get(sm);
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    const set = new Set(urls);
    const pages = [];
    for (const u of urls.filter((x) => x.endsWith('/'))) {
      const html = await get(u);
      const title = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const desc = decode((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
      pages.push({ url: u, title, desc, guide: set.has(u + 'guide.html') ? u + 'guide.html' : null, en: /\/en\//.test(u.slice(SITE.length - 1)) });
    }
    groups.push({ sitemap: sm, repo: sm.slice(SITE.length).split('/')[0] || '', pages });
  }
  return groups;
}

export function buildLlms(groups, ds) {
  const L = [];
  L.push('# yorozu-craft');
  L.push('');
  L.push('> 登録なしで使える無料のブラウザの道具（制度の計算機・学校の計算・印刷物・クイズ・情シスの道具など）。入力は端末の中で計算し、サーバーに送りません。運営は個人（Youhei Oonuki）。');
  L.push('');
  L.push('- 制度・税・法令の値は一次資料（e-Gov 法令検索・国税庁・厚生労働省など）の原文で確かめ、各ページと各データに出典と確認日があります。結果は目安で、個別の判断は原文と窓口で確かめてください。');
  L.push('- データ（下の「データ」）は CC0 1.0 で、ファイルの中に license・checked（確認日）・generated（生成日）・source（出典の URL）があります。認証なし・CORS は `Access-Control-Allow-Origin: *` で、ブラウザや agent から直接読めます。');
  L.push('- 引用・リンクに連絡は要りません。運営者情報: ' + SITE + 'about.html');
  L.push('- このファイルは tools/build-agent.mjs が本番の sitemap とデータから書き出したものです（https://github.com/YouheiOonuki/youheioonuki.github.io）。');
  L.push('');
  L.push('## データ（CC0）');
  L.push('');
  L.push('- [データの一覧](' + SITE + 'api/): 各ファイルの出典・確認日・ライセンス（機械で読むなら ' + SITE + 'api/index.json）');
  for (const d of ds) L.push(`- [${md(d.name)}](${d.url}): ${d.what}。${d.format}、${d.license}、確認日 ${d.checked}、生成日 ${d.generated}`);
  L.push('');
  const top = [], en = [];
  for (const g of groups) {
    for (const p of g.pages) {
      if (p.url === SITE) continue;
      if (p.url === SITE + 'en/' || p.url.startsWith(SITE + 'for/')) { top.push(p); continue; }
      if (p.en) en.push(p); else (g.ja = g.ja || []).push(p);
    }
  }
  const line = (p) => `- [${md(p.title)}](${p.url})${p.desc ? ': ' + p.desc : ''}${p.guide ? `（使い方: ${p.guide}）` : ''}`;
  L.push('## 入口');
  L.push('');
  L.push(`- [yorozu-craft トップ](${SITE}): 全部の道具の一覧`);
  for (const p of top) L.push(line(p));
  L.push('');
  L.push('## 道具（日本語）');
  for (const g of groups) {
    if (!g.ja || !g.ja.length) continue;
    L.push('');
    L.push('### ' + (g.repo || 'yorozu-craft'));
    L.push('');
    for (const p of g.ja) L.push(line(p));
  }
  L.push('');
  L.push('## English');
  L.push('');
  for (const p of en) L.push(line(p));
  L.push('');
  L.push('## Optional');
  L.push('');
  L.push(`- [プライバシーポリシー](${SITE}privacy-policy.html)`);
  L.push(`- [スマホで印刷する](${SITE}print-help.html)`);
  L.push(`- [カレンダーに登録する](${SITE}calendar-help.html)`);
  return L.join('\n') + '\n';
}

export function buildApiJson(ds) {
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
  }, null, 2) + '\n';
}

export function buildApiHtml(ds) {
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

  <!-- Google AdSense（サイト所有確認 + 広告配信スクリプト） -->
  <meta name="google-adsense-account" content="ca-pub-5375267956079717">
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5375267956079717"
     crossorigin="anonymous"></script>

  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="../apple-touch-icon.png">
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

  <div class="site-bar"><a href="../">yorozu-craft</a></div>

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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ds = await readDatasets();
  const bad = problems(ds);
  if (process.argv.includes('--verify')) {
    // 書き出したファイルが今のデータと同じか（データの checked・generated が変わったら書き出し直す）
    const now = existsSync(join(root, 'api/index.json')) ? readFileSync(join(root, 'api/index.json'), 'utf8') : '';
    if (now !== buildApiJson(ds)) bad.push('api/index.json が今のデータと違う。node tools/build-agent.mjs を実行する');
    for (const b of bad) console.error(b);
    if (bad.length) process.exit(1);
    console.log('OK: データ ' + ds.length + ' 件');
  } else {
    if (bad.length) { for (const b of bad) console.error(b); process.exit(1); }
    const groups = await readTools();
    mkdirSync(join(root, 'api'), { recursive: true });
    writeFileSync(join(root, 'llms.txt'), buildLlms(groups, ds));
    writeFileSync(join(root, 'api/index.json'), buildApiJson(ds));
    writeFileSync(join(root, 'api/index.html'), buildApiHtml(ds));
    console.log('llms.txt・api/index.json・api/index.html を書き出した（データ ' + ds.length + ' 件、ページ ' + groups.reduce((a, g) => a + g.pages.length, 0) + ' 件）');
  }
}
