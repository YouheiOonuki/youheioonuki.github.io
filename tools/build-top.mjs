// トップ・すべての道具・用途別の入口・英語トップの、データから作る欄を作り直す（yorozu-plans 企画書 59・ROADMAP 7.23「トップの構成」）
// 使い方: node tools/build-top.mjs          … 下の PAGES の <!-- top:<欄>:begin --> 〜 end と <!-- new-tools:begin --> 〜 end を書き換える
//         node tools/build-top.mjs --check  … 書き換えが要るか（要れば終了コード 1。「いまの時期」の月の違いは見ない）
// データ: data/pages.json（ページ・別名・用途の節・英語の行）と data/season.json（月 → 最大 3 ページと理由）
// 欄:
//   search   … 検索欄（端末の中だけで絞る。top.js）       season … いまの時期（作った日の月。ページを開いた月が違えば top.js が入れ替える）
//   sections … 用途の節（各節 3 行、残りは <details>）   all    … すべての道具（/all/。節ごとに全行）
//   data     … 検索の一覧と季節表の JSON（top.js が読む）  new-tools … 新しいツール（公開日の新しい順に newCount 件）
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BEGIN = '<!-- new-tools:begin -->';
const END = '<!-- new-tools:end -->';

// top.js（ブラウザと同じ関数）を読む
export function loadTop(root = ROOT) {
  const ctx = { globalThis: {} };
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(join(root, 'top.js'), 'utf8'), ctx);
  return ctx.YorozuTop;
}
const YT = loadTop();
const esc = YT.esc;
// 欄に出す名前: short があればそれ、無ければ題名から括弧書き（（令和8年分）など）を落とす
export const shortTitle = (t) => t.replace(/（[^）]*）/g, '').trim();
const label = (p) => p.short || shortTitle(p.title);

export function loadPages(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'data', 'pages.json'), 'utf8'));
}
export function loadSeason(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'data', 'season.json'), 'utf8'));
}

const byDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.i - b.i);
export function newest(data) {
  const n = data.newCount || 6;
  return data.pages.map((p, i) => ({ ...p, i })).sort(byDate).slice(0, n);
}

// 新しいツール: 横 1 行のチップ（自動で流れない）。base はページから見たサイトの根（トップは ./）
export function newToolsHtml(data, base = './', rows = newest(data)) {
  const items = rows.map((p) => `        <li><a href="${base}${p.path.slice(1)}">${esc(p.short || shortTitle(p.title))}</a></li>`);
  return `${BEGIN}\n      <ul class="yt-chips yt-new">\n${items.join('\n')}\n      </ul>\n      ${END}`;
}

// ---- 節 ----
// 行の並び: 公開日の古い順（同じ日は data/pages.json の sections の順）。Cloudflare の遷移の実測がそろうまで（7.23）
export function sectionsJa(data) {
  const map = new Map(data.pages.map((p) => [p.path, p]));
  return data.sections.map((s) => ({
    ...s,
    rows: s.rows.map((r, i) => {
      const p = map.get(r.path);
      if (!p) throw new Error(`節 ${s.name} の行 ${r.path} が pages に無い`);
      const chips = (r.chips || []).map((c) => (typeof c === 'string' ? { path: c } : c));
      for (const c of chips) if (!map.has(c.path)) throw new Error(`チップ ${c.path} が pages に無い`);
      if ((r.chips || []).length > 3) throw new Error(`${r.path} のチップが 3 つより多い`);
      if ([...r.note].length > 15) throw new Error(`${r.path} の一言が 15 字より長い: ${r.note}`);
      return { ...r, name: r.name || label(p), date: p.date, i, chips: chips.map((c) => ({ path: c.path, name: c.name || label(map.get(c.path)) })) };
    }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i)),
  }));
}
// どのページがどの節か: 節の行 → その節。チップ → その行の節。ほかは入口（/<ツール>/）の節
export function sectionOf(data) {
  const out = new Map();
  for (const s of data.sections) for (const r of s.rows) out.set(r.path, s.id);
  for (const s of data.sections) for (const r of s.rows) for (const c of r.chips || []) { const cp = typeof c === 'string' ? c : c.path; if (!out.has(cp)) out.set(cp, s.id); }
  for (const p of data.pages) {
    if (out.has(p.path)) continue;
    const rootPath = '/' + p.path.split('/')[1] + '/';
    if (!out.has(rootPath)) throw new Error(`${p.path} の入口 ${rootPath} がどの節にも無い（sections に 1 行足す）`);
    out.set(p.path, out.get(rootPath));
  }
  return out;
}

