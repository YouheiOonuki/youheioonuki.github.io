#!/usr/bin/env node
// yorozu-craft サイト横断チェック（README「共通の確認テスト」）
// 本番の公開ページを巡回して、全ツールに共通の決まりが守られているかを機械的に確かめる。
// 使い方: node tools/check-site.mjs            … https://yorozu-craft.com/ を確認
//         node tools/check-site.mjs <ベースURL> … 別の場所（ローカル配信など）を確認
// 失敗が1件でもあれば終了コード 1。外部パッケージは使わない（Node 20 以上の fetch だけ）。

const BASE = (process.argv[2] || 'https://yorozu-craft.com/').replace(/\/?$/, '/');
const ORIGIN = new URL(BASE).origin;
const ADSENSE_ID = 'ca-pub-5375267956079717';
const BEACON_TOKEN = 'b79bf821e1fd4b6683866d493b1de426';

// 決まりの例外（理由つき）
// 全画面で操作するツール本体は、広告スクリプトを入れず所有確認の meta だけ（README「ツールを追加するとき」5）
const META_ONLY_PAGES = new Set([
  '/hoshizora-sanpo/',     // プラネタリウムの全画面の本体
  '/todofuken-quiz/',      // こどもが遊ぶ画面（決定 D18: 広告は保護者向けの guide.html だけ）
  '/bingo/',               // 会場で大画面に映す抽選画面（広告はカード印刷・使い方のページ）
  '/bingo/en/',            // 同上の英語版
  '/hoshizora-sanpo/en/',  // プラネタリウムの全画面の本体（英語版）
]);
// 共通ページへの直リンクを持たなくてよいページ（全画面の本体。運営者情報へは「このアプリについて」から 1 ホップ）
const NO_COMMON_LINK_PAGES = new Set(['/hoshizora-sanpo/', '/hoshizora-sanpo/en/']);

const failures = [];
const notes = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

// 同じ URL は 1 回だけ取得する
const cache = new Map();
async function get(url) {
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      for (let i = 0; i < 3; i++) {
        try {
          const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'yorozu-craft-check-site' } });
          const body = /text|xml|json|javascript|manifest/.test(r.headers.get('content-type') || '') ? await r.text() : '';
          return { status: r.status, type: r.headers.get('content-type') || '', body, location: r.headers.get('location') };
        } catch (e) {
          if (i === 2) return { status: 0, type: '', body: '', error: String(e) };
          await new Promise(res => setTimeout(res, 1000 * (i + 1)));
        }
      }
    })());
  }
  return cache.get(url);
}

// 並列数を抑えて順に処理する
async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

