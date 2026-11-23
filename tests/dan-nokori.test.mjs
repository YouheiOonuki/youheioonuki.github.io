// Q-1235: 残った断りを消す（先生向け・介護向け・/en/）。check-site は広告なしの定型文を「要る」としない。エンドボードの一言は「サポート終了日」（D1062）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const data = JSON.parse(read('data/pages.json'));

test('Q-1235: /for/teachers/ の lead と og:description から「登録なし」と「入力は端末の外に出ません」を消した。title は変えない', () => {
  const html = read('for/teachers/index.html');
  assert.ok(html.includes('<p class="lead">教室でそのまま使える道具。印刷して配るもの、黒板の前で動かすもの。</p>'));
  assert.ok(html.includes('<meta property="og:description" content="教室でそのまま使える道具。印刷して配るもの、黒板の前で動かすもの。">'));
  assert.ok(!html.includes('端末の外'));
  assert.ok(html.includes('<title>先生向けの無料の道具（席替え・当番表・ビンゴ・学習プリント）登録なし｜yorozu-craft</title>'));
});

test('Q-1235: /for/kaigo/ の lead の段落が無く、og:title から「広告なし」を外した。title は変えない', () => {
  const html = read('for/kaigo/index.html');
  assert.ok(!html.includes('class="lead"'));
  assert.ok(!html.includes('端末の外'));
  assert.ok(html.includes('<meta property="og:title" content="介護・デイサービス向けの印刷物｜yorozu-craft">'));
  assert.ok(html.includes('<title>介護・デイサービスのレクに使える印刷物（脳トレ・昭和クイズ・写経）広告なし｜yorozu-craft</title>'));
});

test('Q-1235: /en/ の lead から "No sign-up. " を消しただけ', () => {
  const en = read('en/index.html');
  assert.ok(en.includes('<p class="lead">Small, free tools. The browser tools keep what you enter in your browser.</p>'));
  assert.ok(!en.includes('No sign-up'));
});

test('Q-1235: check-site は広告なしのページに定型文を要るとしない（定型文を比べて落とす行が無い）。META_ONLY との突き合わせは残る', () => {
  const src = read('tools/check-site.mjs');
  assert.ok(!src.includes('高齢者向けの広告なしページに定型文'));
  assert.ok(!src.includes('AD_FREE_EXCEPT'));
  assert.ok(src.includes('高齢者向けのページ（ELDERLY_PAGES）なのに META_ONLY に無い'));
  assert.ok(src.includes('があるのに META_ONLY_PAGES・META_ONLY_PREFIXES に無い'));
});

test('Q-1235: エンドボードの一言は「サポート終了日」で、トップ・/for/it/ も同じ字', () => {
  const annex = data.sections.find((s) => s.id === 'it').annex;
  assert.equal(annex.find((a) => a.name === 'エンドボード').note, 'サポート終了日');
  assert.ok(read('index.html').includes('<span class="yt-cs">サポート終了日</span>'));
  assert.ok(read('for/it/index.html').includes('<strong>エンドボード</strong><span>サポート終了日。</span>'));
  for (const f of ['index.html', 'for/it/index.html', 'data/pages.json']) assert.ok(!read(f).includes('サポートが切れる日'), f);
});