const VISIBLE = 3;
function rowHtml(r, base, pad) {
  const chips = r.chips.length
    ? `\n${pad}  <ul class="yt-chips" aria-label="${esc(r.name)}のページ">${r.chips.map((c) => `<li><a href="${base}${c.path.slice(1)}">${esc(c.name)}</a></li>`).join('')}</ul>`
    : '';
  return `${pad}<li><a class="yt-name" href="${base}${r.path.slice(1)}">${esc(r.name)}</a> <span class="yt-note">${esc(r.note)}</span>${chips}</li>`;
}
function sectionBlock(s, base, allHref, more) {
  const pad = '        ';
  const shown = s.rows.slice(0, VISIBLE), rest = s.rows.slice(VISIBLE);
  const head = allHref
    ? `      <div class="yt-head"><h2 id="${s.id}-h">${esc(s.name)}</h2><a href="${allHref}#${s.id}">${more.all}</a></div>`
    : `      <h2 id="${s.id}-h">${esc(s.name)}</h2>`;
  const det = rest.length
    ? `\n      <details>\n        <summary>${more.other(rest.length)}</summary>\n        <ul class="yt-rows">\n${rest.map((r) => rowHtml(r, base, pad + '  ')).join('\n')}\n        </ul>\n      </details>`
    : '';
  return `    <section class="yt-sec" id="${s.id}" aria-labelledby="${s.id}-h">\n${head}\n      <ul class="yt-rows">\n${shown.map((r) => rowHtml(r, base, pad)).join('\n')}\n      </ul>${det}\n    </section>`;
}
const JA = { all: 'この節をすべて見る', other: (n) => `ほかに ${n} 件` };
const EN = { all: 'See all', other: (n) => `${n} more` };
export function sectionsHtml(data, base = './') {
  return sectionsJa(data).map((s) => sectionBlock(s, base, `${base}all/`, JA)).join('\n');
}

// 英語トップの節（行は英語ページ。チップなし）
export function sectionsEn(data) {
  const map = new Map(data.en.pages.map((p) => [p.path, p]));
  return data.en.sections.map((s) => ({ ...s, rows: s.rows.map((path) => {
    const p = map.get(path); if (!p) throw new Error(`英語の節 ${s.name} の ${path} が en.pages に無い`);
    return { path, name: p.title, note: p.note, chips: [] };
  }) }));
}
export function sectionsEnHtml(data, base = '../') {
  return sectionsEn(data).map((s) => sectionBlock(s, base, null, EN)).join('\n');
}

// ---- すべての道具（/all/）: 節ごとに、行（入口）とその子ページ。全ページが 1 回ずつ出る ----
export function allRows(data) {
  const sec = sectionOf(data);
  const secs = sectionsJa(data);
  const used = new Set();
  return secs.map((s) => {
    const items = [];
    for (const r of s.rows) {
      const p = data.pages.find((x) => x.path === r.path);
      const kids = data.pages.filter((x) => x.path !== r.path && x.path.startsWith(r.path) && sec.get(x.path) === s.id && !s.rows.some((y) => y.path === x.path));
      items.push({ page: p, kids });
      used.add(p.path); kids.forEach((k) => used.add(k.path));
    }
    // 入口の下に入らないページ（チップで別の節に入ったものなど）
    const loose = data.pages.filter((x) => sec.get(x.path) === s.id && !used.has(x.path));
    loose.forEach((x) => { items.push({ page: x, kids: [] }); used.add(x.path); });
    return { id: s.id, name: s.name, items };
  });
}
export function allHtml(data, base = '../') {
  return allRows(data).map((s) => {
    const li = s.items.map(({ page, kids }) => {
      const sub = kids.length ? `\n          <ul>${kids.map((k) => `<li><a href="${base}${k.path.slice(1)}">${esc(k.title)}</a></li>`).join('')}</ul>` : '';
      return `        <li><a class="yt-name" href="${base}${page.path.slice(1)}">${esc(page.title)}</a>${sub}</li>`;
    }).join('\n');
    return `    <section class="yt-sec" id="${s.id}" aria-labelledby="${s.id}-h">\n      <h2 id="${s.id}-h">${esc(s.name)}</h2>\n      <ul class="yt-all">\n${li}\n      </ul>\n    </section>`;
  }).join('\n');
}

