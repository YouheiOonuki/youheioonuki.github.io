// 道具のページの「近い道具」（yorozu-plans ROADMAP 7.98 D368 の改）: 0 個は欄なし・置き場・2 度差し込まない・near_click は道と event だけ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nearBlock, injectNear, injectScreen, NEAR_STYLE, GUIDE_ANCHORS, isGuideFile, sectionFallback, buildNear } from '../tools/build-near.mjs';

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

// D897・Q-1139: 同じフォルダの guide-*.html にも入れる。0 個の行だけ、同じ節・同じ言語から priority の順に 2 つ
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
  ],
  en: { pages: [{ path: '/a/en/', title: 'A en' }, { path: '/b/en/', title: 'B en' }] },
};

test('使い方のファイルは同じフォルダの guide.html と guide-*.html', () => {
  for (const f of ['guide.html', 'guide-hasuu.html', 'guide-keisha.html']) assert.ok(isGuideFile(f), f);
  for (const f of ['index.html', 'guidebook.html', 'guide-.html', 'my-guide.html', 'guide.htm']) assert.ok(!isGuideFile(f), f);
});

test('0 個の行には同じ節・同じ言語の道具を priority の高い順に 2 つ（同点は path の順）。自分・NOINDEX_ON_TOP・NOT_ON_TOP は入れない', () => {
  assert.deepEqual(sectionFallback('/a/', PAGES), [{ url: '/b/', title: 'B', note: '' }, { url: '/c/', title: 'C', note: 'c' }]);
  assert.deepEqual(sectionFallback('/b/', PAGES).map((n) => n.url), ['/a/', '/c/']);
});

test('同じ節に当たる道具が無い・節の欄が無い（英語）・一覧に無い道具は 0 個のまま', () => {
  assert.deepEqual(sectionFallback('/z/', PAGES), []);
  assert.deepEqual(sectionFallback('/a/en/', PAGES), []);
  assert.deepEqual(sectionFallback('/nai/', PAGES), []);
});

test('配信フォルダに差し込む: guide-*.html にも入り、0 個の行は同じ節の 2 つ、1 個以上の行は near.json のまま、同じ節に無ければ欄を出さない', () => {
  const site = mkdtempSync(join(tmpdir(), 'near-'));
  try {
    const page = (t) => `<html><head></head><body><main><p>${t}</p></main></body></html>`;
    for (const d of ['a', 'b', 'z']) mkdirSync(join(site, d));
    for (const f of ['index.html', 'guide.html', 'guide-hasuu.html', 'other.html']) writeFileSync(join(site, 'a', f), page(f));
    writeFileSync(join(site, 'b', 'index.html'), page('b'));
    writeFileSync(join(site, 'z', 'index.html'), page('z'));
    writeFileSync(join(site, 'z', 'guide.html'), page('zg'));
    const near = { '/a/': [], '/b/': [{ url: '/k/', title: 'K', note: '' }], '/z/': [] };
    const r = buildNear(site, near, PAGES);
    const read = (...f) => readFileSync(join(site, ...f), 'utf8');
    for (const f of ['index.html', 'guide.html', 'guide-hasuu.html']) {
      const h = read('a', f);
      assert.deepEqual([...h.matchAll(/<a href="([^"]+)" data-near-link>/g)].map((m) => m[1]), ['/b/', '/c/'], f);
    }
    assert.ok(!read('a', 'other.html').includes('data-near-block'), 'guide 以外の名前には入れない');
    assert.equal(read('b', 'index.html'), injectNear(page('b'), near['/b/']), '1 個以上の行は near.json のまま');
    assert.ok(!read('z', 'index.html').includes('data-near-block'));
    assert.ok(!read('z', 'guide.html').includes('data-near-block'));
    assert.deepEqual([r.done, r.guides, r.filled, r.empty], [2, 2, 1, 1]);
  } finally { rmSync(site, { recursive: true, force: true }); }
});