const path = u => new URL(u).pathname;
const count = (s, re) => (s.match(re) || []).length;
const hrefs = html => [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
// <link rel="alternate" hreflang="…" href="…"> を { 言語: href } にする（属性の順番は問わない）
const alternates = html => {
  const out = {};
  for (const m of html.matchAll(/<link\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\srel="alternate"/.test(tag)) continue;
    const lang = (tag.match(/\shreflang="([^"]+)"/) || [])[1];
    const href = (tag.match(/\shref="([^"]+)"/) || [])[1];
    if (lang && href) out[lang] = href;
  }
  return out;
};
const langOf = html => ((html.match(/<html\b[^>]*\slang="([^"]+)"/) || [])[1] || '');
// 共通ページ（日本語と英語）
const COMMON_JA = ['/about.html', '/privacy-policy.html'];
const COMMON_EN = ['/en/about.html', '/en/privacy-policy.html'];
// 公開 URL（https://yorozu-craft.com/...）を、確認先のベース URL に読み替える
const toBase = u => u.replace(/^https:\/\/yorozu-craft\.com\//, BASE);

// 1. robots.txt → 各 sitemap → 各ページ
const robots = await get(BASE + 'robots.txt');
if (robots.status !== 200) fail('robots.txt', `status ${robots.status}`);
const sitemaps = [...robots.body.matchAll(/^Sitemap:\s*(\S+)/gim)].map(m => toBase(m[1]));
if (!sitemaps.length) fail('robots.txt', 'Sitemap の行が無い');

const pages = new Set([BASE, BASE + 'about.html', BASE + 'privacy-policy.html']);
const toolsWithEn = new Set(); // sitemap に /<ツール>/en/ を載せているツール
for (const sm of sitemaps) {
  const r = await get(sm);
  if (r.status !== 200) { fail(path(sm), `sitemap が ${r.status}`); continue; }
  const tool = path(sm).split('/').filter(Boolean).length >= 2 ? path(sm).split('/')[1] : null;
  for (const m of r.body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const loc = toBase(m[1].trim());
    pages.add(loc);
    if (tool && path(loc).startsWith(`/${tool}/en/`)) toolsWithEn.add(tool);
  }
}

// 2. トップのツール一覧と robots.txt の sitemap が一致しているか
const top = await get(BASE);
// ./en/ は英語のトップ（ツールではない）
const toolsOnTop = new Set(hrefs(top.body).map(h => h.match(/^\.\/([^/]+)\/$/)).filter(Boolean).map(m => m[1]).filter(t => t !== 'en'));
// ツールの sitemap は /<ツール>/sitemap.xml。ドメイン直下の /sitemap.xml（トップ自身）は除く
const toolsInRobots = new Set(sitemaps.map(s => path(s).split('/').filter(Boolean)).filter(seg => seg.length >= 2).map(seg => seg[0]));
for (const t of toolsOnTop) if (!toolsInRobots.has(t)) fail('robots.txt', `トップに載っている ${t} の Sitemap が無い`);
for (const t of toolsInRobots) if (!toolsOnTop.has(t)) fail('index.html', `robots.txt にある ${t} がトップのツール一覧に無い`);

// 2b. 英語のトップ（/en/）の一覧と、sitemap に英語ページ（/<ツール>/en/）を載せているツールが一致しているか（README「ツールを追加するとき」23）
// ルートの sitemap.xml に /en/ が載っているときだけ確かめる（英語のトップを公開する前の本番でも通るように）
if (pages.has(BASE + 'en/')) {
  const enTop = await get(BASE + 'en/');
  const toolsOnEn = new Set(hrefs(enTop.body).map(h => h.match(/^\.\.\/([^/]+)\/en\/$/)).filter(Boolean).map(m => m[1]));
  for (const t of toolsWithEn) if (!toolsOnEn.has(t)) fail('/en/', `sitemap に英語ページ /${t}/en/ があるのに、英語のトップの一覧に無い`);
  for (const t of toolsOnEn) if (!toolsWithEn.has(t)) fail('/en/', `英語のトップにある ${t} の英語ページ（/${t}/en/）が ${t} の sitemap に無い`);
} else if (toolsWithEn.size) notes.push(`英語のトップ /en/ がルートの sitemap.xml に無いため、英語ページの一覧の確認を省略（英語ページのあるツール: ${[...toolsWithEn].join(', ')}）`);

// 3. 各ページの中身
const internalLinks = new Map(); // リンク先 → 出現元
await pool([...pages], 6, async (url) => {
  const p = path(url);
  const r = await get(url);
  if (r.status !== 200) { fail(p, `status ${r.status}`); return; }
  const html = r.body;
  const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);
  if (noindex) { notes.push(`${p}: noindex のため中身の確認を省略`); return; }

  // AdSense（所有確認の meta は全ページ。スクリプトは全画面の本体以外）
  const meta = count(html, new RegExp(`name="google-adsense-account"\\s+content="${ADSENSE_ID}"`, 'g'));
  const script = count(html, new RegExp(`adsbygoogle\\.js\\?client=${ADSENSE_ID}`, 'g'));
  if (meta !== 1) fail(p, `AdSense の meta が ${meta} 個（1 個のはず）`);
  if (META_ONLY_PAGES.has(p)) { if (script !== 0) fail(p, '全画面の本体に広告スクリプトがある'); }
  else if (script !== 1) fail(p, `AdSense のスクリプトが ${script} 個（1 個のはず）`);
  if (/class="adsbygoogle"|広告スペース|ad-placeholder/.test(html)) fail(p, '手動の広告枠・空の広告枠がある');

  // Cloudflare Web Analytics（</body> 直前に 1 個）
  const beacon = count(html, new RegExp(BEACON_TOKEN, 'g'));
  if (beacon !== 1) fail(p, `Cloudflare ビーコンが ${beacon} 個（1 個のはず）`);
  else if (html.indexOf(BEACON_TOKEN) < html.lastIndexOf('</footer>')) fail(p, 'Cloudflare ビーコンがフッターより前にある');

  // canonical が自分の公開 URL と一致
  const canon = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/) || [])[1];
  const expect = 'https://yorozu-craft.com' + p.replace(/index\.html$/, '');
  if (!canon) fail(p, 'canonical が無い');
  else if (canon !== expect) fail(p, `canonical が ${canon}（${expect} のはず）`);

  // ツールのページは共通の運営者情報・プライバシーポリシーへリンクする
  // 英語ページ（<html lang="en">）は英語の共通ページ（/en/…）へ向け、日本語の共通ページには向けない（README「ツールを追加するとき」23）
  const links = hrefs(html);
  const isEn = langOf(html) === 'en';
  const isTool = p.split('/').filter(Boolean).length >= 1 && ![...COMMON_JA, ...COMMON_EN].includes(p);
  if (isTool && !NO_COMMON_LINK_PAGES.has(p)) {
    const resolved = links.map(h => { try { return path(new URL(toBase(h), url)); } catch { return ''; } });
    const [about, privacy] = isEn ? COMMON_EN : COMMON_JA;
    if (!resolved.includes(about)) fail(p, `共通の運営者情報（${about}）へのリンクが無い`);
    if (!resolved.includes(privacy)) fail(p, `共通のプライバシーポリシー（${privacy}）へのリンクが無い`);
    if (isEn) for (const c of COMMON_JA) if (resolved.includes(c)) fail(p, `英語ページが日本語の共通ページ（${c}）へリンクしている（${COMMON_EN.join('・')} に向ける）`);
  }

  // 日英の対（hreflang）。英語ページは日本語の対があり、相手が指し返していること。日本語ページが英語の対を持つときも同じ
  const alt = alternates(html);
  const self = expect;
  const pairOf = isEn ? 'ja' : (alt.en ? 'en' : null);
  if (isEn && !alt.ja) fail(p, '英語ページに hreflang="ja" の対が無い');
  if (pairOf && alt[pairOf]) {
    const back = isEn ? 'en' : 'ja';
    if (alt[back] !== self) fail(p, `hreflang="${back}"（自分自身）が ${alt[back] || '無い'}（${self} のはず）`);
    if (!alt['x-default']) fail(p, 'hreflang="x-default" が無い');
    else if (alt['x-default'] !== (isEn ? alt.ja : self)) fail(p, `hreflang="x-default" が ${alt['x-default']}（日本語ページのはず）`);
    const other = await get(toBase(alt[pairOf]));
    if (other.status !== 200) fail(p, `hreflang="${pairOf}" の ${path(alt[pairOf])} が ${other.status}`);
    else {
      const oalt = alternates(other.body);
      if (oalt[back] !== self) fail(p, `hreflang="${pairOf}" の ${path(alt[pairOf])} が hreflang="${back}" でこのページを指し返していない（${oalt[back] || '無し'}）`);
      if (langOf(other.body) !== pairOf) fail(p, `hreflang="${pairOf}" の ${path(alt[pairOf])} の <html lang> が ${langOf(other.body) || '無し'}`);
    }
  }

  // サイト内リンクを集める（あとでまとめて存在確認）
  for (const h of links) {
    if (/^(mailto:|tel:|javascript:|#)/.test(h)) continue;
    let u;
    try { u = new URL(toBase(h), url); } catch { continue; }
    if (u.origin !== ORIGIN) continue;
    u.hash = ''; u.search = '';
    const key = u.href;
    if (!internalLinks.has(key)) internalLinks.set(key, p);
  }
});

// 4. サイト内リンクの存在確認（リンク切れ）
await pool([...internalLinks.keys()], 6, async (u) => {
  const r = await get(u);
  if (r.status >= 300 && r.status < 400) return; // GitHub Pages の末尾スラッシュ補完など
  if (r.status !== 200) fail(internalLinks.get(u), `リンク切れ ${path(u)}（${r.status}）`);
});

// 5. ツールごとの決まり（404.html・manifest の id・sw.js のキャッシュ名）
await pool([...toolsOnTop], 4, async (t) => {
  const nf = await get(`${BASE}${t}/__check-site-not-found__.html`);
  if (nf.status !== 404) fail(`/${t}/`, `存在しない URL が ${nf.status}（404 のはず）`);
  else {
    if (!/<title>ページが見つかりません｜yorozu-craft<\/title>/.test(nf.body)) fail(`/${t}/`, '404 がツールの 404.html になっていない（GitHub の既定ページ）');
    if (!nf.body.includes(BEACON_TOKEN)) fail(`/${t}/404.html`, 'Cloudflare ビーコンが無い');
  }
  const mf = await get(`${BASE}${t}/manifest.webmanifest`);
  if (mf.status === 200) {
    let id;
    try { id = JSON.parse(mf.body).id; } catch { fail(`/${t}/manifest.webmanifest`, 'JSON として読めない'); }
    if (id !== undefined && id !== `/${t}/`) fail(`/${t}/manifest.webmanifest`, `id が ${id}（/${t}/ のはず）`);
    if (id === undefined) notes.push(`/${t}/manifest.webmanifest: id が無い（README 13 では必須。start_url が id になる）`);
  }
  // 印刷物の着地ページ（README 22）: sitemap に載せないので、ここで決まりを見る
  const pr = await get(`${BASE}${t}/print/`);
  if (pr.status === 200) {
    const p = `/${t}/print/`;
    if (!/<meta[^>]+name="robots"[^>]+noindex/i.test(pr.body)) fail(p, 'noindex が無い');
    if (count(pr.body, new RegExp(BEACON_TOKEN, 'g')) !== 1) fail(p, 'Cloudflare ビーコンが 1 個でない（紙から来た人を数えられない）');
    if (count(pr.body, new RegExp(`name="google-adsense-account"\\s+content="${ADSENSE_ID}"`, 'g')) !== 1) fail(p, 'AdSense の meta が 1 個でない');
    notes.push(`${p}: 印刷物の着地ページあり`);
  }
  const sw = await get(`${BASE}${t}/sw.js`);
  if (sw.status === 200) {
    const names = [...sw.body.matchAll(/['"`]([a-z0-9-]+-)v?\d*['"`$]/g)].map(m => m[1]);
    if (!sw.body.includes(`${t}-`)) fail(`/${t}/sw.js`, `キャッシュ名が ${t}- で始まっていない`);
    else if (names.some(n => n !== `${t}-` && /-$/.test(n) && !n.startsWith(t))) notes.push(`/${t}/sw.js: ほかの接頭辞らしき文字列がある（${[...new Set(names)].join(', ')}）`);
  }
});

// 結果
console.log(`確認先: ${BASE}`);
console.log(`ページ ${pages.size} 件、サイト内リンク ${internalLinks.size} 件、ツール ${toolsOnTop.size} 件（${[...toolsOnTop].join(', ')}）`);
for (const n of notes) console.log(`メモ  ${n}`);
if (failures.length) {
  for (const f of failures) console.log(`NG    ${f}`);
  console.log(`\n${failures.length} 件の問題があります`);
  process.exit(1);
}
console.log('\nすべて OK');