// ---- 検索とデータ ----
export function searchRows(data, lang = 'ja') {
  if (lang === 'en') {
    const g = new Map(); for (const s of data.en.sections) for (const p of s.rows) g.set(p, s.name);
    return data.en.pages.map((p) => ({ p: p.path, t: p.title, g: g.get(p.path) || '', n: p.note, ...(p.aliases ? { a: p.aliases } : {}) }));
  }
  const sec = sectionOf(data);
  const names = new Map(data.sections.map((s) => [s.id, s.name]));
  const notes = new Map(); for (const s of data.sections) for (const r of s.rows) notes.set(r.path, r.note);
  return data.pages.map((p) => ({ p: p.path, t: p.title, ...(p.short ? { s: p.short } : {}), g: names.get(sec.get(p.path)), ...(notes.has(p.path) ? { n: notes.get(p.path) } : {}), ...(p.aliases ? { a: p.aliases } : {}) }));
}
const TEXT = {
  ja: { label: '道具を探す', ph: '年末調整、席替え、ふりがな…', empty: '見つかりません。', all: 'すべての道具を見る', allHref: 'all/' },
  en: { label: 'Find a tool', ph: 'Tax, furigana, bingo…', empty: 'No match.', all: 'See the Japanese tool list', allHref: 'all/' },
};
// 検索欄。送信しない: <form> を使わず、Enter は top.js が候補を開くだけ
export function searchHtml(lang = 'ja', base = './', id = 'yt-q') {
  const t = TEXT[lang];
  return `<div class="yt-search" role="search" data-base="${base}">
        <label for="${id}">${t.label}</label>
        <input id="${id}" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" autocomplete="off" enterkeyhint="go" placeholder="${t.ph}">
        <ul id="${id}-list" role="listbox" aria-label="${t.label}の候補" hidden></ul>
        <p class="yt-status visually-hidden" aria-live="polite"></p>
        <p class="yt-empty" hidden>${t.empty}<a href="${base}${t.allHref}">${t.all}</a></p>
      </div>`;
}
// 季節表（名前を足したもの）。path は pages にあるものだけ
export function seasonData(data, season, lang = 'ja') {
  const pages = lang === 'en' ? data.en.pages : data.pages;
  const map = new Map(pages.map((p) => [p.path, p]));
  const months = {};
  const src = lang === 'en' ? season.en : season.months;
  for (const [m, list] of Object.entries(src)) {
    if (list.length > 3) throw new Error(`season ${lang} ${m} 月が 3 件より多い`);
    months[m] = list.map((x) => {
      const p = map.get(x.path);
      if (!p) throw new Error(`season ${lang} ${m} 月の ${x.path} が pages に無い（公開前のページは入れない）`);
      if (!x.source) throw new Error(`season ${lang} ${m} 月の ${x.path} に出典（source）が無い`);
      return { path: x.path, name: lang === 'en' ? p.title : label(p), reason: x.reason };
    });
  }
  return { months };
}
export function seasonHtml(data, season, lang = 'ja', base = './', date = new Date()) {
  const sd = seasonData(data, season, lang);
  const m = date.getMonth() + 1;
  return `<ul class="yt-season" data-season-month="${m}" data-base="${base}">${YT.seasonItemsHtml(YT.seasonFor(sd, date), base)}</ul>`;
}
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
export function dataHtml(data, season, lang = 'ja') {
  const s = season ? `\n  <script type="application/json" id="yt-season">${json(seasonData(data, season, lang))}</script>` : '';
  return `<script type="application/json" id="yt-index">${json({ rows: searchRows(data, lang) })}</script>${s}`;
}

