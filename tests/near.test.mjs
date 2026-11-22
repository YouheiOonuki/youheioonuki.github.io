// 道具のページの「近い道具」（yorozu-plans ROADMAP 7.98 D368 の改）: 0 個は欄なし・置き場・2 度差し込まない・near_click は道と event だけ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nearBlock, injectNear, injectScreen, NEAR_STYLE, GUIDE_ANCHORS, isGuideFile, sectionFallback, buildNear, NO_SECTION_FALLBACK, jaPairOf } from '../tools/build-near.mjs';

const items = [{ url: '/seido-keisan/iryohi/', title: '医療費控除の計算', note: 'いくら戻るかの目安' }, { url: '/otasuke/kenshin/', title: '健診グラフ<b>', note: '' }];

test('0 個なら欄を出さない。中身はエスケープし、日英で見出しが変わる', () => {
  assert.equal(nearBlock([]), '');
  assert.equal(injectNear('<main>x</main>', []), '<main>x</main>');
  const b = nearBlock(items);
  assert.match(b, /<h2 id="yz-near-h">近い道具<\/h2>/);
  assert.match(b, /<a href="\/seido-keisan\/iryohi\/" data-near-link>医療費控除の計算<\/a><span>いくら戻るかの目安<\/span>/);
  assert.match(b, /健診グラフ&lt;b&gt;/);
  assert.match(nearBlock(items, 'en'), /<h2 id="yz-near-h">Related tools<\/h2>/);
  assert.match(b, /class="yz-near no-print"/, '印刷しない');
});

test('置き場は「この道具について」の直前、無ければ </main> の直前。2 度は入れない', () => {
  const page = '<head></head><main><p>計算</p>\n<!-- about-tool: 説明 -->\n<details class="about-tool card" id="about-tool">…</details></main>';
  const out = injectNear(page, items);
  assert.ok(out.indexOf('data-near-block') < out.indexOf('<!-- about-tool:'));
  assert.equal(injectNear(out, items), out, '2 度目は何もしない');
  const plain = injectNear('<head></head><main><p>x</p></main>', items);
  assert.ok(plain.indexOf('data-near-block') < plain.indexOf('</main>'));
  assert.equal(injectNear('<div>main が無い</div>', items), '<div>main が無い</div>');
});

test('使い方（guide.html）には本文の末尾（</main> の直前、フッターの前）に同じ欄を入れる。about-tool の印があっても置き場は </main>', () => {
  const guide = '<head></head><main><h2>使い方</h2><h3 id="changelog">更新履歴</h3></main><footer>f</footer>';
  const out = injectNear(guide, items, 'ja', GUIDE_ANCHORS);
  assert.ok(out.indexOf('id="changelog"') < out.indexOf('data-near-block'));
  assert.ok(out.indexOf('data-near-block') < out.indexOf('</main>'));
  assert.equal(out.match(/data-near-link/g).length, items.length);
  assert.equal(injectNear(out, items, 'ja', GUIDE_ANCHORS), out, '2 度目は何もしない');
  const withAbout = '<head></head><main><!-- about-tool: x --><p>y</p></main>';
  assert.ok(injectNear(withAbout, items, 'ja', GUIDE_ANCHORS).indexOf('data-near-block') > withAbout.indexOf('<p>y</p>'));
  assert.equal(injectNear(guide, [], 'ja', GUIDE_ANCHORS), guide, '0 個なら出さない');
});

test('全画面の印（<body data-fullscreen>）の在る画面は、入った物と出た物がバイトで同じ（Q-564）', () => {
  for (const html of [
    '<html><head></head><body class="app" data-fullscreen><main><canvas id="sky"></canvas></main></body></html>',
    '<html><head></head><body data-fullscreen>\n<main><p>x</p>\n<!-- about-tool: x -->\n</main></body></html>',
  ]) assert.equal(injectScreen(html, items), html);
  // 本文の中の字や別の要素の属性は印ではない
  const notBody = '<html><head></head><body class="app"><main><div data-fullscreen>x</div></main></body></html>';
  assert.ok(injectScreen(notBody, items).includes('data-near-block'));
});

test('印の無い画面は今までどおり差し込む（injectNear と同じ物を返す）', () => {
  for (const html of [
    '<head></head><main><p>計算</p>\n<!-- about-tool: 説明 -->\n<details class="about-tool card" id="about-tool">…</details></main>',
    '<html><head></head><body class="app"><main><p>x</p></main></body></html>',
  ]) {
    const out = injectScreen(html, items);
    assert.equal(out, injectNear(html, items));
    assert.ok(out.includes('data-near-block'));
  }
});

test('near.js は data-near-link を押したときだけ、行き先の道と near_click を送る（入力は読まない）', () => {
  const js = readFileSync(new URL('../near.js', import.meta.url), 'utf8');
  assert.match(js, /closest\('a\[data-near-link\]'\)/);
  assert.match(js, /JSON\.stringify\(\{ page: a\.getAttribute\('href'\), event: 'near_click' \}\)/);
  assert.doesNotMatch(js, /\.value|localStorage|document\.cookie/);
});

