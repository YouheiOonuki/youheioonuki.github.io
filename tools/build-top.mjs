// トップの「新しいツール」の欄を data/pages.json から作り直す（yorozu-plans 企画書 59）
// 使い方: node tools/build-top.mjs          … index.html の <!-- new-tools:begin --> 〜 <!-- new-tools:end --> を書き換える
//         node tools/build-top.mjs --check  … 書き換えが要るか（要れば終了コード 1）
// 並び: 公開日の新しい順、同じ日は data/pages.json の並び順。件数は newCount（既定 6）
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '<!-- new-tools:begin -->';
const END = '<!-- new-tools:end -->';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 欄に出す名前: short があればそれ、無ければ題名から括弧書き（（令和8年分）など）を落とす
export const shortTitle = (t) => t.replace(/（[^）]*）/g, '').trim();

export function loadPages(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'data', 'pages.json'), 'utf8'));
}

export function newest(data) {
  const n = data.newCount || 6;
  return data.pages.map((p, i) => ({ ...p, i })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.i - b.i)).slice(0, n);
}

// トップの欄の HTML（リンクは相対 ./。日付は <time>）
export function newToolsHtml(data) {
  const items = newest(data).map((p) => `        <li><a href=".${p.path}">${esc(p.short || shortTitle(p.title))}</a> <time datetime="${p.date}">${p.date.slice(5).replace('-', '/')}</time></li>`);
  return `${BEGIN}\n      <ul class="new-list">\n${items.join('\n')}\n      </ul>\n      ${END}`;
}

export function apply(html, data) {
  const b = html.indexOf(BEGIN), e = html.indexOf(END);
  if (b < 0 || e < 0) throw new Error('index.html に new-tools:begin / end が無い');
  return html.slice(0, b) + newToolsHtml(data) + html.slice(e + END.length);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const f = join(ROOT, 'index.html');
  const html = readFileSync(f, 'utf8');
  const next = apply(html, loadPages());
  if (process.argv.includes('--check')) {
    if (next !== html) { console.log('トップの「新しいツール」が data/pages.json と違う。node tools/build-top.mjs を実行する'); process.exit(1); }
    console.log('トップの「新しいツール」は最新'); process.exit(0);
  }
  if (next !== html) writeFileSync(f, next);
  console.log(newest(loadPages()).map((p) => `${p.date} ${p.path}`).join('\n'));
}
