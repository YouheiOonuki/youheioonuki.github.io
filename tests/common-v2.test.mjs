// yorozu-common v2（yorozu-plans ROADMAP 7.98 D369・DESIGN.md）の門: 皮の対比（本文 ≥ 7・補足 ≥ 4.5・ボタンの字 ≥ 4.5・入力の枠 ≥ 3）、大きさ（gzip 10 KB 以内）、影・明朝を使わない、土台は色を持たない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const read = (f) => readFileSync(new URL('../tools/common/v2/' + f, import.meta.url), 'utf8');
const skin = read('skin.css'), base = read('base.css');
const L = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = tokens(skin.slice(skin.indexOf(':where(html:not([data-skin="base"])) {'), skin.indexOf('@media (prefers-color-scheme: dark)')));
const dark = { ...light, ...tokens(skin.slice(skin.indexOf('@media (prefers-color-scheme: dark)'), skin.indexOf(' body {'))) };

for (const [name, t] of [['明るい', light], ['暗い', dark]]) {
  test(`皮の対比（${name}）: 本文 7 以上・補足 4.5 以上・リンク 4.5 以上・ボタンの字 4.5 以上・入力の枠 3 以上`, () => {
    for (const bg of ['bg', 'card']) {
      assert.ok(ratio(t.text, t[bg]) >= 7, `本文/${bg} ${ratio(t.text, t[bg]).toFixed(2)}`);
      assert.ok(ratio(t.muted, t[bg]) >= 4.5, `補足/${bg} ${ratio(t.muted, t[bg]).toFixed(2)}`);
      assert.ok(ratio(t.accent, t[bg]) >= 4.5, `リンク/${bg} ${ratio(t.accent, t[bg]).toFixed(2)}`);
      assert.ok(ratio(t['input-border'], t[bg]) >= 3, `入力の枠/${bg} ${ratio(t['input-border'], t[bg]).toFixed(2)}`);
    }
    assert.ok(ratio(t['on-accent'], t.accent) >= 4.5, `ボタンの字 ${ratio(t['on-accent'], t.accent).toFixed(2)}`);
  });
}

test('大きさ: 土台＋皮で gzip 10 KB 以内', () => {
  assert.ok(gzipSync(base).length + gzipSync(skin).length <= 10 * 1024);
});

test('やらないこと: 影・明朝・2 色目の強調を持たない。土台は色の値を持たない（既定の値は var() の予備だけ）', () => {
  for (const css of [base, skin]) {
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /box-shadow:(?!\s*0 0 0 2px var\(--focus)/, '影（フォーカスの縁を除く）');
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /Mincho|明朝|[^-]serif[,;"]/, '明朝');
  }
  assert.doesNotMatch(base.replace(/\/\*[\s\S]*?\*\//g, ''), /--(bg|text|accent|card|muted):/, '土台は色のトークンを決めない');
  assert.match(base, /prefers-reduced-motion: reduce/);
  assert.match(base, /min-height: var\(--tap\)/);
});

test('皮のどの規則も、土台のページ（<html data-skin="base">）では外れる', () => {
  const rules = skin.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  for (const sel of rules) for (const one of sel.split(/,(?![^(]*\))/)) assert.match(one.trim(), /^:where\(html:not\(\[data-skin="base"\]\)\)/, one);
});

test('配る正本は v2 の土台＋皮をそのまま begin〜end で包んだもの', async () => {
  const { master, version } = await import('../tools/sync-common.mjs');
  const m = master();
  assert.equal(version(m), 'v2');
  assert.ok(m.includes(base.trim()) && m.includes(skin.trim()));
  assert.ok(m.indexOf(base.trim()) < m.indexOf(skin.trim()), '土台が先');
  assert.ok(m.trim().endsWith('/* yorozu-common:end */'));
});
