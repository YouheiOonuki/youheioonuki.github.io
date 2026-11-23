// トップ・すべての道具・用途別の入口・英語トップの、データから作る欄を作り直す（yorozu-plans 企画書 59・ROADMAP 7.23「トップの構成」）
// 使い方: node tools/build-top.mjs          … 下の PAGES の <!-- top:<欄>:begin --> 〜 end（英語トップは <!-- new-tools:begin --> 〜 end も）を書き換える
//         node tools/build-top.mjs --check  … 書き換えが要るか（要れば終了コード 1。「いまの時期」の月の違いは見ない）
// データ: data/pages.json（ページ・別名・用途の節・英語の行）と data/season.json（月 → 最大 3 ページと理由。日付の窓 windows はその間だけ 1 行を入れ替える）
// 欄:
//   search   … 検索欄（端末の中だけで絞る。top.js）       season … いまの時期（作った日の月。ページを開いた月が違えば top.js が入れ替える）
//   toc      … 節の目次（トップはスマホだけ、/all/ は全部）
//   data     … 検索の一覧と季節表の JSON（top.js が読む）  new-tools … 新しいツール（英語トップだけ。公開日の新しい順に newCount 件）
//   cards    … 札 7 枚 ＝ 節（data/pages.json の sections。層・柱の印・脚のリンク。行は priority の上位、残りは「ほかに N 件」）          next … これからの改定（../seido-keisan/data/kaitei.json の今日より後の 3 件。読めなければ段ごと出さない）
//   updates  … 更新の記録（build-updates.mjs の行の上から 5 件。各道具の guide.html は隣のクローンから）
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { updateRows } from './build-updates.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// トップに載せないツール（sitemap には載る）。5000兆円欲しい館は AdSense の結果が出るまでトップの外（ROADMAP 7.46.1）。結果が出たら消して pages.json に足す。
// check-site.mjs と tests/reach.test.mjs がここを読む
export const NOT_ON_TOP = ['hade'];
// 一覧（pages.json・トップ・/all/）には残すが、索引から外したページ（noindex で、sitemap に無い。yorozu-plans D899）。
// スマホ版の割り勘は 90 日の表示が 0 なので索引から外し、トップからは行けるまま（D417）。check-site.mjs と tests/reach.test.mjs がここを読む
export const NOINDEX_ON_TOP = ['/easy-split/quick/'];
// sitemap の URL のうち、data/pages.json に 1 行ずつ載せる道具のページ: /<ツール>/ と、その下 2 段までのフォルダ（/seido-keisan/iryohi/meisai/ など）。
// 英語（/en/ を含む。英語は pages.json の en.pages）・印刷の着地（/print/）・共有の着地（/s/）・サイト本体の案内（/for/ /api/ /yt/ /all/ /updates/）・.html の頁（使い方・読み物）は数えない
export const isToolPage = (p) => /^\/[^/]+\/(?:[^/]+\/){0,2}$/.test(p) && !/^\/(?:for|api|yt|en|all|updates)\//.test(p) && !/\/en\//.test(p) && !/\/(?:print|s)\/$/.test(p);
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
const shortTitle = (t) => t.replace(/（[^）]*）/g, '').trim();
const label = (p) => p.short || shortTitle(p.title);

// 近い道具（data/near.json。yorozu-ai near-tools.mjs が索引から作る。D368）も読み、チップの元にする（related は 7.98 で消した）
export function loadPages(root = ROOT) {
  const data = JSON.parse(readFileSync(join(root, 'data', 'pages.json'), 'utf8'));
  const nf = join(root, 'data', 'near.json');
  if (existsSync(nf)) data.near = JSON.parse(readFileSync(nf, 'utf8')).near;
  return data;
}
export function loadSeason(root = ROOT) {
  return JSON.parse(readFileSync(join(root, 'data', 'season.json'), 'utf8'));
}

const byDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.i - b.i);
export function newest(data) {
  const n = data.newCount || 6;
  return data.pages.map((p, i) => ({ ...p, i })).sort(byDate).slice(0, n);
}

// 新しいツール: 他の節と同じ行の形（アイコン・名前・一言。D360、7.100）。base はページから見たサイトの根（トップは ./）。
// アイコンは日本語のページだけ（節の行と同じ。英語の名前は長く、アイコンを足すと 1 行に収まらない）
export function newToolsHtml(data, base = './', rows = newest(data), icon = true) {
  const items = rows.map((p) => `        <li><a class="yt-name" href="${base}${p.path.slice(1)}">${icon ? YT.iconHtml(p.path, base, true) : ''}${esc(p.short || shortTitle(p.title))}</a>${p.note ? ` <span class="yt-note">${esc(p.note)}</span>` : ''}</li>`);
  return `${BEGIN}\n      <ul class="yt-rows yt-new">\n${items.join('\n')}\n      </ul>\n      ${END}`;
}

// ---- 節 ＝ 札（yorozu-plans docs/advice/2026-11-23_site-strategy-v2.md 3.1〜3.5）----
// 1 ページ ＝ 1 用途。節（section）はページごとに持つ。note（一言）のあるページが札の行の候補。note の無いページは「ほかに N 件」と /all/ にだけ出る
// 行の並び: pin を先に（柱の節は 2 件まで、ほかは 1 件まで）、priority の降順、同点は 入口ページ（/<ツール>/）＞ 子ページ、次に公開日の古い方（同じ日は pages.json の順。7.24.2 の 2）
// 札に出す行: 柱の節（pages.json の sections の pillar）は VISIBLE.pillar、そのほかは VISIBLE.other（別館の行は数えない）。節に visible があればその数（情シス・PC は別館 2 行 ＋ 4 行）。スマホで見せる行は MOBILE（別館の行も数える）。
// 残りは札の「ほかに N 件」の中に名前で全部（スマホで隠した行も入れる）。層（layer）は節の上の束。「用事」の層には見出しを置かない
export const VISIBLE = { pillar: 5, other: 3 };
export const MOBILE = { pillar: 3, other: 2 };
const rowName = (p) => p.name || label(p);
const isEntry = (path) => /^\/[^/]+\/$/.test(path);
export const order = (a, b) => (!!b.pin - !!a.pin) || (b.priority - a.priority) || (isEntry(b.path) - isEntry(a.path)) || (a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i);
function checkPages(data) {
  const ids = new Set(data.sections.map((s) => s.id));
  for (const p of data.pages) {
    if (!ids.has(p.section)) throw new Error(`${p.path} の section「${p.section}」が sections に無い`);
    if (!Number.isInteger(p.priority)) throw new Error(`${p.path} に priority が無い（node tools/top/priority.mjs）`);
    if (!Array.isArray(p.aliases)) throw new Error(`${p.path} に aliases が無い`);
    if (p.note != null) {
      if ([...p.note].length > 15) throw new Error(`${p.path} の一言が 15 字より長い: ${p.note}`);
      if (p.related) throw new Error(`${p.path} に related がある（7.98 で消した。近い道具は data/near.json）`);
    } else if (p.related || p.pin) throw new Error(`${p.path} に note が無いのに related か pin がある`);
  }
  for (const s of data.sections) {
    const pins = data.pages.filter((p) => p.section === s.id && p.pin);
    const max = s.pillar ? 2 : 1;   // 柱の節は 2 件まで、ほかの節は 1 件まで（D1042・Q-1218）
    if (pins.length > max) throw new Error(`節 ${s.name} の pin が ${max + 1} 件以上: ${pins.map((p) => p.path).join(' ')}`);
  }
}
// 節ごとの全行（並びの順）。layer の無い節（site）は札にしない
export function sectionsJa(data) {
  checkPages(data);
  const pages = data.pages.map((p, i) => ({ ...p, i }));
  return data.sections.map((s) => ({
    id: s.id, name: s.name, layer: s.layer, pillar: !!s.pillar, visible: s.visible, lead: s.lead, annex: s.annex, foot: s.foot, tagFromLead: !!s.tagFromLead,
    rows: pages.filter((p) => p.section === s.id).sort(order).map((p) => ({ path: p.path, name: rowName(p), note: p.note, date: p.date, priority: p.priority, pin: !!p.pin, i: p.i })),
  }));
}
// top.js の cardBodyHtml に渡す形（ページに埋める id="yt-cards" も同じ）
export function cardsJa(data) {
  return sectionsJa(data).filter((s) => s.layer).map((s) => ({
    id: s.id, vis: s.visible || (s.pillar ? VISIBLE.pillar : VISIBLE.other), mob: s.pillar ? MOBILE.pillar : MOBILE.other,
    annex: (s.annex || []).map((x) => ({ h: x.href, t: x.name, n: x.note })),
    rows: s.rows.map((r) => ({ p: r.path, t: r.name, ...(r.note != null ? { n: r.note } : {}) })),
  }));
}
// 札の見出しの横の字: その節の lead の「令和 N 年分」「令和 N 年度」（どの年の制度で計算するか）
export function cardTag(data, id) {
  const lead = (data.sections.find((x) => x.id === id) || {}).lead || '';
  const tag = [...lead.matchAll(/令和 \d+ 年[分度]/g)].map((m) => m[0]);
  if (!tag.length) throw new Error(`節 ${id} の lead に「令和 N 年分・年度」が無い（札の見出しの横の字の元）`);
  return tag.join('・');
}
// 札 7 枚（用事の 5 つ、たのしみの見出し、たのしみの 2 つ）。いまの時期の行は札の頭に上がる
export function cardsHtml(data, season, date = new Date(), base = './') {
  const sd = seasonData(data, season, 'ja');
  const items = YT.seasonFor(sd, date);
  const cards = new Map(cardsJa(data).map((c) => [c.id, c]));
  const url = (h) => (/^https?:/.test(h) ? h : base + h.slice(1));
  const secs = sectionsJa(data).filter((s) => s.layer);
  const first = secs[0].layer;
  let layer = first;
  const out = [];
  for (const s of secs) {
    if (s.layer !== layer) { layer = s.layer; out.push(`      <h2 class="yt-layer">${esc(s.layer)}</h2>`); }
    const tag = s.tagFromLead ? ` <span class="yt-tag">${cardTag(data, s.id).split('・').map((x) => `<span>${esc(x)}</span>`).join('・')}</span>` : '';
    const foot = (s.foot || []).length ? `\n        <p class="yt-cf">${s.foot.map((f) => `<a href="${esc(url(f.href))}">${esc(f.name)}</a>`).join('')}</p>` : '';
    out.push(`      <section class="yt-card${s.pillar ? ' yt-pillar' : ''}" id="${s.id}" data-card="${s.id}" aria-labelledby="${s.id}-h">
        <h2 id="${s.id}-h">${esc(s.name)}${tag}</h2>
        <div class="yt-cbody">${YT.cardBodyHtml(cards.get(s.id), items, base)}</div>${foot}
      </section>`);
  }
  return `<div class="yt-cards" data-season-key="${YT.seasonKey(sd, date)}" data-base="${base}">\n${out.join('\n')}\n      </div>`;
}

