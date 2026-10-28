// 404.html の生成（tools/build-404.mjs、yorozu-plans ROADMAP 7.134 (2)）の門: 値は皮から写す、v1 の色が無い、check-site が見る題とビーコン、文は見出しとリンクだけ、本体の 404.html が生成物
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokens, render, manifestHref } from '../tools/build-404.mjs';

const t = tokens();
const html = render({ t });

test('色は皮の明暗の値をそのまま持つ', () => {
  for (const k of ['--bg', '--text', '--accent', '--on-accent']) {
    assert.ok(html.includes(`${k}: ${t.light[k]};`), `明るい ${k}`);
    assert.ok(html.includes(`${k}: ${t.dark[k]};`), `暗い ${k}`);
  }
  assert.notEqual(t.light['--bg'], t.dark['--bg']);
});

test('v1 の和紙の色を持たない', () => {
  for (const v1 of ['#f0ebe0', '#3a3025', '#8b4513', '#7a6b5a', '#faf6ee']) assert.ok(!html.toLowerCase().includes(v1), v1);
});

test('check-site が見る題・noindex・ビーコン、トップへの絶対パスのリンク 1 つ', () => {
  assert.match(html, /<title>ページが見つかりません｜yorozu-craft<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.ok(html.includes('b79bf821e1fd4b6683866d493b1de426'));
  assert.deepEqual([...html.matchAll(/<a /g)].length, 1);
  assert.match(html, /<a href="\/">/);
  assert.ok(!html.includes('adsbygoogle'));
});

test('画面の文は見出しとリンクだけ（説明文なし）', () => {
  const body = html.slice(html.indexOf('<body>'), html.indexOf('</main>')).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  assert.equal(body, 'ページが見つかりませんyorozu-craftトップへ');
});

test('manifest: 本体は直下、道具は自分の manifest があればそれ', () => {
  assert.equal(manifestHref(fileURLToPath(new URL('..', import.meta.url))), '/manifest.webmanifest');
  assert.ok(render({ manifest: '/x/manifest.webmanifest', t }).includes('<link rel="manifest" href="/x/manifest.webmanifest">'));
});

test('本体の 404.html は生成物と同じ', () => {
  const have = readFileSync(new URL('../404.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(have, html);
});
