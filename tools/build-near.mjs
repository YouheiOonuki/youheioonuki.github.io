// 道具のページの「近い道具」（yorozu-plans ROADMAP 7.96・7.98 D365・D368）を、組み上がった配信フォルダの各ページに差し込む。
// 中身は data/near.json（yorozu-ai scripts/near-tools.mjs が困りごと検索の索引から作る。手で直さない）。0 個のページには欄を出さない。
// 置き場は「この道具について」の直前（無ければ </main> の直前）。押した数は near.js が near_click で数える（文は送らない）。
// build.ps1 が build-agent.mjs と同じように呼ぶ: NEAR_SITE_DIR=<dist> node tools/build-near.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARK = 'data-near-block';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 近い道具の欄の HTML（items が空なら ''） */
export function nearBlock(items, lang = 'ja') {
  if (!items || !items.length) return '';
  const en = lang === 'en';
  const li = items.map((n) => `<li><a href="${esc(n.url)}" data-near-link>${esc(n.title)}</a>${n.note ? `<span>${esc(n.note)}</span>` : ''}</li>`).join('');
  return `<section class="yz-near no-print" ${MARK} aria-labelledby="yz-near-h"><h2 id="yz-near-h">${en ? 'Related tools' : '近い道具'}</h2><ul>${li}</ul>` +
    '<style>.yz-near{margin:var(--sp-6,1.5rem) 0}.yz-near h2{font-size:var(--fs-m,1rem);margin:0 0 var(--sp-1,.25rem)}.yz-near ul{list-style:none;margin:0;padding:0}' +
    '.yz-near li{border-top:1px solid var(--border,#ccc)}.yz-near a{display:inline-flex;align-items:center;min-height:44px;font-weight:700}' +
    '.yz-near span{display:block;margin:-6px 0 6px;font-size:var(--fs-s,.875rem);color:var(--muted,#555)}</style></section>' +
    '<script src="/near.js" defer></script>';
}

/** ページの HTML に欄を差し込む。既にあれば・置き場が無ければそのまま */
export function injectNear(html, items, lang = 'ja') {
  const block = nearBlock(items, lang);
  if (!block || html.includes(MARK)) return html;
  const anchors = ['<!-- about-tool:', '<details class="about-tool', '</main>'];
  for (const a of anchors) {
    const i = html.indexOf(a);
    if (i >= 0) return html.slice(0, i) + block + '\n' + html.slice(i);
  }
  return html;
}

function main() {
  const site = process.env.NEAR_SITE_DIR;
  if (!site) throw new Error('NEAR_SITE_DIR（配信フォルダ）が無い');
  const near = JSON.parse(readFileSync(join(ROOT, 'data', 'near.json'), 'utf8')).near;
  const pages = JSON.parse(readFileSync(join(ROOT, 'data', 'pages.json'), 'utf8'));
  const langOf = new Map([...(pages.pages || []).map((p) => [p.path, 'ja']), ...((pages.en && pages.en.pages) || []).map((p) => [p.path, 'en'])]);
  let done = 0, empty = 0, missing = 0, noPlace = 0;
  for (const [path, items] of Object.entries(near)) {
    if (!items.length) { empty++; continue; }
    const f = join(site, ...path.split('/').filter(Boolean), 'index.html');
    if (!existsSync(f)) { missing++; continue; }
    const before = readFileSync(f, 'utf8');
    const after = injectNear(before, items, langOf.get(path) || 'ja');
    if (after === before) { noPlace++; continue; }
    writeFileSync(f, after);
    done++;
  }
  console.log(`近い道具: ${done} ページに差し込んだ（0 個で欄なし ${empty}、ファイル無し ${missing}、置き場なし・済み ${noPlace}）`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