// ---- 書き換え ----
export function replaceRegion(html, name, body, file = '') {
  const b = `<!-- top:${name}:begin -->`, e = `<!-- top:${name}:end -->`;
  const i = html.indexOf(b), j = html.indexOf(e);
  if (i < 0 || j < 0) throw new Error(`${file} に top:${name}:begin / end が無い`);
  return html.slice(0, i + b.length) + body + html.slice(j);
}
export function apply(html, data) {
  const b = html.indexOf(BEGIN), e = html.indexOf(END);
  if (b < 0 || e < 0) throw new Error('index.html に new-tools:begin / end が無い');
  return html.slice(0, b) + newToolsHtml(data) + html.slice(e + END.length);
}
const enNewest = (data) => data.en.pages.map((p, i) => ({ ...p, i, short: p.title })).sort(byDate).slice(0, data.newCount || 6);

// ページごとの欄
export function buildAll(data, season, date = new Date()) {
  return {
    'index.html': (h) => {
      h = replaceRegion(h, 'search', searchHtml('ja', './'), 'index.html');
      h = replaceRegion(h, 'season', `<h2 id="season-h" data-season-label="いまの時期（{m} 月）">いまの時期（${date.getMonth() + 1} 月）</h2>\n        ` + seasonHtml(data, season, 'ja', './', date), 'index.html');
      h = replaceRegion(h, 'sections', '\n' + sectionsHtml(data, './') + '\n    ', 'index.html');
      h = replaceRegion(h, 'data', dataHtml(data, season, 'ja'), 'index.html');
      return apply(h, data);
    },
    'en/index.html': (h) => {
      h = replaceRegion(h, 'search', searchHtml('en', '../'), 'en/index.html');
      h = replaceRegion(h, 'season', seasonHtml(data, season, 'en', '../', date), 'en/index.html');
      h = replaceRegion(h, 'sections', '\n' + sectionsEnHtml(data, '../') + '\n    ', 'en/index.html');
      h = replaceRegion(h, 'data', dataHtml(data, season, 'en'), 'en/index.html');
      const b = h.indexOf(BEGIN), e = h.indexOf(END);
      return h.slice(0, b) + newToolsHtml(data, '../', enNewest(data)) + h.slice(e + END.length);
    },
    'all/index.html': (h) => {
      h = replaceRegion(h, 'search', searchHtml('ja', '../'), 'all/index.html');
      h = replaceRegion(h, 'all', '\n' + allHtml(data, '../') + '\n    ', 'all/index.html');
      return replaceRegion(h, 'data', dataHtml(data, null, 'ja'), 'all/index.html');
    },
    ...Object.fromEntries(['teachers', 'kaigo', 'it'].map((f) => [`for/${f}/index.html`, (h) => {
      h = replaceRegion(h, 'search', searchHtml('ja', '../../'), `for/${f}/index.html`);
      return replaceRegion(h, 'data', dataHtml(data, null, 'ja'), `for/${f}/index.html`);
    }])),
  };
}
// --check で月の違いを見ないように、いまの時期の欄を空にして比べる
export const stripSeason = (h) => h.replace(/(<!-- top:season:begin -->)[\s\S]*?(<!-- top:season:end -->)/g, '$1$2');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = loadPages(), season = loadSeason();
  const check = process.argv.includes('--check');
  let stale = [];
  for (const [f, fn] of Object.entries(buildAll(data, season))) {
    const file = join(ROOT, f);
    const html = readFileSync(file, 'utf8');
    const next = fn(html);
    if (check) { if (stripSeason(next) !== stripSeason(html)) stale.push(f); }
    else if (next !== html) { writeFileSync(file, next); console.log('書き換え:', f); }
  }
  if (check) {
    if (stale.length) { console.log(`データから作る欄が data/pages.json・data/season.json と違う: ${stale.join(', ')}。node tools/build-top.mjs を実行する`); process.exit(1); }
    console.log('トップ・すべての道具・用途別の入口・英語トップの欄は最新'); process.exit(0);
  }
  console.log(newest(data).map((p) => `${p.date} ${p.path}`).join('\n'));
}
