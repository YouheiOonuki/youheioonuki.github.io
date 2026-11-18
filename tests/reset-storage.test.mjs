// 保存した内容をすべて消す reset-storage.js（yorozu-plans ROADMAP K123）の正本 tools/common/reset-storage.js と写しの門（Q-506）:
// ファイルまるごとが正本の写しで、share-card.js と同じ道（sync-common.mjs の WHOLE の表）で --check が比べ、--write が置き換える。
// 写しは root の reset-storage.js と道具の repo の 27 本。道具の repo の作業コピーはここでは読まない（順は「正本が先」。Q-463）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MASTER = readFileSync(new URL('../tools/common/reset-storage.js', import.meta.url), 'utf8');

test('root の reset-storage.js は正本 tools/common/reset-storage.js と同じ', () => {
  assert.equal(readFileSync(new URL('../reset-storage.js', import.meta.url), 'utf8'), MASTER);
});

test('sync-common.mjs --check はフォルダの下の reset-storage.js も正本と比べ（改行の形は問わない）、1 文字違えば落ち、--write が正本に戻す', () => {
  const d = mkdtempSync(join(tmpdir(), 'yz-reset-'));
  try {
    const tool = fileURLToPath(new URL('../tools/sync-common.mjs', import.meta.url));
    const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' });
    writeFileSync(join(d, 'style.css'), '/* t */\n');
    assert.equal(run('--insert', d).status, 0);   // --check は印のある css が無いフォルダを「なし」で落とすので、正本の begin〜end を 1 つ置く
    writeFileSync(join(d, 'reset-storage.js'), MASTER.replace(/\n/g, '\r\n'));
    const ok = run('--check', d);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /同じ .*reset-storage\.js（reset-storage\.js）/);
    const i = MASTER.indexOf('localStorage');
    writeFileSync(join(d, 'reset-storage.js'), MASTER.slice(0, i) + 'L' + MASTER.slice(i + 1));   // 1 文字だけ変える
    const bad = run('--check', d);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stdout, /違う .*reset-storage\.js（reset-storage\.js が正本と違う）/);
    assert.equal(run('--write', d).status, 0);
    assert.equal(readFileSync(join(d, 'reset-storage.js'), 'utf8'), MASTER);
    assert.equal(run('--check', d).status, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
