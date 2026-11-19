// sync-common.mjs --check の枠（begin〜end）の比較は、改行の形を問わず中身で比べる（QUEUE Q-595、条件 32）。
// CRLF の作業コピー（gakushu-print・md-viewer・hoshizora-sanpo）で中身が同じ枠は OK、1 字違う枠は今までどおり NG
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { master } from '../tools/sync-common.mjs';

const tool = fileURLToPath(new URL('../tools/sync-common.mjs', import.meta.url));
const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' });
const crlf = (t) => t.replace(/\r?\n/g, '\r\n');

function withCss(text, fn) {
  const d = mkdtempSync(join(tmpdir(), 'yz-frame-'));
  try { writeFileSync(join(d, 'style.css'), text); return fn(d); } finally { rmSync(d, { recursive: true, force: true }); }
}

test('--check: CRLF の作業コピーで中身が正本と同じ枠は OK（--status も済）', () => {
  withCss(crlf(`/* t */\n${master()}\n\n.x { color: red; }\n`), (d) => {
    const r = run('--check', d);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /^同じ /m);
    assert.equal(run('--status', d).status, 0);
  });
});

test('--check: 中身が 1 字違う枠は、CRLF でも LF でも NG。--write は LF の正本で置き換える（出す改行は変えない）', () => {
  const one = master().replace('yorozu-common:begin v2 —', 'yorozu-common:begin v2 -');
  assert.notEqual(one, master());
  for (const text of [`/* t */\n${one}\n`, crlf(`/* t */\n${one}\n`)]) {
    withCss(text, (d) => {
      const r = run('--check', d);
      assert.equal(r.status, 1);
      assert.match(r.stdout, /^違う /m);
      assert.equal(run('--status', d).status, 1);
      assert.equal(run('--write', d).status, 0);
      assert.ok(readFileSync(join(d, 'style.css'), 'utf8').includes(master()));
    });
  }
});