// 英語トップの節（行は英語ページ。アイコンもチップも無い。D360 の形のまま）
function sectionBlockEn(s, base) {
  const pad = '        ';
  const row = (r, p) => `${p}<li><a class="yt-name" href="${base}${r.path.slice(1)}">${esc(r.name)}</a> <span class="yt-note">${esc(r.note)}</span></li>`;
  const shown = s.rows.slice(0, VISIBLE.pillar), rest = s.rows.slice(VISIBLE.pillar);
  const det = rest.length
    ? `\n      <details>\n        <summary>${rest.length} more</summary>\n        <ul class="yt-rows">\n${rest.map((r) => row(r, pad + '  ')).join('\n')}\n        </ul>\n      </details>`
    : '';
  const lead = s.lead ? `\n      <p class="yt-lead">${esc(s.lead)}</p>` : '';
  return `    <section class="yt-sec" id="${s.id}" aria-labelledby="${s.id}-h">\n      <h2 id="${s.id}-h">${esc(s.name)}</h2>${lead}\n      <ul class="yt-rows">\n${shown.map((r) => row(r, pad)).join('\n')}\n      </ul>${det}\n    </section>`;
}

// ---- これからの改定（seido-keisan の data/kaitei.json の items のうち、今日より後の 3 件。日付と題はそのまま）----
// kaitei.json は隣のクローン（../seido-keisan/data/kaitei.json。KAITEI_JSON で変えられる）。読めなければ null（段ごと出さない）
export function loadKaitei(root = ROOT) {
  const f = process.env.KAITEI_JSON || join(root, '..', 'seido-keisan', 'data', 'kaitei.json');
  try { const j = JSON.parse(readFileSync(f, 'utf8')); return Array.isArray(j.items) ? j.items : null; } catch { return null; }
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function nextKaitei(items, date = new Date(), n = 3) {
  if (!items) return [];
  const today = ymd(date);
  return items.filter((x) => x.date > today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).slice(0, n);
}
export function nextHtml(items, date = new Date(), base = './') {
  const rows = nextKaitei(items, date);
  if (!rows.length) return '';
  const li = rows.map((x) => {
    const u = String(x.url || '').replace(/^https:\/\/yorozu-craft\.com\//, '');
    return `          <li><time datetime="${x.date}">${x.date}</time> <a href="${base}${esc(u)}">${esc(x.title)}</a></li>`;
  }).join('\n');
  return `
      <section class="yt-up" aria-labelledby="up-h">
        <h2 id="up-h">これからの改定</h2>
        <ul class="yt-urows">
${li}
        </ul>
        <p class="yt-uf"><a href="${base}seido-keisan/kaitei/">改定カレンダー</a></p>
      </section>
      `;
}

// ---- 更新の記録（/updates/ を作っている build-updates.mjs の行の上から 5 件。各道具の更新履歴の最新の行）----
// 各道具の guide.html は、隣のクローン（../<道具>/guide.html）か、このリポジトリの中。読めなければ pages.json の「公開」の行だけになる
export const UPDATES_ROWS = 5;
export function updatesRows(data, root = ROOT) {
  const readGuide = (p) => {
    const segs = p.split('/').filter(Boolean);
    for (const f of [join(root, '..', ...segs), join(root, ...segs)]) { if (existsSync(f)) return readFileSync(f, 'utf8'); }
    return null;
  };
  return updateRows(data.pages, readGuide).slice(0, UPDATES_ROWS);
}
export function updatesSection(rows, base = './') {
  const li = rows.map((r) => `        <li><time datetime="${r.date}">${r.date}</time> <a href="${base}${esc(r.url.slice(1))}">${esc(r.name)}</a> <span class="yt-note">${esc(r.what)}</span></li>`).join('\n');
  return `
    <section class="yt-sec" id="new" aria-labelledby="new-h">
      <div class="yt-head"><h2 id="new-h">更新の記録</h2><a href="${base}updates/">更新情報</a></div>
      <ul class="yt-rows yt-log">
${li}
      </ul>
    </section>
    `;
}

// 英語トップの節（行は英語ページ。チップなし）
function sectionsEn(data) {
  const map = new Map(data.en.pages.map((p) => [p.path, p]));
  return data.en.sections.map((s) => ({ ...s, rows: s.rows.map((path) => {
    const p = map.get(path); if (!p) throw new Error(`英語の節 ${s.name} の ${path} が en.pages に無い`);
    return { path, name: p.title, note: p.note, chips: [] };
  }) }));
}
function sectionsEnHtml(data, base = '../') {
  return sectionsEn(data).map((s) => sectionBlockEn(s, base)).join('\n');
}

// ---- すべての道具（/all/）: 節ごとに、ページを行の順で。同じ節の入口（/<ツール>/）の下にその子ページ。全ページが 1 回ずつ出る ----
export function allRows(data) {
  checkPages(data);
  const pages = data.pages.map((p, i) => ({ ...p, i }));
  return data.sections.map((s) => {
    const inSec = pages.filter((p) => p.section === s.id).sort(order);
    const has = new Set(inSec.map((p) => p.path));
    const rootOf = (p) => '/' + p.path.split('/')[1] + '/';
    const isKid = (p) => rootOf(p) !== p.path && has.has(rootOf(p));
    const items = inSec.filter((p) => !isKid(p)).map((p) => ({ page: p, kids: inSec.filter((k) => isKid(k) && rootOf(k) === p.path) }));
    return { id: s.id, name: s.name, items };
  });
}
// 節の目次（/all/ の 1 画面目と、トップのスマホ。札にする節の名前。層が替わる所に層の名前）
export function tocHtml(data) {
  const secs = data.sections.filter((s) => s.layer);
  let layer = secs[0].layer;
  const li = secs.map((s) => {
    const sep = s.layer !== layer ? `<li class="yt-toc-layer">${esc(s.layer)}</li>` : '';
    layer = s.layer;
    return `${sep}<li><a href="#${s.id}">${esc(s.name)}</a></li>`;
  });
  return `<nav class="yt-toc" aria-label="節の目次"><ul>${li.join('')}</ul></nav>`;
}
function allHtml(data, base = '../') {
  let layer = data.sections[0].layer;
  return allRows(data).map((s) => {
    const sec = data.sections.find((x) => x.id === s.id);
    const li = s.items.map(({ page, kids }) => {
      const sub = kids.length ? `\n          <ul>${kids.map((k) => `<li><a href="${base}${k.path.slice(1)}">${esc(k.title)}</a></li>`).join('')}</ul>` : '';
      return `        <li><a class="yt-name" href="${base}${page.path.slice(1)}">${YT.iconHtml(page.path, base, true)}${esc(page.title)}</a>${sub}</li>`;
    }).join('\n');
    const sep = sec.layer && sec.layer !== layer ? `    <h2 class="yt-layer">${esc(sec.layer)}</h2>\n` : '';
    if (sec.layer) layer = sec.layer;
    const lead = sec.lead ? `\n      <p class="yt-lead">${esc(sec.lead)}</p>` : '';
    return `${sep}    <section class="yt-sec" id="${s.id}" aria-labelledby="${s.id}-h">\n      <div class="yt-head"><h2 id="${s.id}-h">${esc(s.name)}</h2><a href="#main">トップへ</a></div>${lead}\n      <ul class="yt-all">\n${li}\n      </ul>\n    </section>`;
  }).join('\n');
}

// ---- 検索とデータ ----
export function searchRows(data, lang = 'ja') {
  if (lang === 'en') {
    const g = new Map(); for (const s of data.en.sections) for (const p of s.rows) g.set(p, s.name);
    return data.en.pages.map((p) => ({ p: p.path, t: p.title, g: g.get(p.path) || '', n: p.note, ...(p.aliases ? { a: p.aliases } : {}) }));
  }
  const names = new Map(data.sections.map((s) => [s.id, s.name]));
  return data.pages.map((p) => ({ p: p.path, t: p.title, ...(p.short ? { s: p.short } : {}), g: names.get(p.section), ...(p.note != null ? { n: p.note } : {}), ...(p.aliases && p.aliases.length ? { a: p.aliases } : {}) }));
}
// list: 候補の一覧の aria-label。英文は yorozu-plans ROADMAP 続き 43 の答えの文案（関門を通したもの。Q-822）
const TEXT = {
  ja: { label: '道具を探す', ph: '年末調整、席替え、ふりがな…', list: '道具を探すの候補', empty: '見つかりません。', all: 'すべての道具を見る', allHref: 'all/' },
  en: { label: 'Find a tool', ph: 'Tax, furigana, bingo…', list: 'Tool suggestions', empty: 'No match.', all: 'See the Japanese tool list', allHref: 'all/' },
};
// トップの窓（7.96 D366・K192 段 3 の 1）: 日本語のトップだけ、問いの形の見出しと例の一行。/all/・/for/・英語は「道具を探す」のまま
const ASK = { label: '何に困っていますか', hint: '例: 親の医療費が高い、年末調整', ph: 'ここに書く', list: '道具の候補' };
// トップ（日本語と英語）の押す所と、送ることの 1 行（D604・D625）。英文は yorozu-plans ROADMAP 続き 42 の答えの文案（関門を通したもの）
const SEND = {
  ja: { go: '探す' },   // 送ることの 1 行は、トップの頭の整理で外した（送る内容は privacy-policy.html の 7.11）
  en: { go: 'Search', send: 'The text you enter is sent to a server to find tools. It is not stored.' },
};
// 検索欄。<form> を使わない。Enter は top.js が候補を開く。top: トップの箱 —— 押す所と、送ることの 1 行（D604。英語も D625）。日本語はさらに窓の形（ASK）。
//   トップは Enter か押す所を押した時だけ top-find.js が文を送る（押す前に自動で送らない）。「保存しません」は yorozu-ai の main で確かめた事実（Q-774）
function searchHtml(lang = 'ja', base = './', id = 'yt-q', top = false) {
  const t = TEXT[lang];
  const w = top && lang === 'ja' ? ASK : null;
  const s = top ? SEND[lang] : null;
  const label = w ? `<label for="${id}" class="yt-ask">${w.label}</label>
        <p class="yt-hint" id="${id}-hint">${w.hint}</p>` : `<label for="${id}">${t.label}</label>`;
  const desc = s ? ` aria-describedby="${[w && `${id}-hint`, s.send && `${id}-send`].filter(Boolean).join(' ')}"` : '';
  return `<div class="yt-search" role="search" data-base="${base}">
        ${label}
        ${s ? '<div class="yt-row">' : ''}<input id="${id}" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list"${desc} autocomplete="off" enterkeyhint="go" placeholder="${w ? w.ph : t.ph}">${s ? `<button type="button" class="yt-go">${s.go}</button></div>${s.send ? `
        <p class="yt-send" id="${id}-send">${s.send}</p>` : ''}` : ''}
        <ul id="${id}-list" role="listbox" aria-label="${w ? w.list : t.list}" hidden></ul>
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
      return { path: x.path, name: lang === 'en' ? p.title : label(p), reason: x.reason, ...(lang === 'en' ? {} : { sec: p.section }) };
    });
  }
  // 日付の窓（日本語だけ）: page は pages.json の行（名前とアイコン）、path はリンク先（そのページの使い方の節など）。
  // 入れ替える行（replaces[月]）がその月の表に無ければ止める（件数は月の表のまま変わらない）
  const windows = lang === 'en' ? [] : (season.windows || []).map((w) => {
    const p = map.get(w.page);
    const at = `season window ${w.year}-${w.from}`;
    if (!p) throw new Error(`${at} の page ${w.page} が pages に無い`);
    if (!w.path || !w.path.startsWith(w.page)) throw new Error(`${at} の path ${w.path} が page ${w.page} の下に無い`);
    if (!Number.isInteger(w.year) || !/^\d\d-\d\d$/.test(w.from) || !/^\d\d-\d\d$/.test(w.to) || w.from > w.to) throw new Error(`${at} の year・from・to（"MM-DD"）`);
    if (!w.source) throw new Error(`${at} に出典（source）が無い`);
    const ms = Object.keys(w.replaces || {});
    if (!ms.length) throw new Error(`${at} に replaces が無い`);
    for (const m of ms) if (!(months[m] || []).some((x) => x.path === w.replaces[m])) throw new Error(`${at} の ${m} 月に ${w.replaces[m]} が無い`);
    return { year: w.year, from: w.from, to: w.to, replaces: w.replaces, page: w.page, sec: p.section, path: w.path, name: label(p), reason: w.reason };
  });
  return { months, windows };
}
function seasonHtml(data, season, lang = 'ja', base = './', date = new Date()) {
  const sd = seasonData(data, season, lang);
  const m = date.getMonth() + 1;
  const icons = lang === 'ja';
  return `<ul class="yt-season" data-season-month="${m}" data-season-key="${YT.seasonKey(sd, date)}" data-base="${base}"${icons ? ' data-icons' : ''}>${YT.seasonItemsHtml(YT.seasonFor(sd, date), base, icons)}</ul>`;
}
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
function dataHtml(data, season, lang = 'ja', cards = false) {
  const s = season ? `\n  <script type="application/json" id="yt-season">${json(seasonData(data, season, lang))}</script>` : '';
  const c = cards ? `\n  <script type="application/json" id="yt-cards">${json(cardsJa(data))}</script>` : '';
  return `<script type="application/json" id="yt-index">${json({ rows: searchRows(data, lang) })}</script>${s}${c}`;
}

// ---- 書き換え ----
function replaceRegion(html, name, body, file = '') {
  const b = `<!-- top:${name}:begin -->`, e = `<!-- top:${name}:end -->`;
  const i = html.indexOf(b), j = html.indexOf(e);
  if (i < 0 || j < 0) throw new Error(`${file} に top:${name}:begin / end が無い`);
  return html.slice(0, i + b.length) + body + html.slice(j);
}
const enNewest = (data) => data.en.pages.map((p, i) => ({ ...p, i, short: p.title })).sort(byDate).slice(0, data.newCount || 6);

// ページごとの欄
export function buildAll(data, season, date = new Date()) {
  return {
    'index.html': (h) => {
      h = replaceRegion(h, 'search', searchHtml('ja', './', 'yt-q', true), 'index.html');
      h = replaceRegion(h, 'toc', tocHtml(data), 'index.html');
      h = replaceRegion(h, 'cards', cardsHtml(data, season, date, './'), 'index.html');
      h = replaceRegion(h, 'next', nextHtml(loadKaitei(), date, './'), 'index.html');
      h = replaceRegion(h, 'updates', updatesSection(updatesRows(data), './'), 'index.html');
      return replaceRegion(h, 'data', dataHtml(data, season, 'ja', true), 'index.html');
    },
    'en/index.html': (h) => {
      h = replaceRegion(h, 'search', searchHtml('en', '../', 'yt-q', true), 'en/index.html');
      h = replaceRegion(h, 'season', seasonHtml(data, season, 'en', '../', date), 'en/index.html');
      h = replaceRegion(h, 'sections', '\n' + sectionsEnHtml(data, '../') + '\n    ', 'en/index.html');
      h = replaceRegion(h, 'data', dataHtml(data, season, 'en'), 'en/index.html');
      const b = h.indexOf(BEGIN), e = h.indexOf(END);
      return h.slice(0, b) + newToolsHtml(data, '../', enNewest(data), false) + h.slice(e + END.length);
    },
    'all/index.html': (h) => {
      h = replaceRegion(h, 'search', searchHtml('ja', '../'), 'all/index.html');
      h = replaceRegion(h, 'toc', tocHtml(data), 'all/index.html');
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
// 「これからの改定」（日付で変わる）と「更新の記録」（隣のクローンの更新履歴が要る）も同じ扱い
export const stripSeason = (h) => h.replace(/(<!-- top:(season|next|updates):begin -->)[\s\S]*?(<!-- top:\2:end -->)/g, '$1$3');

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
