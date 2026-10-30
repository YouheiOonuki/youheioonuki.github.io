// アイコン・og 画像・manifest・theme-color を v2 の皮の値で作り直して各リポジトリに配る・確かめる（yorozu-plans ROADMAP 7.140 D416・7.141）
// 使い方:
//   node tools/build-brand.mjs --check <リポジトリのフォルダ ...>        … 文字のもの（theme-color・manifest の 2 色・favicon.svg）が生成物と同じか（違えば終了コード 1）
//   node tools/build-brand.mjs --write <リポジトリのフォルダ ...>        … 文字のものを書き換え、favicon.svg が変わったリポジトリは PNG のアイコンも描き直す
//   node tools/build-brand.mjs --write --png <リポジトリのフォルダ ...>  … PNG のアイコンと og-image.png を必ず描き直す
// PNG を描くには playwright が要る（このリポジトリには置かない。NODE_PATH で既存の node_modules を指す）。
// 値の正本は tools/common/v2/skin.css で、ここは読んで写すだけ（tokens() は build-404.mjs と同じ）。
// 対象: 世界を持つリポジトリ（入口のページが data-skin="base"。D369）は丸ごと外す。本体（youheioonuki.github.io）は入口が土台でも対象。
//   theme-color … 皮のページ（data-skin="base" でない）の既存の行だけ。v1 の色か皮の --bg 以外のトークンなら --bg の明暗 2 行に置き換える。自前の色は残して報告する
//   manifest    … 直下の manifest.webmanifest の background_color・theme_color を明るい --bg に（自前の色なら残して報告する）。
//                 name は start_url のページの title（D419。世界を持つリポジトリにも。本体は除く）
//   favicon.svg … 絵は道具ごとのまま、v1 のトークンの色だけ同じ名前の皮の色（明るい表示の値）に。道具の自前の色は残す
//   PNG         … apple-touch-icon.png・favicon-32.png・icon-192.png・icon-512.png のうち、あるものを favicon.svg から同じ大きさで
//   og-image.png … 1200×630。皮の --bg に --text で題名の字だけ（絵・飾りなし）。題名は data/pages.json の入口の title（本体は manifest の name）
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tokens } from './build-404.mjs';

const ROOT_REPO = 'youheioonuki.github.io';
const HERE = dirname(fileURLToPath(import.meta.url));

// v1 の和紙のトークン（明るい表示）→ 同じ役の皮のトークン。#faf6ee（v1 の --card）は絵の地なので --bg に（7.141 A）
export const V1_TO_SKIN = {
  '#8b4513': '--accent', '#faf6ee': '--bg', '#f0ebe0': '--bg', '#e6dfd0': '--bg-2', '#3a3025': '--text',
  '#6e604f': '--muted', '#f3e6d8': '--accent-soft', '#cfc0a0': '--border', '#857561': '--input-border',
};
const V1_THEME = ['#8b4513', '#1c1814', '#f0ebe0'];
const ICON_PNGS = ['apple-touch-icon.png', 'favicon-32.png', 'icon-192.png', 'icon-512.png'];

// 配る面（ADSearch は docs/ が公開のフォルダ）
export function siteDir(repoDir) {
  return existsSync(join(repoDir, 'docs', 'index.html')) ? join(repoDir, 'docs') : repoDir;
}
const repoName = (repoDir) => basename(resolve(repoDir));
const isBase = (html) => /<html[^>]*data-skin="base"/.test(html);
export function isWorld(repoDir) {
  if (repoName(repoDir) === ROOT_REPO) return false;
  const index = join(siteDir(repoDir), 'index.html');
  return existsSync(index) && isBase(readFileSync(index, 'utf8'));
}

// 公開する HTML（404.html は build-404.mjs の生成物なので外す）
function pages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || ['node_modules', 'tests', 'tools', 'dist'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pages(p));
    else if (name.endsWith('.html') && name !== '404.html') out.push(p);
  }
  return out;
}

// 置き換えてよい色: v1 の色と皮のトークン（明暗）。ほかは道具が自分で選んだ色（夜空・大時計の黒など）なので残す
const replaceable = (t) => new Set([...V1_THEME, ...Object.values(t.light), ...Object.values(t.dark)].map(v => v.toLowerCase()).filter(v => v.startsWith('#')));

// theme-color の行を皮の --bg の明暗 2 行に。返り値 { text, own }（own は残した自前の色）
export function themeColor(html, t = tokens()) {
  if (isBase(html)) return { text: html, own: [] };
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const lines = html.split(/\r?\n/);
  const re = /^(\s*)<meta name="theme-color" content="(#[0-9a-fA-F]{3,8})"[^>]*>\s*$/;
  const hits = lines.map((l, i) => [i, l.match(re)]).filter(([, m]) => m);
  if (!hits.length) return { text: html, own: [] };
  const replace = replaceable(t);
  const own = hits.map(([, m]) => m[2].toLowerCase()).filter(c => !replace.has(c));
  if (own.length) return { text: html, own };
  const indent = hits[0][1][1];
  const pair = [
    `${indent}<meta name="theme-color" content="${t.light['--bg']}" media="(prefers-color-scheme: light)">`,
    `${indent}<meta name="theme-color" content="${t.dark['--bg']}" media="(prefers-color-scheme: dark)">`,
  ];
  const drop = new Set(hits.map(([i]) => i));
  const out = [];
  lines.forEach((l, i) => { if (i === hits[0][0]) out.push(...pair); if (!drop.has(i)) out.push(l); });
  return { text: out.join(eol), own: [] };
}

