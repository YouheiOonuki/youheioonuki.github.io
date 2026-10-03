// 行とチップの選び方（yorozu-plans ROADMAP 7.24.1・ACCEPTANCE 3 章「束 A … 行とチップ」）のテスト
// 使い方: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPages, loadSeason, sectionsJa, sectionsHtml, VISIBLE, CHIP_ROWS } from '../tools/build-top.mjs';
import { terms, computeAll, gscRanks, rankOf, demandPoints, searchPoints, rewrite } from '../tools/top/priority.mjs';
import { parseLedger } from '../tools/top/ledger.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const data = loadPages(ROOT);
const season = loadSeason(ROOT);
const input = JSON.parse(read('data/priority-input.json'));
const entry = (p) => (/^\/[^/]+\/$/.test(p.path) ? 1 : 0);
const order = (a, b) => (!!b.pin - !!a.pin) || (b.priority - a.priority) || (entry(b) - entry(a)) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
// index.html の節の塊（<section> 〜 </section>）
const block = (html, id) => { const i = html.indexOf(`<section class="yt-sec" id="${id}"`); return html.slice(i, html.indexOf('</section>', i)); };

test('pages.json: 全行に section・priority・aliases、行の候補（note あり）に related（3 つまで）', () => {
  const ids = new Set(data.sections.map((s) => s.id));
  for (const p of data.pages) {
    assert.ok(ids.has(p.section), `${p.path} section`);
    assert.ok(Number.isInteger(p.priority) && p.priority >= 2 && p.priority <= 8, `${p.path} priority ${p.priority}`);
    assert.ok(Array.isArray(p.aliases) && p.aliases.length >= 1, `${p.path} aliases`);
    if (p.note != null) {
      assert.ok(Array.isArray(p.related) && p.related.length >= 1 && p.related.length <= 3, `${p.path} related`);
      assert.ok([...p.note].length <= 15, p.note);
    }
  }
  for (const s of data.sections) assert.ok(data.pages.filter((p) => p.section === s.id && p.note != null).length >= 3, `${s.id} の候補が 3 未満`);
});

test('pin は節ごとに 1 件以下', () => {
  for (const s of data.sections) assert.ok(data.pages.filter((p) => p.section === s.id && p.pin).length <= 1, s.id);
  // 2 件にすると build-top が止まる
  const two = structuredClone(data);
  two.pages.filter((p) => p.section === 'oya' && p.note != null).slice(0, 2).forEach((p) => { p.pin = true; });
  assert.throws(() => sectionsJa(two), /pin が 2 件以上/);
  // 1 件なら priority が低くても先頭の行に出る
  const one = structuredClone(data);
  const low = one.pages.filter((p) => p.section === 'oya' && p.note != null).sort((a, b) => a.priority - b.priority)[0];
  low.pin = true;
  assert.equal(sectionsJa(one).find((s) => s.id === 'oya').rows[0].path, low.path);
});

test('節ごとの行が priority の上位 3（同点は入口＞子ページ、次に公開日の古い方）。HTML の見える 3 行も同じ', () => {
  const html = read('index.html');
  for (const s of sectionsJa(data)) {
    const cands = data.pages.filter((p) => p.section === s.id && p.note != null).sort(order);
    const want = cands.slice(0, VISIBLE).map((p) => p.priority);
    assert.deepEqual(s.rows.slice(0, VISIBLE).map((r) => r.priority), want, s.id);
    const restMax = Math.max(...cands.slice(VISIBLE).map((p) => p.priority), 0);
    for (const r of s.rows.slice(0, VISIBLE)) assert.ok(r.priority >= restMax, `${s.id} ${r.path}`);
    const shown = block(html, s.id).split('<details>')[0];
    const names = [...shown.matchAll(/class="yt-name" href="\.\/([^"]+)"/g)].map((m) => '/' + m[1]);
    assert.deepEqual(names, s.rows.slice(0, VISIBLE).map((r) => r.path), `${s.id} の HTML`);
  }
});

