// 脚のリンク: lab の隣にストップボード（yorozu-plans ROADMAP 続き 51 の答え D813・Q-1045）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LAB = '<a href="https://lab.yorozu-craft.com/">lab（試作の別館）</a>';
const SB = '<a href="https://stopboard.yorozu-craft.com/">ストップボード（サービスの障害と予定）</a>';

function htmlFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

test('lab のリンクが在るページの数 ＝ ストップボードのリンクが在るページの数', () => {
  const files = htmlFiles(ROOT);
  const lab = files.filter((f) => readFileSync(f, 'utf8').includes(LAB));
  const sb = files.filter((f) => readFileSync(f, 'utf8').includes(SB));
  assert.ok(lab.length > 0);
  assert.deepEqual(sb.map((f) => relative(ROOT, f)), lab.map((f) => relative(ROOT, f)));
});

test('ストップボードのリンクは lab のリンクの次の行に、同じ形で', () => {
  for (const f of htmlFiles(ROOT)) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    const i = lines.findIndex((l) => l.includes(LAB));
    if (i < 0) continue;
    assert.equal(lines[i + 1], lines[i].replace(LAB, SB), relative(ROOT, f));
  }
});