// 返り値 { text, own }（自前の色が 1 つでもあれば書き換えない）
export function manifest(json, t = tokens()) {
  const re = /("(?:background|theme)_color"\s*:\s*")(#[0-9a-fA-F]{3,8})(")/g;
  const ok = replaceable(t);
  const own = [...json.matchAll(re)].map(m => m[2].toLowerCase()).filter(c => !ok.has(c));
  return own.length ? { text: json, own } : { text: json.replace(re, `$1${t.light['--bg']}$3`), own: [] };
}

export function favicon(svg, t = tokens()) {
  return svg.replace(/#[0-9a-fA-F]{6}\b/g, (c) => {
    const k = V1_TO_SKIN[c.toLowerCase()];
    return k ? t.light[k] : c;
  });
}

// og の題名: 入口の title（data/pages.json）。本体は manifest の name
export function ogTitle(repoDir, root = resolve(HERE, '..'), sub = '') {
  const name = repoName(repoDir);
  if (name === ROOT_REPO) return JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8')).name;
  const data = JSON.parse(readFileSync(join(root, 'data', 'pages.json'), 'utf8'));
  const path = `/${name}/${sub}`;
  const page = data.pages.find(p => p.path === path);
  if (!page) throw new Error(`data/pages.json に ${path} が無い`);
  return page.title;
}

// manifest の name（D419）: start_url のページの title（og と同じ出どころ）。short_name はホーム画面の名で役目が違うので触らない。
// 本体の manifest の name は og の題名の出どころそのものなので書かない。世界を持つリポジトリにも当てる（色ではないので D369 の外）
export function manifestName(json, title) {
  return json.replace(/^(  "name"\s*:\s*)"(?:[^"\\]|\\.)*"/m, `$1${JSON.stringify(title)}`);
}
const startSub = (json) => (JSON.parse(json).start_url || './').replace(/^\.\//, '').replace(/[?#].*$/, '');

export function ogHtml(title, t = tokens()) {
  const esc = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><style>
html, body { margin: 0; width: 1200px; height: 630px; background: ${t.light['--bg']}; }
body { display: flex; align-items: center; justify-content: center; }
h1 { margin: 0; max-width: 1040px; color: ${t.light['--text']}; font-family: ${t.light['--font-ui']}; font-weight: 700; font-size: 80px; line-height: 1.35; text-align: center; word-break: auto-phrase; text-wrap: balance; }
</style></head><body><h1>${esc}</h1></body></html>`;
}

const pngWidth = (file) => readFileSync(file).readUInt32BE(16);

async function render(jobs) {
  if (!jobs.length) return;
  const { chromium } = createRequire(import.meta.url)('playwright');
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const j of jobs) {
    if (j.kind === 'icon') {
      await p.setViewportSize({ width: j.size, height: j.size });
      await p.setContent(`<html><body style="margin:0"><img style="display:block;width:${j.size}px;height:${j.size}px" src="data:image/svg+xml;base64,${Buffer.from(j.svg).toString('base64')}"></body></html>`);
      await p.screenshot({ path: j.file, omitBackground: true });
    } else {
      await p.setViewportSize({ width: 1200, height: 630 });
      await p.setContent(j.html);
      // 2 行に収まらなければ字を小さくする
      await p.evaluate(() => { const h = document.querySelector('h1'); let s = 80; while (h.scrollHeight > 470 && s > 40) { s -= 4; h.style.fontSize = s + 'px'; } });
      await p.screenshot({ path: j.file });
    }
    console.log(`描いた ${j.file}`);
  }
  await b.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args.find(a => a === '--check' || a === '--write');
  const forcePng = args.includes('--png');
  const dirs = args.filter(a => !a.startsWith('--'));
  if (!mode || !dirs.length) { console.error('使い方: node tools/build-brand.mjs --check|--write [--png] <リポジトリのフォルダ ...>'); process.exit(2); }
  const t = tokens();
  let bad = 0;
  const jobs = [];
  const put = (file, have, want) => {
    if (have === want) return false;
    if (mode === '--write') { writeFileSync(file, want); console.log(`書いた ${file}`); }
    else { bad++; console.log(`違う ${file}`); }
    return true;
  };
  for (const d of dirs) {
    const site = siteDir(d);
    const mfn = join(site, 'manifest.webmanifest');
    if (repoName(d) !== ROOT_REPO && existsSync(mfn)) {
      const have = readFileSync(mfn, 'utf8');
      put(mfn, have, manifestName(have, ogTitle(d, undefined, startSub(have))));
    }
    if (isWorld(d)) { console.log(`外す ${d}（世界を持つ。D369）`); continue; }
    for (const f of pages(site)) {
      const have = readFileSync(f, 'utf8');
      const { text, own } = themeColor(have, t);
      if (own.length) console.log(`残す ${f}（自前の theme-color ${own.join(' ')}）`);
      put(f, have, text);
    }
    const mf = join(site, 'manifest.webmanifest');
    if (existsSync(mf)) {
      const have = readFileSync(mf, 'utf8');
      const { text, own } = manifest(have, t);
      if (own.length) console.log(`残す ${mf}（自前の色 ${own.join(' ')}）`);
      put(mf, have, text);
    }
    const fav = join(site, 'favicon.svg');
    if (existsSync(fav)) {
      const have = readFileSync(fav, 'utf8');
      const want = favicon(have, t);
      const changed = put(fav, have, want);
      if (mode === '--write' && (changed || forcePng)) {
        for (const n of ICON_PNGS) { const f = join(site, n); if (existsSync(f)) jobs.push({ kind: 'icon', file: f, size: pngWidth(f), svg: want }); }
      }
    }
    const og = join(site, 'og-image.png');
    if (mode === '--write' && forcePng && existsSync(og)) jobs.push({ kind: 'og', file: og, html: ogHtml(ogTitle(d), t) });
  }
  await render(jobs);
  process.exit(bad ? 1 : 0);
}