test('同じ節に同じページが 2 回出ない（行・チップ・ほかに）。チップは 3 つまで', () => {
  const html = read('index.html');
  for (const s of sectionsJa(data)) {
    const all = s.rows.flatMap((r) => [r.path, ...r.chips.map((c) => c.path)]);
    assert.equal(new Set(all).size, all.length, `${s.id}: ${all.join(' ')}`);
    for (const r of s.rows) assert.ok(r.chips.length <= 3, r.path);
    const hrefs = [...block(html, s.id).matchAll(/href="\.\/([^"#]+)"/g)].map((m) => m[1]).filter((h) => h !== 'all/');
    assert.equal(new Set(hrefs).size, hrefs.length, `${s.id} の HTML に重複`);
  }
});

test('チップ: related が先、足りなければ同じ節の priority の上位で埋める。行に出ているページはチップに出さない', () => {
  // 小さな例: 節 x に候補 a〜d（priority 8・7・6・5）、候補でない e（4）。a の related は b（行）と z（別の節）
  const d = { sections: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }], pages: [
    { path: '/a/', date: '2026-01-01', title: 'A', section: 'x', priority: 8, aliases: [], note: 'a', related: ['/b/', '/z/'] },
    { path: '/b/', date: '2026-01-01', title: 'B', section: 'x', priority: 7, aliases: [], note: 'b', related: ['/a/'] },
    { path: '/c/', date: '2026-01-01', title: 'C', section: 'x', priority: 6, aliases: [], note: 'c', related: ['/d/'] },
    { path: '/d/', date: '2026-01-01', title: 'D', section: 'x', priority: 5, aliases: [], note: 'd', related: ['/a/'] },
    { path: '/e/', date: '2026-01-01', title: 'E', section: 'x', priority: 4, aliases: [] },
    { path: '/z/', date: '2026-01-01', title: 'Z', section: 'y', priority: 3, aliases: [] },
  ] };
  const [x] = sectionsJa(d);
  assert.deepEqual(x.rows.map((r) => r.path), ['/a/', '/b/', '/c/']); // d は a のチップ（埋め）に出たので「ほかに」から外れる
  assert.deepEqual(x.rows[0].chips.map((c) => c.path), ['/z/', '/d/', '/e/']);
  assert.deepEqual(x.rows[1].chips.map((c) => c.path), []);
  assert.doesNotMatch(sectionsHtml(d), /<details>/);
});

test('priority.mjs の式: 需要＋検索＋季節（年末調整 ＝ A3＋表示3＋季節2＝8 の形）', () => {
  const repos = { 'seido-keisan': 900, ...Object.fromEntries(Array.from({ length: 39 }, (_, i) => [`t${i}`, 800 - i])), 'loan-sim': 1 };
  const inp = {
    month: 12,
    demand: { grades: { K02: 'A', K90: 'B', K91: 'C', K33: 'なし', K95: 'B' }, tools: { '/loan-sim/': 'A', '/tameshite/': 'C' },
      pages: { '/seido-keisan/nenmatsu/': 'K02', '/b/': 'K90', '/c/': 'K91', '/n/': 'K33', '/tameshite/hansha/': 'K95' } },
    gsc: { repos },
  };
  const s = { months: { 12: [{ path: '/seido-keisan/nenmatsu/' }] } };
  assert.deepEqual(terms('/seido-keisan/nenmatsu/', inp, s), { k: 'K02', grade: 'A', rank: 1, demand: 3, search: 3, season: 2, priority: 8 });
  assert.equal(terms('/loan-sim/', inp, s).priority, 4); // 道具の根拠 A3 ＋ 表示 41 位で 1 ＋ 0（住宅ローン ＝ 4 の形）
  assert.equal(terms('/seido-keisan/iryohi/', inp, s).search, 3); // リポジトリの順位を全ページに同じ値で
  assert.equal(terms('/t9/x/', inp, s).search, 2);  // 11 位
  assert.equal(terms('/t8/', inp, s).search, 3);  // 10 位
  assert.equal(terms('/t29/', inp, s).search, 1); // 31 位
  assert.equal(terms('/loan-sim/child/', inp, s).demand, 3); // 道具の根拠は子ページにも
  assert.equal(terms('/tameshite/hansha/', inp, s).demand, 2); // 子ページに K 行があれば K 行が先（道具は C）
  assert.equal(terms('/tameshite/', inp, s).demand, 1);
  assert.equal(terms('/b/', inp, s).demand, 2);
  assert.equal(terms('/c/', inp, s).demand, 1);
  assert.equal(terms('/n/', inp, s).demand, 1);
  assert.equal(terms('/nothing/', inp, s).priority, 1 + 1 + 0);
  assert.equal(terms('/seido-keisan/nenmatsu/', { ...inp, month: 11 }, s).priority, 6);
  const r = gscRanks({ a: 10, b: 10, c: 5 });
  assert.deepEqual([rankOf('/a/', r), rankOf('/b/x/', r), rankOf('/c/', r), rankOf('/d/', r)], [1, 1, 3, null]);
  assert.deepEqual([demandPoints('A'), demandPoints('B'), demandPoints('C'), demandPoints('なし')], [3, 2, 1, 1]);
  assert.deepEqual([searchPoints(1), searchPoints(10), searchPoints(11), searchPoints(30), searchPoints(31), searchPoints(null)], [3, 3, 2, 2, 1, 1]);
});

test('台帳より前の道具の需要（DEMAND 7 章 / ROADMAP 7.24.2 の 1）', () => {
  assert.deepEqual(input.demand.tools, { '/loan-sim/': 'A', '/hoshizora-sanpo/': 'A', '/easy-split/': 'A', '/nittei-kouho/': 'B', '/shaho-check/': 'B', '/web-metronome/': 'B', '/todofuken-quiz/': 'B', '/md-viewer/': 'B', '/denki-dai/': 'C', '/pac-tester/': 'C', '/web-roulette/': 'C' });
  assert.match(input.demand.tools_source, /DEMAND 7 章.*7\.24\.2/);
  const v = computeAll(data.pages, input, season);
  assert.equal(v.get('/hoshizora-sanpo/zukan/').grade, 'A');
  assert.equal(v.get('/web-roulette/amida/').grade, 'B'); // K97 が先
  assert.equal(v.get('/web-roulette/').grade, 'C');
});

