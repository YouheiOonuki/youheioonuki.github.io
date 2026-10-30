// アイコン・og・manifest・theme-color の生成（tools/build-brand.mjs、yorozu-plans ROADMAP 7.140 D416・7.141）の門:
// 値は皮から写す、v1 の色だけを替えて道具の自前の色は残す、土台のページは触らない、本体の生成物が今の正本と同じ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokens } from '../tools/build-404.mjs';
import { themeColor, manifest, manifestName, favicon, ogHtml, ogTitle, V1_TO_SKIN } from '../tools/build-brand.mjs';

const t = tokens();
const root = fileURLToPath(new URL('..', import.meta.url));

test('theme-color: v1 の 2 行は皮の --bg の明暗 2 行に', () => {
  const html = '<head>\n  <meta name="theme-color" content="#8b4513" media="(prefers-color-scheme: light)">\n  <meta name="theme-color" content="#1c1814" media="(prefers-color-scheme: dark)">\n</head>';
  const { text, own } = themeColor(html, t);
  assert.deepEqual(own, []);
  assert.ok(text.includes(`  <meta name="theme-color" content="${t.light['--bg']}" media="(prefers-color-scheme: light)">`));
  assert.ok(text.includes(`  <meta name="theme-color" content="${t.dark['--bg']}" media="(prefers-color-scheme: dark)">`));
  assert.ok(!text.includes('#8b4513') && !text.includes('#1c1814'));
  assert.equal(themeColor(text, t).text, text, '2 回目は変わらない');
});

test('theme-color: 自前の色と土台のページは残す', () => {
  const own = '<meta name="theme-color" content="#000000">';
  assert.deepEqual(themeColor(own, t), { text: own, own: ['#000000'] });
  const base = '<html data-skin="base"><meta name="theme-color" content="#8b4513">';
  assert.equal(themeColor(base, t).text, base);
});

test('manifest: v1 の色は明るい --bg に、自前の色なら残す', () => {
  const v1 = '{ "background_color": "#f0ebe0", "theme_color": "#8b4513" }';
  assert.equal(manifest(v1, t).text, `{ "background_color": "${t.light['--bg']}", "theme_color": "${t.light['--bg']}" }`);
  const black = '{ "background_color": "#000000", "theme_color": "#000000" }';
  assert.equal(manifest(black, t).text, black);
});

test('favicon: v1 のトークンの色だけ同じ役の皮の色に、道具の色は残す', () => {
  const svg = '<svg><rect fill="#FAF6EE"/><path fill="#8b4513"/><path fill="#3f6b2a"/></svg>';
  const out = favicon(svg, t);
  assert.equal(out, `<svg><rect fill="${t.light['--bg']}"/><path fill="${t.light['--accent']}"/><path fill="#3f6b2a"/></svg>`);
  for (const k of Object.values(V1_TO_SKIN)) assert.ok(t.light[k], `皮に ${k} がある`);
});

test('og: 皮の 2 色と題名の字だけ', () => {
  const html = ogHtml('A & <B>', t);
  assert.ok(html.includes(`background: ${t.light['--bg']}`) && html.includes(`color: ${t.light['--text']}`));
  assert.ok(html.includes('<h1>A &amp; &lt;B></h1>'));
  assert.ok(!/<img|<svg/.test(html));
});

test('og の題名: 道具は pages.json の入口の title、本体は manifest の name', () => {
  const pages = JSON.parse(readFileSync(new URL('../data/pages.json', import.meta.url), 'utf8')).pages;
  assert.equal(ogTitle('../lifeplan', root), pages.find(p => p.path === '/lifeplan/').title);
  assert.equal(ogTitle(root, root), JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8')).name);
});

test('manifest の name: 上の段の name だけを題名に、short_name とショートカットの name は残す（D419）', () => {
  const json = '{\n  "name": "古い名｜yorozu-craft",\n  "short_name": "古い",\n  "shortcuts": [\n    { "name": "毎日 1 問", "url": "./mainichi/" }\n  ]\n}';
  const out = manifestName(json, '新しい "名"');
  assert.equal(JSON.parse(out).name, '新しい "名"');
  assert.equal(JSON.parse(out).short_name, '古い');
  assert.equal(JSON.parse(out).shortcuts[0].name, '毎日 1 問');
  assert.equal(manifestName(out, '新しい "名"'), out, '2 回目は変わらない');
});

test('og の題名は start_url のページも引ける（大時計の manifest）', () => {
  const pages = JSON.parse(readFileSync(new URL('../data/pages.json', import.meta.url), 'utf8')).pages;
  assert.equal(ogTitle('../otasuke', root, 'tokei/'), pages.find(p => p.path === '/otasuke/tokei/').title);
});