test('data/near.json は 125 ページ分で、各 3 つまで・自分を含まない', () => {
  const near = JSON.parse(readFileSync(new URL('../data/near.json', import.meta.url), 'utf8')).near;
  assert.ok(Object.keys(near).length >= 120);
  for (const [p, list] of Object.entries(near)) {
    assert.ok(list.length <= 3, p);
    assert.ok(!list.some((n) => n.url === p), p);
  }
});

test('見た目の <style> は <section> の中でなく </head> の直前に 1 回だけ入る（HTML の妥当性、Q-088）。<head> が無ければ差し込まない', () => {
  assert.ok(!nearBlock(items).includes('<style'), '欄の中に <style> を置かない');
  const out = injectNear('<html><head><title>t</title></head><body><main><p>x</p></main></body></html>', items);
  assert.equal(out.match(/<style data-near-style>/g).length, 1);
  assert.ok(out.indexOf(NEAR_STYLE) < out.indexOf('</head>'));
  assert.ok(out.indexOf('</head>') < out.indexOf('data-near-block'));
  assert.ok(!/<section[^>]*data-near-block[\s\S]*<style[\s\S]*<\/section>/.test(out));
  assert.equal(injectNear('<main><p>x</p></main>', items), '<main><p>x</p></main>', '<head> が無いページはそのまま');
});

// D897・Q-1139: 同じフォルダの guide-*.html にも入れる。0 個の行だけ、同じ節・同じ言語から 2 つまで
// D905・Q-1144: 同じ repo（path の最初の区切り）の道具が在れば同じ repo だけから。名前で外す 3 行。キーの無い道具。英語は日本語の対の節と priority を借りる
const PAGES = {
  pages: [
    { path: '/a/', title: 'A', section: 'it', priority: 5, note: 'a の道具' },
    { path: '/b/', title: 'B', section: 'it', priority: 7 },
    { path: '/d/', title: 'D', section: 'it', priority: 5, note: 'd' },
    { path: '/c/', title: 'C', section: 'it', priority: 5, note: 'c' },
    { path: '/easy-split/quick/', title: 'Q', section: 'it', priority: 9 },
    { path: '/hade/', title: 'H', section: 'it', priority: 9 },
    { path: '/z/', title: 'Z', section: 'oya', priority: 9 },
    { path: '/k/', title: 'K', section: 'kurashi', priority: 3 },
    { path: '/r/', title: 'R', section: 'it', priority: 1 },
    { path: '/r/x/', title: 'RX', section: 'it', priority: 2 },
    { path: '/r/y/', title: 'RY', section: 'it', priority: 4 },
    { path: '/r/w/', title: 'RW', section: 'it', priority: 4 },
    { path: '/r/other/', title: 'RO', section: 'kodomo', priority: 9 },
    { path: '/s/', title: 'S', section: 'kurashi', priority: 1 },
    { path: '/s/one/', title: 'S1', section: 'kurashi', priority: 2 },
    { path: '/post/', title: 'P', section: 'it', priority: 3 },
    { path: '/todofuken-quiz/', title: 'TQ', section: 'it', priority: 3 },
    { path: '/shaho-check/', title: 'SC', section: 'kurashi', priority: 3 },
  ],
  en: { pages: [
    { path: '/a/en/', title: 'A en' },
    { path: '/b/en/', title: 'B en', note: 'b en' },
    { path: '/r/en/', title: 'R en' },
    { path: '/r/en/x/', title: 'RX en' },
    { path: '/r/en/y/', title: 'RY en' },
    { path: '/solo/en/', title: 'Solo en' },
  ] },
};
const urls = (l) => l.map((n) => n.url);

test('使い方のファイルは同じフォルダの guide.html と guide-*.html', () => {
  for (const f of ['guide.html', 'guide-hasuu.html', 'guide-keisha.html']) assert.ok(isGuideFile(f), f);
  for (const f of ['index.html', 'guidebook.html', 'guide-.html', 'my-guide.html', 'guide.htm']) assert.ok(!isGuideFile(f), f);
});

test('同じ repo の道具が無ければ、同じ節・同じ言語の道具を priority の高い順に 2 つ（同点は path の順）。自分・NOINDEX_ON_TOP・NOT_ON_TOP は入れない', () => {
  assert.deepEqual(sectionFallback('/a/', PAGES), [{ url: '/b/', title: 'B', note: '' }, { url: '/c/', title: 'C', note: 'c' }]);
  assert.deepEqual(urls(sectionFallback('/b/', PAGES)), ['/a/', '/c/']);
});

test('同じ repo の道具が同じ節に在れば、同じ repo だけから priority の順に 2 つまで（節の上の道具より先）。別の節の同じ repo は入れない', () => {
  assert.deepEqual(urls(sectionFallback('/r/', PAGES)), ['/r/w/', '/r/y/']);
  assert.deepEqual(urls(sectionFallback('/r/y/', PAGES)), ['/r/w/', '/r/x/']);
});

