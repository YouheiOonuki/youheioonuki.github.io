// 道具のページの「近い道具」（yorozu-plans ROADMAP 7.98 D368 の改）: 0 個は欄なし・置き場・2 度差し込まない・near_click は道と event だけ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nearBlock, injectNear } from '../tools/build-near.mjs';

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
  const page = '<main><p>計算</p>\n<!-- about-tool: 説明 -->\n<details class="about-tool card" id="about-tool">…</details></main>';
  const out = injectNear(page, items);
  assert.ok(out.indexOf('data-near-block') < out.indexOf('<!-- about-tool:'));
  assert.equal(injectNear(out, items), out, '2 度目は何もしない');
  const plain = injectNear('<main><p>x</p></main>', items);
  assert.ok(plain.indexOf('data-near-block') < plain.indexOf('</main>'));
  assert.equal(injectNear('<div>main が無い</div>', items), '<div>main が無い</div>');
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
