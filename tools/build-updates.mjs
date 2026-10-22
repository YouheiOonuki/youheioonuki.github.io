// 更新情報（/updates/。yorozu-plans QUEUE Q-018）の一覧を、組み上がった配信フォルダから作って差し込む。
// 行は 2 種類: data/pages.json の公開日（「公開」）と、各ページの使い方（guide.html）の「更新履歴」（id="changelog"）の最新の 1 行。
// 日付の新しい順に LIMIT 行。英語のページ（/en/ の下）は入れない。手で書いた行は持たない（どの道具の更新履歴が正本）。
// build.ps1 が build-near.mjs と同じように呼ぶ: UPDATES_SITE_DIR=<dist> node tools/build-updates.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LIMIT = 12;   // intro 型の 600 字（QUEUE Q-018）に地の文と合わせて収まる行数
const BEGIN = '<!-- updates:begin -->';
const END = '<!-- updates:end -->';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const MAX_WHAT = 40;   // 1 行の内容の字数（超えたら …。くわしくはリンク先の更新履歴）
const cut = (t) => ([...t].length > MAX_WHAT ? [...t].slice(0, MAX_WHAT).join('') + '…' : t);
const text = (html) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/** guide.html の「更新履歴」の最新の 1 行 → { date, text }。無ければ null。最新は datetime のいちばん新しい行 */
export function latestChange(html) {
  const i = html.indexOf('id="changelog"');
  if (i < 0) return null;
  const part = html.slice(i, html.indexOf('</ul>', i) + 5);
  let best = null;
  for (const m of part.matchAll(/<li>\s*<time datetime="(\d{4}-\d{2}-\d{2})">[^<]*<\/time>([\s\S]*?)<\/li>/g)) {
    if (!best || m[1] > best.date) best = { date: m[1], text: text(m[2]) };
  }
  return best;
}

/** 一覧の行（新しい順、LIMIT 行）。pages: data/pages.json の pages。readGuide(path) → guide.html の中身か null */
export function updateRows(pages, readGuide) {
  const rows = [];
  const seenGuide = new Set();
  for (const p of pages) {
    if (p.path.startsWith('/en/') || p.path.includes('/en/')) continue;
    const name = p.name || p.title;
    if (p.date) rows.push({ date: p.date, url: p.path, name, what: '公開' });
    const dir = p.path.endsWith('/') ? p.path : p.path.replace(/[^/]*$/, '');
    const guide = dir + 'guide.html';
    if (seenGuide.has(guide)) continue;
    seenGuide.add(guide);
    const html = readGuide(guide);
    const c = html && latestChange(html);
    // 公開と同じ日の「公開」の行は重ねない
    if (c && !(c.date === p.date && /^公開/.test(c.text))) rows.push({ date: c.date, url: guide, name, what: cut(c.text) });
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.url.localeCompare(b.url)));
  return rows.slice(0, LIMIT);
}

export function updatesHtml(rows) {
  const li = rows.map((r) => `        <li><time datetime="${r.date}">${r.date}</time> <a href="${esc(r.url)}">${esc(r.name)}</a>: ${esc(r.what)}</li>`).join('\n');
  return `${BEGIN}\n      <ul class="updates-list">\n${li}\n      </ul>\n      ${END}`;
}

export function fill(html, rows) {
  const a = html.indexOf(BEGIN), b = html.indexOf(END);
  if (a < 0 || b < a) throw new Error('updates/index.html に ' + BEGIN + ' 〜 ' + END + ' が無い');
  return html.slice(0, a) + updatesHtml(rows) + html.slice(b + END.length);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const site = process.env.UPDATES_SITE_DIR;
  if (!site) { console.error('UPDATES_SITE_DIR（配信フォルダ）を指定してください'); process.exit(2); }
  const target = join(site, 'updates', 'index.html');
  if (!existsSync(target)) { console.log('更新情報: /updates/ が配信フォルダに無いので何もしない'); process.exit(0); }
  const { pages } = JSON.parse(readFileSync(join(ROOT, 'data', 'pages.json'), 'utf8'));
  const readGuide = (p) => { const f = join(site, ...p.split('/').filter(Boolean)); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
  const rows = updateRows(pages, readGuide);
  writeFileSync(target, fill(readFileSync(target, 'utf8'), rows));
  console.log(`更新情報: ${rows.length} 行を /updates/ に差し込んだ（最新 ${rows[0]?.date ?? '—'}）`);
}