test('同じ repo の道具が 1 つしか無ければ 1 つだけ（節の道具で埋めない）', () => {
  assert.deepEqual(urls(sectionFallback('/s/', PAGES)), ['/s/one/']);
  assert.deepEqual(urls(sectionFallback('/s/one/', PAGES)), ['/s/']);
});

test('名前で外す 3 行は、同じ節に道具が在っても欄なし（D905）', () => {
  assert.deepEqual(NO_SECTION_FALLBACK, ['/post/', '/todofuken-quiz/', '/shaho-check/']);
  for (const p of NO_SECTION_FALLBACK) assert.deepEqual(sectionFallback(p, PAGES), [], p);
});

test('英語は日本語の対（/en/ を 1 つ除いた path）の節と priority を借り、en.pages の中で同じ決まり。対の無い英語は欄なし', () => {
  assert.equal(jaPairOf('/hoshizora-sanpo/en/calendar/'), '/hoshizora-sanpo/calendar/');
  assert.equal(jaPairOf('/pac-tester/en/'), '/pac-tester/');
  assert.deepEqual(sectionFallback('/r/en/', PAGES), [{ url: '/r/en/y/', title: 'RY en', note: '' }, { url: '/r/en/x/', title: 'RX en', note: '' }]);
  assert.deepEqual(urls(sectionFallback('/a/en/', PAGES)), ['/b/en/', '/r/en/y/']);
  assert.deepEqual(sectionFallback('/b/en/', PAGES)[0], { url: '/a/en/', title: 'A en', note: '' });
  assert.deepEqual(sectionFallback('/solo/en/', PAGES), []);
});

test('同じ節に当たる道具が無い・一覧に無い道具は 0 個のまま', () => {
  assert.deepEqual(sectionFallback('/z/', PAGES), []);
  assert.deepEqual(sectionFallback('/nai/', PAGES), []);
  assert.deepEqual(sectionFallback('/nai/en/', PAGES), []);
});

test('配信フォルダに差し込む: guide-*.html にも入り、0 個の行は同じ節から、near.json にキーの無い道具も同じ、1 個以上の行は near.json のまま、当たらなければ欄を出さない', () => {
  const site = mkdtempSync(join(tmpdir(), 'near-'));
  const BN = {
    pages: [
      { path: '/a/', title: 'A', section: 'it', priority: 5 },
      { path: '/b/', title: 'B', section: 'it', priority: 7 },
      { path: '/c/', title: 'C', section: 'it', priority: 5, note: 'c' },
      { path: '/z/', title: 'Z', section: 'oya', priority: 9 },
      { path: '/loan/', title: 'L', section: 'kurashi', priority: 6 },
      { path: '/loan/x/', title: 'LX', section: 'kurashi', priority: 3 },
    ],
    en: { pages: [{ path: '/b/en/', title: 'B en' }] },
  };
  try {
    const page = (t) => `<html><head></head><body><main><p>${t}</p></main></body></html>`;
    for (const d of ['a', 'b', 'z', 'loan']) mkdirSync(join(site, d));
    for (const f of ['index.html', 'guide.html', 'guide-hasuu.html', 'other.html']) writeFileSync(join(site, 'a', f), page(f));
    writeFileSync(join(site, 'b', 'index.html'), page('b'));
    writeFileSync(join(site, 'z', 'index.html'), page('z'));
    writeFileSync(join(site, 'z', 'guide.html'), page('zg'));
    writeFileSync(join(site, 'loan', 'index.html'), page('loan'));
    const near = { '/a/': [], '/b/': [{ url: '/k/', title: 'K', note: '' }], '/z/': [] };   // /c/・/loan/・/loan/x/・/b/en/ はキーが無い
    const r = buildNear(site, near, BN);
    const read = (...f) => readFileSync(join(site, ...f), 'utf8');
    const links = (h) => [...h.matchAll(/<a href="([^"]+)" data-near-link>/g)].map((m) => m[1]);
    for (const f of ['index.html', 'guide.html', 'guide-hasuu.html']) assert.deepEqual(links(read('a', f)), ['/b/', '/c/'], f);
    assert.ok(!read('a', 'other.html').includes('data-near-block'), 'guide 以外の名前には入れない');
    assert.equal(read('b', 'index.html'), injectNear(page('b'), near['/b/']), '1 個以上の行は near.json のまま');
    assert.ok(!read('z', 'index.html').includes('data-near-block'));
    assert.ok(!read('z', 'guide.html').includes('data-near-block'));
    assert.deepEqual(links(read('loan', 'index.html')), ['/loan/x/'], 'キーの無い道具にも入る（同じ repo の 1 つ）');
    // done: a・b・loan / filled: a・c・loan・loan/x（c と loan/x はファイルが無い）/ empty: z・/b/en/（en.pages に同じ節の対が無い）
    assert.deepEqual([r.done, r.guides, r.filled, r.empty, r.missing], [3, 2, 4, 2, 2]);
  } finally { rmSync(site, { recursive: true, force: true }); }
});
