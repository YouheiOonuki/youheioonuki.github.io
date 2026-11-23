// 行とチップの選び方（yorozu-plans ROADMAP 7.24.1・ACCEPTANCE 3 章「束 A … 行とチップ」）のテスト
// 使い方: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTop, loadPages, loadSeason, sectionsJa, cardsJa } from '../tools/build-top.mjs';
import { terms, computeAll, ranksOf, ranksFrom, aggregate, demandPoints, rankPoints, rewrite, MIN_IMPRESSIONS, MIN_PV, WEEKS, OUTAGES, overlapsOutage } from '../tools/top/priority.mjs';
import { parseLedger } from '../tools/top/ledger.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const YT = loadTop(ROOT);
const data = loadPages(ROOT);
const season = loadSeason(ROOT);
const input = JSON.parse(read('data/priority-input.json'));
const weekly = JSON.parse(read('data/weekly-tools.json'));
const entry = (p) => (/^\/[^/]+\/$/.test(p.path) ? 1 : 0);
const order = (a, b) => (!!b.pin - !!a.pin) || (b.priority - a.priority) || (entry(b) - entry(a)) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
test('pages.json: 全行に section・priority・aliases、related は無い（7.98 D368。近い道具は data/near.json）', () => {
  const ids = new Set(data.sections.map((s) => s.id));
  for (const p of data.pages) {
    assert.ok(ids.has(p.section), `${p.path} section`);
    assert.ok(Number.isInteger(p.priority) && p.priority >= 3 && p.priority <= 11, `${p.path} priority ${p.priority}`);   // 4 項の和（D323）
    assert.ok(Array.isArray(p.aliases) && p.aliases.length >= 1, `${p.path} aliases`);
    if (p.note != null) {
      assert.equal(p.related, undefined, `${p.path} related`);
      assert.ok([...p.note].length <= 15, p.note);
    }
  }
  // 札にする節（layer のある節）は、札の行に出せる一言つきの行が札の行数（柱 5・そのほか 3。情シス・PC は 4）以上ある
  for (const c of cardsJa(data)) assert.ok(c.rows.filter((r) => r.n != null).length >= c.vis, `${c.id} の候補が ${c.vis} 未満`);
});

test('pin は節ごとに 1 件以下', () => {
  for (const s of data.sections) assert.ok(data.pages.filter((p) => p.section === s.id && p.pin).length <= 1, s.id);
  // 2 件にすると build-top が止まる
  const two = structuredClone(data);
  two.pages.filter((p) => p.section === 'kazoku' && p.note != null).slice(0, 2).forEach((p) => { p.pin = true; });
  assert.throws(() => sectionsJa(two), /pin が 2 件以上/);
  // 1 件なら priority が低くても先頭の行に出る
  const one = structuredClone(data);
  const low = one.pages.filter((p) => p.section === 'kazoku' && p.note != null).sort((a, b) => a.priority - b.priority)[0];
  low.pin = true;
  assert.equal(sectionsJa(one).find((s) => s.id === 'kazoku').rows[0].path, low.path);
});

test('情シス・PC の札は PAC ファイル テスターに pin（優先度のままだと「ほかに」に入る。site-strategy-v2 3.5）', () => {
  const pac = data.pages.find((p) => p.path === '/pac-tester/');
  assert.equal(pac.section, 'it');
  assert.equal(pac.pin, true);
  assert.equal(sectionsJa(data).find((s) => s.id === 'it').rows[0].path, '/pac-tester/');
});

// 札のうち、札の行（別館の行は除く）の href
const cardOf = (html, id) => { const i = html.indexOf(`<section class="yt-card`, html.indexOf(`id="${id}" data-card`) - 40); return html.slice(i, html.indexOf('</section>', i)); };
const crows = (card) => [...card.split('<details')[0].matchAll(/<li(?: class="yt-mh")?><a href="([^"]+)"><span class="yt-cn">/g)].map((m) => m[1]);

test('札ごとの行が priority の上位 vis 件（pin が先、同点は入口＞子ページ、次に公開日の古い方）。いまの時期の行は札の頭に上がる。HTML の札も同じ', () => {
  const html = read('index.html');
  const secs = new Map(sectionsJa(data).map((s) => [s.id, s]));
  for (const c of cardsJa(data)) {
    const s = secs.get(c.id);
    const cands = s.rows.filter((r) => r.note != null);
    // 季節の行なし: 上位 vis 件
    const bare = [...YT.cardBodyHtml(c, [], './').matchAll(/<li(?: class="yt-mh")?><a href="\.\/([^"]+)"><span class="yt-cn">/g)].map((m) => '/' + m[1]);
    assert.deepEqual(bare, cands.slice(0, c.vis).map((r) => r.path), c.id);
    const restMax = Math.max(...cands.slice(c.vis).map((r) => r.priority), 0);
    for (const r of cands.slice(0, c.vis)) if (!r.pin) assert.ok(r.priority >= restMax, `${c.id} ${r.path}`);
    // 作った HTML: 別館の行（外の URL）のほか、札の行が vis 件
    const got = crows(cardOf(html, c.id)).filter((h) => h.startsWith('./'));
    assert.equal(got.length, c.vis, `${c.id} の HTML の行数`);
  }
});

