// 入口から全部の道具に届くか（yorozu-plans QUEUE Q-399）: 4 か所の集合が同じかを、各リポジトリの作業コピーから確かめる
//   (1) 配る repo ＝ robots.txt の Sitemap 行（yorozu-plans の tools/deploy/sync.ps1・build.ps1 も同じ行から配る repo を取る）
//   (2) すべての道具（all/index.html）  (3) sitemap（root の sitemap.xml と各 repo の sitemap.xml）  (4) 入口の検索の一覧（index.html・en/index.html の yt-index。
//       困りごと検索 top-find.js が引く yorozu-ai の索引も data/pages.json の全行から作る: yorozu-ai scripts/build-find-index.mjs）
//   わざと載せないものは tools/build-top.mjs の NOT_ON_TOP（理由はそこのコメント）。数えるページの線は同じファイルの isToolPage
//   一覧に残して索引から外したページ（noindex・sitemap の外）は同じファイルの NOINDEX_ON_TOP（yorozu-plans D899）。名前と noindex を両側から突き合わせる
//   各リポジトリの場所は環境変数 YOROZU_PROJECTS か、このリポジトリの git の本体（worktree でも同じ）の 1 つ上
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectsOf } from '../tools/sync-common.mjs';
import { NOT_ON_TOP, NOINDEX_ON_TOP, isToolPage } from '../tools/build-top.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const PROJECTS = projectsOf(ROOT);
const PAGES_SOURCE = { ADSearch: 'docs' }; // Pages の公開元が最上位でない repo（yorozu-plans tools/deploy/build.ps1 の $PagesSource と同じ）
const repos = [...read('robots.txt').matchAll(/^Sitemap:\s*https:\/\/yorozu-craft\.com\/([^/]+)\/sitemap\.xml/gm)].map((m) => m[1]);
const smFile = (r) => join(PROJECTS, r, PAGES_SOURCE[r] || '', 'sitemap.xml');
const missing = repos.filter((r) => !existsSync(join(PROJECTS, r))); // 隣の repo が無い環境（CI など）では飛ばす。repo があって sitemap.xml が無いのは落とす
const locs = (x) => [...x.matchAll(/<loc>https:\/\/yorozu-craft\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
const index = (f) => JSON.parse(read(f).match(/<script type="application\/json" id="yt-index">(.*?)<\/script>/)[1]).rows.map((r) => r.p);
const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();
const same = (name, a, b, an, bn) => assert.deepEqual([diff(a, b), diff(b, a)], [[], []], `${name}: [${an} にだけある, ${bn} にだけある]`);
// 道具のページ（/<repo>/…/）のファイル。配る repo は隣の作業コピー、サイト本体のフォルダ（/line/ など）はこのリポジトリ
const pageFile = (p) => { const [r, ...rest] = p.split('/').filter(Boolean); return repos.includes(r) ? join(PROJECTS, r, PAGES_SOURCE[r] || '', ...rest, 'index.html') : join(ROOT, r, ...rest, 'index.html'); };
const isNoindex = (f) => /<meta[^>]*name="robots"[^>]*noindex/i.test(readFileSync(f, 'utf8'));
const allLocs = () => new Set([...locs(read('sitemap.xml')), ...repos.flatMap((r) => locs(readFileSync(smFile(r), 'utf8')))]);

test('配る repo・sitemap・/all/・入口の検索の一覧が同じ集合（日本語は pages.json、英語は en.pages。NOT_ON_TOP だけがトップの外）', { skip: missing.length > 0 && `隣の repo が無い（${missing.join(', ')}）` }, () => {
  for (const r of repos) assert.ok(existsSync(smFile(r)), `${r} の sitemap.xml が無い（${smFile(r)}）`);
  const sm = allLocs();
  const data = JSON.parse(read('data/pages.json'));
  const off = new Set(NOT_ON_TOP);
  // 日本語: sitemap の道具のページ（NOT_ON_TOP を除く）＋ NOINDEX_ON_TOP ＝ pages.json ＝ /all/ ＝ トップの検索の一覧
  const smJa = new Set([...[...sm].filter((p) => isToolPage(p) && !off.has(p.split('/')[1])), ...NOINDEX_ON_TOP]);
  const pj = new Set(data.pages.map((p) => p.path));
  const all = new Set([...read('all/index.html').matchAll(/<a\b[^>]* href="\.\.(\/[^"#?]+\/)"/g)].map((m) => m[1]).filter(isToolPage));
  same('sitemap と pages.json', smJa, pj, 'sitemap', 'pages.json');
  same('/all/ と pages.json', all, pj, '/all/', 'pages.json');
  same('トップの検索と pages.json', new Set(index('index.html')), pj, 'index.html の yt-index', 'pages.json');
  // 英語: sitemap の /<ツール>/en/ と /<ツール>/en/<子>/ ＝ en.pages ＝ 英語トップの検索の一覧
  const smEn = new Set([...sm].filter((p) => /^\/[^/]+\/en\/(?:[^/]+\/)?$/.test(p) && !off.has(p.split('/')[1])));
  const en = new Set(data.en.pages.map((p) => p.path));
  same('英語: sitemap と en.pages', smEn, en, 'sitemap', 'en.pages');
  same('英語: トップの検索と en.pages', new Set(index('en/index.html')), en, 'en/index.html の yt-index', 'en.pages');
  // 配る repo ＝ pages.json の道具の repo（サイト本体のフォルダ /line/ /post/ を除く）と NOT_ON_TOP
  const rootDirs = new Set(locs(read('sitemap.xml')).map((p) => p.split('/')[1]).filter(Boolean));
  const toolRepos = new Set([...pj].map((p) => p.split('/')[1]).filter((r) => !rootDirs.has(r)));
  for (const r of off) assert.ok(!toolRepos.has(r), `${r} は NOT_ON_TOP なのに pages.json にある`);
  same('配る repo と pages.json の repo', new Set(repos), new Set([...toolRepos, ...off]), 'robots.txt', 'pages.json＋NOT_ON_TOP');
});

test('NOINDEX_ON_TOP のページは、ファイルに noindex が在り、sitemap に無い（D899）', { skip: missing.length > 0 && `隣の repo が無い（${missing.join(', ')}）` }, () => {
  const sm = allLocs();
  for (const p of NOINDEX_ON_TOP) {
    assert.ok(isNoindex(pageFile(p)), `${p} に noindex が無い（${pageFile(p)}）`);
    assert.ok(!sm.has(p), `${p} が sitemap にある（NOINDEX_ON_TOP は sitemap の外）`);
  }
});

test('pages.json のページで noindex の在る物は、NOINDEX_ON_TOP にある（D899）', { skip: missing.length > 0 && `隣の repo が無い（${missing.join(', ')}）` }, () => {
  const named = new Set(NOINDEX_ON_TOP);
  const noindexed = JSON.parse(read('data/pages.json')).pages.map((p) => p.path).filter((p) => isNoindex(pageFile(p)));
  assert.deepEqual(noindexed.filter((p) => !named.has(p)), [], 'noindex なのに NOINDEX_ON_TOP に無い');
  assert.ok(NOINDEX_ON_TOP.every((p) => noindexed.includes(p)), 'NOINDEX_ON_TOP のページが pages.json に無いか、noindex でない');
});
