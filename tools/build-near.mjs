// 道具のページの「近い道具」（yorozu-plans ROADMAP 7.96・7.98 D365・D368）を、組み上がった配信フォルダの各ページに差し込む。
// 中身は data/near.json（yorozu-ai scripts/near-tools.mjs が困りごと検索の索引から作る。手で直さない）。0 個のページには欄を出さない。
// 置き場は「この道具について」の直前（無ければ </main> の直前）。押した数は near.js が near_click で数える（文は送らない）。
// 下へ送れない全画面のページ（<body> に data-fullscreen。そのページが名乗る）の画面には入れない（yorozu-plans QUEUE Q-564）。使い方には入れる。
// 同じ 3 つを、その道具の使い方（<path>/guide.html）にも本文の末尾（</main> の直前、フッターの前）に差し込む（ROADMAP 7.170 D460）。
// build.ps1 が build-agent.mjs と同じように呼ぶ: NEAR_SITE_DIR=<dist> node tools/build-near.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc } from './common/share-stub.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARK = 'data-near-block';

/** 近い道具の欄の HTML（items が空なら ''） */
export function nearBlock(items, lang = 'ja') {
  if (!items || !items.length) return '';
  const en = lang === 'en';
  const li = items.map((n) => `<li><a href="${esc(n.url)}" data-near-link>${esc(n.title)}</a>${n.note ? `<span>${esc(n.note)}</span>` : ''}</li>`).join('');
  return `<section class="yz-near no-print" ${MARK} aria-labelledby="yz-near-h"><h2 id="yz-near-h">${en ? 'Related tools' : '近い道具'}</h2><ul>${li}</ul></section>` +
    '<script src="/near.js" defer></script>';
}

// 欄の見た目。<style> は <section> の中に置けない（HTML の妥当性、Q-088）ので、injectNear が <head> の終わりに入れる
export const NEAR_STYLE = '<style data-near-style>.yz-near{margin:var(--sp-6,1.5rem) 0}.yz-near h2{font-size:var(--fs-m,1rem);margin:0 0 var(--sp-1,.25rem)}.yz-near ul{list-style:none;margin:0;padding:0}' +
  '.yz-near li{border-top:1px solid var(--border,#ccc)}.yz-near a{display:inline-flex;align-items:center;min-height:44px;font-weight:700}' +
  '.yz-near span{display:block;margin:-6px 0 6px;font-size:var(--fs-s,.875rem);color:var(--muted,#555)}</style>';

const SCREEN_ANCHORS = ['<!-- about-tool:', '<details class="about-tool', '</main>'];
export const GUIDE_ANCHORS = ['</main>'];

/** ページの HTML に欄を差し込む（見た目の <style> は </head> の直前）。既にあれば・置き場（</head> と anchors のどれか）が無ければそのまま。anchors は置き場の候補（前から順に） */
export function injectNear(html, items, lang = 'ja', anchors = SCREEN_ANCHORS) {
  const block = nearBlock(items, lang);
  const head = html.indexOf('</head>');
  if (!block || head < 0 || html.includes(MARK)) return html;
  for (const a of anchors) {
    const i = html.indexOf(a);
    if (i >= head) return html.slice(0, head) + NEAR_STYLE + '\n' + html.slice(head, i) + block + '\n' + html.slice(i);
  }
  return html;
}

/** 開きタグの <body …> に data-fullscreen が在るか（下へ送れない全画面のページの名乗り。yorozu-plans QUEUE 条件 28・Q-564） */
export const isFullscreen = (html) => /<body\b[^>]*\sdata-fullscreen[\s=>/]/.test(html);

/** 道具の画面に欄を差し込む。全画面のページ（data-fullscreen）は下へ送っても欄に届かないので、入った物をそのまま返す */
export function injectScreen(html, items, lang = 'ja') {
  return isFullscreen(html) ? html : injectNear(html, items, lang, SCREEN_ANCHORS);
}

function main() {
  const site = process.env.NEAR_SITE_DIR;
  if (!site) throw new Error('NEAR_SITE_DIR（配信フォルダ）が無い');
  const near = JSON.parse(readFileSync(join(ROOT, 'data', 'near.json'), 'utf8')).near;
  const pages = JSON.parse(readFileSync(join(ROOT, 'data', 'pages.json'), 'utf8'));
  const langOf = new Map([...(pages.pages || []).map((p) => [p.path, 'ja']), ...((pages.en && pages.en.pages) || []).map((p) => [p.path, 'en'])]);
  let done = 0, empty = 0, missing = 0, noPlace = 0, guides = 0, full = 0;
  for (const [path, items] of Object.entries(near)) {
    if (!items.length) { empty++; continue; }
    const dir = join(site, ...path.split('/').filter(Boolean));
    const f = join(dir, 'index.html');
    if (!existsSync(f)) { missing++; continue; }
    const lang = langOf.get(path) || 'ja';
    const before = readFileSync(f, 'utf8');
    const after = injectScreen(before, items, lang);
    if (after !== before) { writeFileSync(f, after); done++; }
    else if (isFullscreen(before)) full++;   // 画面には入れず、使い方には入れる
    else { noPlace++; continue; }
    const g = join(dir, 'guide.html');
    if (!existsSync(g)) continue;
    const gb = readFileSync(g, 'utf8'), ga = injectNear(gb, items, lang, GUIDE_ANCHORS);
    if (ga !== gb) { writeFileSync(g, ga); guides++; }
  }
  console.log(`近い道具: ${done} ページに差し込んだ（使い方に ${guides}。0 個で欄なし ${empty}、ファイル無し ${missing}、全画面で画面に入れない ${full}、置き場なし・済み ${noPlace}）`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