test('同じ札に同じページが 2 回出ない（行・「ほかに」。スマホ用の重ね（yt-mo）は数えない）。札の行 ＋ 「ほかに」で、その節の全行', () => {
  const html = read('index.html');
  for (const s of sectionsJa(data).filter((x) => x.layer)) {
    const card = cardOf(html, s.id);
    const links = [...card.matchAll(/<li(?! class="yt-mo")[^>]*><a href="([^"]+)"/g)].map((m) => m[1]).filter((h) => h.startsWith('./'));
    assert.equal(new Set(links).size, links.length, `${s.id} の HTML に重複`);
    assert.equal(links.length, s.rows.length, `${s.id}: 全行が 1 回ずつ`);
    for (const r of s.rows) assert.ok(links.includes('./' + r.path.slice(1)) || links.some((l) => l.startsWith('./' + r.path.slice(1) + '#') || l === './' + r.path.slice(1)), `${s.id} ${r.path}`);
  }
});

test('「ほかに」（site-strategy-v2 3.5）: 札に出ない行は名前で全部。スマホで札から隠した行は yt-mo で同じ物を「ほかに」の中にも入れ、見出しの件数は PC とスマホで別', () => {
  const card = { id: 'x', vis: 2, mob: 1, annex: [], rows: [{ p: '/a/', t: 'A', n: 'a' }, { p: '/b/', t: 'B', n: 'b' }, { p: '/c/', t: 'C' }, { p: '/d/', t: 'D', n: 'd' }] };
  const h = YT.cardBodyHtml(card, [], './');
  assert.match(h, /<li><a href="\.\/a\/"><span class="yt-cn">A<\/span> <span class="yt-cs">a<\/span><\/a><\/li>/);
  assert.match(h, /<li class="yt-mh"><a href="\.\/b\/">/, '2 行目はスマホで隠す');
  assert.match(h, /<span class="yt-pc">ほかに 2 件<\/span><span class="yt-sp">ほかに 3 件<\/span>/);
  assert.match(h, /<li class="yt-mo"><a href="\.\/b\/">B<\/a><\/li>/);
  assert.match(h, /<li><a href="\.\/c\/">C<\/a><\/li>/, '一言の無い行は「ほかに」にだけ');
  // いまの時期の行は札の頭に上がり、一言の代わりに理由。元の行は「ほかに」から外れる
  const s = YT.cardBodyHtml(card, [{ path: '/d/', page: '/d/', name: 'D', reason: '理由', sec: 'x' }, { path: '/q/', name: 'Q', reason: 'q', sec: 'y' }], './');
  assert.match(s, /<ul class="yt-crows">\s*<li><a href="\.\/d\/"><span class="yt-cn">D<\/span> <span class="yt-cs">理由<\/span>/);
  assert.equal(s.split('href="./d/"').length - 1, 1, 'd は札の 1 行目だけ（ほかには出ない）');
  assert.ok(!s.includes('/q/'), '別の節の行は出ない');
});

