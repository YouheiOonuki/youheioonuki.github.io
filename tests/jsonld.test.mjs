// JSON-LD と画面の突き合わせ（yorozu-plans ROADMAP 7.181・QUEUE Q-074）: name ＝ h1、FAQPage ＝ 画面の「よくある質問」
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ldBlocks, nameMismatches, faqDiff, h1Text } from '../tools/jsonld.mjs';

const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
const faq = (...qs) => ld({ '@type': 'FAQPage', mainEntity: qs.map((q) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: 'a' } })) });

test('name は h1 の文と比べる（タグ・文字参照・空白は揃えてから）', () => {
  const html = `${ld({ '@type': 'WebApplication', name: 'A & B の計算' })}<h1>A &amp; B の<span>計算</span></h1>`;
  assert.equal(h1Text(html), 'A & B の計算');
  assert.deepEqual(nameMismatches(html), []);
  const bad = `${ld({ '@type': 'WebPage', name: 'A｜yorozu-craft' })}<h1>A</h1>`;
  assert.deepEqual(nameMismatches(bad), [{ type: 'WebPage', name: 'A｜yorozu-craft', h1: 'A' }]);
});

test('@graph と配列の中の WebApplication も見る。ほかの型（Article など）の name は見ない', () => {
  const html = `${ld({ '@graph': [{ '@type': 'WebApplication', name: 'X' }, { '@type': 'Article', name: 'Y' }] })}<h1>Z</h1>`;
  assert.equal(nameMismatches(html).length, 1);
});

test('読めない JSON-LD は error として返す', () => {
  assert.ok(ldBlocks('<script type="application/ld+json">{ "a": </script>')[0].error);
});

test('FAQPage の問い ＝ 画面の「よくある質問」の節の dt（次の h2 から先は数えない）', () => {
  const screen = '<h2>よくある質問</h2><dl class="faq"><dt>問1？</dt><dd>答</dd><dt>問2？</dt><dd>答</dd></dl><h2>根拠と確認日</h2><dl><dt>根拠となる法律</dt></dl>';
  assert.deepEqual(faqDiff(faq('問1？', '問2？') + screen), { onlyScreen: [], onlyLd: [] });
  assert.deepEqual(faqDiff(faq('問1？') + screen), { onlyScreen: ['問2？'], onlyLd: [] });
  assert.deepEqual(faqDiff(faq('問1？', '問2？', '問3？') + screen), { onlyScreen: [], onlyLd: ['問3？'] });
});

test('dt が無い節は h3 を問いとして読む。英語の見出し（Common questions）も節', () => {
  const html = faq('How?') + '<h2>Common questions this answers</h2><h3>How?</h3><p>a</p><h3>Why?</h3><p>b</p>';
  assert.deepEqual(faqDiff(html), { onlyScreen: ['Why?'], onlyLd: [] });
});

test('FAQPage も画面の節も無いページは対象外。FAQPage だけあれば全部が「画面に無い」', () => {
  assert.equal(faqDiff('<h1>a</h1><h2>使い方</h2>'), null);
  assert.deepEqual(faqDiff(faq('問？') + '<h1>a</h1>'), { onlyScreen: [], onlyLd: ['問？'] });
});