test('同点の順: 入口ページ ＞ 子ページ、次に公開日の古い方', () => {
  // 先頭の行のチップは別の節の 3 ページで埋め、x の並びだけを見る
  const z = [1, 2, 3].map((n) => ({ path: `/z${n}/`, date: '2026-01-01', title: `Z${n}`, section: 'y', priority: 2, aliases: [] }));
  const d = { sections: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }], pages: [...z,
    { path: '/k/new/', date: '2026-10-01', title: 'N', section: 'x', priority: 4, aliases: [], note: 'n', related: [] },
    { path: '/k/old/', date: '2026-09-01', title: 'O', section: 'x', priority: 4, aliases: [], note: 'o', related: [] },
    { path: '/k/', date: '2026-10-02', title: 'K', section: 'x', priority: 4, aliases: [], note: 'k', related: [] },
    { path: '/hi/x/', date: '2026-10-03', title: 'H', section: 'x', priority: 5, aliases: [], note: 'h', related: z.map((p) => p.path) },
  ] };
  assert.deepEqual(sectionsJa(d)[0].rows.map((r) => r.path), ['/hi/x/', '/k/', '/k/old/', '/k/new/']);
});

test('チップは節の先頭の行だけ（規則。7.24.2 の 3）', () => {
  assert.equal(CHIP_ROWS, 1);
  const html = read('index.html');
  for (const s of sectionsJa(data)) {
    for (const r of s.rows.slice(1, VISIBLE)) assert.equal(r.chips.length, 0, `${s.id} ${r.path}`);
    const shown = block(html, s.id).split('<details>')[0];
    const lis = shown.split('<li><a class="yt-name"').slice(1);
    lis.slice(1).forEach((li) => assert.doesNotMatch(li, /yt-chips/, `${s.id} の 2 行目以降にチップ`));
  }
});

test('/all/: 1 画面目に検索欄と節の目次（7 つへのジャンプ）、各節の見出しに「トップへ」', () => {
  const h = read('all/index.html');
  const toc = h.indexOf('<nav class="yt-toc"'), firstSec = h.indexOf('<section class="yt-sec"');
  assert.ok(h.indexOf('role="combobox"') > 0 && h.indexOf('role="combobox"') < toc && toc < firstSec);
  const nav = h.slice(toc, h.indexOf('</nav>', toc));
  assert.deepEqual([...nav.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1]), data.sections.map((s) => s.id));
  for (const s of data.sections) assert.match(block(h, s.id), new RegExp(`<h2 id="${s.id}-h">[^<]+</h2><a href="#main">トップへ</a>`));
  assert.match(h, /<main id="main">/);
});

test('priority.mjs: gsc.repos が空なら検索の項は全ページ 1。pages.json の priority は入力から計算した値（--check と同じ）', () => {
  assert.equal(typeof input.gsc.repos, 'object');
  const v = computeAll(data.pages, input, season);
  if (!Object.keys(input.gsc.repos).length) for (const t of v.values()) assert.equal(t.search, 1);
  for (const p of data.pages) assert.equal(p.priority, v.get(p.path).priority, p.path);
  const text = read('data/pages.json');
  assert.equal(rewrite(text, v), text);
  for (const k of Object.values(input.demand.pages)) assert.ok(['A', 'B', 'C', 'なし'].includes(input.demand.grades[k]), k);
  for (const p of Object.keys(input.demand.pages)) assert.ok(data.pages.some((x) => x.path === p), p);
});

test('ledger.mjs: 台帳の「根拠」列の先頭の字を写す', () => {
  const md = '### 7.1 x\n| K99 | x | y | A | 紙 | S | — |\n### 7.2 候補台帳\n\n| ID | 候補 | 出どころ | 根拠 | 型 | 工数 | 状態 |\n|---|---|---|---|---|---|---|\n| K01 | 住民税 | 需要調査 | A | 計算機 | S | 公開 |\n| K05 | 退職金 | 需要調査 | B | 計算機 | S | — |\n| K07 | 在職老齢 | 時流 | C | 計算機 | S | 未計測 |\n| K33 | ADSearch | x | — | x | x | x |\n| K71 | 計測 | x | A（手で貼る運用は途切れる） | x | x | x |\n| K132 | フル版 | x | 仮説（検索の語は無い） | x | x | x |\n### 7.3 次\n| K02 | x | y | A | 紙 | S | — |\n';
  assert.deepEqual(parseLedger(md), { K01: 'A', K05: 'B', K07: 'C', K33: 'なし', K71: 'A', K132: 'なし' });
});