test('priority.mjs の式（第 2 版 D323）: 需要＋表示＋PV＋季節（年末調整 ＝ A3＋表示3＋PV3＋季節2＝11 の形）。トップからの遷移は使わない', () => {
  const tools = { 'seido-keisan': { impressions: 900, pv: 90 }, ...Object.fromEntries(Array.from({ length: 39 }, (_, i) => [`t${i}`, { impressions: 800 - i, pv: 80 - i }])), 'loan-sim': { impressions: 1, pv: 1 } };
  const wk = { weeks: [{ period: { gsc: '2026-09-01/2026-09-07' }, tools, from_top: { '/loan-sim/': 99 } }] };
  const ranks = ranksFrom(wk);
  const inp = {
    month: 12,
    demand: { grades: { K02: 'A', K90: 'B', K91: 'C', K33: 'なし', K95: 'B' }, tools: { '/loan-sim/': 'A', '/tameshite/': 'C' },
      pages: { '/seido-keisan/nenmatsu/': 'K02', '/b/': 'K90', '/c/': 'K91', '/n/': 'K33', '/tameshite/hansha/': 'K95' } },
  };
  const s = { months: { 12: [{ path: '/seido-keisan/nenmatsu/' }] } };
  assert.deepEqual(terms('/seido-keisan/nenmatsu/', inp, s, ranks), { k: 'K02', grade: 'A', imprRank: 1, pvRank: 1, demand: 3, impressions: 3, pv: 3, season: 2, priority: 11 });
  assert.equal(terms('/loan-sim/', inp, s, ranks).priority, 3 + 1 + 1, 'トップからの遷移（from_top 99）は効かない。表示と PV は閾値未満で 1');
  assert.equal(terms('/seido-keisan/iryohi/', inp, s, ranks).impressions, 3); // リポジトリの順位を全ページに同じ値で
  assert.equal(terms('/t9/x/', inp, s, ranks).pv, 2);   // 11 位
  assert.equal(terms('/t8/', inp, s, ranks).pv, 3);     // 10 位
  assert.equal(terms('/t29/', inp, s, ranks).impressions, 1); // 31 位
  assert.equal(terms('/loan-sim/child/', inp, s, ranks).demand, 3); // 道具の根拠は子ページにも
  assert.equal(terms('/tameshite/hansha/', inp, s, ranks).demand, 2); // 子ページに K 行があれば K 行が先（道具は C）
  assert.equal(terms('/tameshite/', inp, s, ranks).demand, 1);
  assert.equal(terms('/b/', inp, s, ranks).demand, 2);
  assert.equal(terms('/c/', inp, s, ranks).demand, 1);
  assert.equal(terms('/n/', inp, s, ranks).demand, 1);
  assert.equal(terms('/nothing/', inp, s, ranks).priority, 1 + 1 + 1 + 0);
  assert.equal(terms('/seido-keisan/nenmatsu/', { ...inp, month: 11 }, s, ranks).priority, 9);
  const r = ranksOf({ a: 10, b: 10, c: 5 });
  assert.deepEqual([r.get('a'), r.get('b'), r.get('c'), r.get('d')], [1, 1, 3, undefined]);
  assert.deepEqual([demandPoints('A'), demandPoints('B'), demandPoints('C'), demandPoints('なし')], [3, 2, 1, 1]);
  assert.deepEqual([rankPoints(1), rankPoints(10), rankPoints(11), rankPoints(30), rankPoints(31), rankPoints(null)], [3, 3, 2, 2, 1, 1]);
  // 式のコードにトップからの遷移を読むところが無い
  assert.doesNotMatch(readFileSync(new URL('../tools/top/priority.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''), /from_top|fromTop/);
});

test('表示と PV の閾値（週の平均 2.5。7.24.3 の「4 週で 10 回」を週の平均に直したもの）。トップ自身は数えない', () => {
  assert.equal(MIN_IMPRESSIONS, 2.5);
  assert.equal(MIN_PV, 2.5);
  const wk = { weeks: [{ period: {}, tools: { big: { impressions: 50, pv: 50 }, small: { impressions: 2, pv: 2 }, none: { impressions: null, pv: null }, '(top)': { pv: 999 } } }] };
  const ranks = ranksFrom(wk);
  const inp = { month: 1, demand: { grades: {}, tools: {}, pages: {} } };
  const s = { months: {} };
  assert.deepEqual([terms('/big/', inp, s, ranks).impressions, terms('/big/', inp, s, ranks).pv], [3, 3]);
  assert.deepEqual([terms('/small/', inp, s, ranks).impressions, terms('/small/', inp, s, ranks).pv], [1, 1]);
  assert.equal(terms('/none/', inp, s, ranks).pv, 1);
  assert.equal(ranks.pv.get('(top)'), undefined);
});

test('weekly-tools.json: 停止（OUTAGES）と重なる週を外し、新しい 2 週の平均', () => {
  assert.equal(WEEKS, 2);
  assert.deepEqual(OUTAGES, [{ from: '2026-10-05', to: '2026-10-10' }]);
  assert.equal(overlapsOutage({ gsc: '2026-10-02/2026-10-08', cf: '2026-09-30/2026-10-04' }), true);
  assert.equal(overlapsOutage({ gsc: '2026-09-25/2026-10-01', cf: '2026-09-26/2026-10-03' }), false);
  assert.equal(overlapsOutage({ cf: '2026-10-10/2026-10-17' }), true);
  const w = (n, period) => ({ period, tools: { a: { impressions: n, pv: n * 2 } } });
  const a = aggregate({ weeks: [w(100, { gsc: '2026-09-01/2026-09-07' }), w(2, { gsc: '2026-09-08/2026-09-14' }), w(4, { gsc: '2026-09-15/2026-09-21' }), w(999, { gsc: '2026-10-04/2026-10-10' })] });
  assert.equal(a.impressions.a, 3, '(2 + 4) / 2。停止の週（999）と古い週（100）は使わない');
  assert.equal(a.pv.a, 6);
  assert.deepEqual(a.periods.map((p) => p.gsc), ['2026-09-08/2026-09-14', '2026-09-15/2026-09-21']);
});

test('台帳より前の道具の需要（DEMAND 7 章 / ROADMAP 7.24.2 の 1）', () => {
  assert.deepEqual(input.demand.tools, { '/loan-sim/': 'A', '/hoshizora-sanpo/': 'A', '/easy-split/': 'A', '/nittei-kouho/': 'B', '/shaho-check/': 'B', '/web-metronome/': 'B', '/todofuken-quiz/': 'B', '/md-viewer/': 'B', '/denki-dai/': 'C', '/pac-tester/': 'C', '/web-roulette/': 'C' });
  assert.match(input.demand.tools_source, /DEMAND 7 章.*7\.24\.2/);
  const v = computeAll(data.pages, input, season, weekly);
  assert.equal(v.get('/hoshizora-sanpo/zukan/').grade, 'A');
  assert.equal(v.get('/web-roulette/amida/').grade, 'B'); // K97 が先
  assert.equal(v.get('/web-roulette/').grade, 'C');
});

test('同点の順: 入口ページ ＞ 子ページ、次に公開日の古い方', () => {
  // 先頭の行のチップは別の節の 3 ページで埋め、x の並びだけを見る
  const z = [1, 2, 3].map((n) => ({ path: `/z${n}/`, date: '2026-01-01', title: `Z${n}`, section: 'y', priority: 2, aliases: [] }));
  const d = { sections: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }], pages: [...z,
    { path: '/k/new/', date: '2026-10-01', title: 'N', section: 'x', priority: 4, aliases: [], note: 'n' },
    { path: '/k/old/', date: '2026-09-01', title: 'O', section: 'x', priority: 4, aliases: [], note: 'o' },
    { path: '/k/', date: '2026-10-02', title: 'K', section: 'x', priority: 4, aliases: [], note: 'k' },
    { path: '/hi/x/', date: '2026-10-03', title: 'H', section: 'x', priority: 5, aliases: [], note: 'h' },
  ] };
  assert.deepEqual(sectionsJa(d)[0].rows.map((r) => r.path), ['/hi/x/', '/k/', '/k/old/', '/k/new/']);
});

test('札の行は柱 5・そのほか 3（情シス・PC は別館 2 行 ＋ 4 行）。チップは無い（第 2 版 D323 の CHIP_ROWS は、札に替わって消えた）', () => {
  const html = read('index.html');
  assert.deepEqual(cardsJa(data).map((c) => [c.id, c.vis, c.mob]), [['okane', 5, 3], ['gakko', 5, 3], ['it', 4, 3], ['kazoku', 3, 2], ['atsumari', 3, 2], ['hoshi', 3, 2], ['oto', 3, 2]]);
  assert.doesNotMatch(html, /yt-chips/);
});

// /all/ の節の塊（<section> 〜 </section>）
const block = (html, id) => { const i = html.indexOf(`<section class="yt-sec" id="${id}"`); return html.slice(i, html.indexOf('</section>', i)); };

test('/all/: 1 画面目に検索欄と節の目次（7 つへのジャンプ）、各節の見出しに「トップへ」', () => {
  const h = read('all/index.html');
  const toc = h.indexOf('<nav class="yt-toc"'), firstSec = h.indexOf('<section class="yt-sec"');
  assert.ok(h.indexOf('role="combobox"') > 0 && h.indexOf('role="combobox"') < toc && toc < firstSec);
  const nav = h.slice(toc, h.indexOf('</nav>', toc));
  assert.deepEqual([...nav.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1]), data.sections.filter((s) => s.layer).map((s) => s.id), '目次は札にする 7 節（このサイトは入れない）');
  for (const s of data.sections) assert.match(block(h, s.id), new RegExp(`<h2 id="${s.id}-h">[^<]+</h2><a href="#main">トップへ</a>`));
  assert.match(h, /<main id="main">/);
});

test('priority.mjs: 入力は weekly-tools.json の写し（yorozu-plans の docs/data から）。pages.json の priority は入力から計算した値（--check と同じ）', () => {
  assert.ok(Array.isArray(weekly.weeks) && weekly.weeks.length >= 1);
  assert.equal(input.gsc, undefined); // 7.24.3 で gsc.repos から weekly-tools.json に切り替えた
  const v = computeAll(data.pages, input, season, weekly);
  const a = aggregate(weekly), top = Object.keys(a.pv).sort((x, y) => a.pv[y] - a.pv[x])[0];
  assert.equal(v.get(data.pages.find((p) => p.path.split('/')[1] === top).path).pvRank, 1); // 使う週の PV の平均がいちばん多い道具が 1 位（道具を名指しすると週の入れ替わりで落ちる）
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
