// 結果カード share-card.js（yorozu-plans ROADMAP K124・企画書 60）の正本 tools/common/share-card.js と写しの門（Q-464）:
// ファイルまるごとが正本の写しで、used.js と同じ道（sync-common.mjs の WHOLE の表）で --check が比べ、--write が置き換える。
// 写しの repo（tameshite・hoshizora-sanpo・quiz-hiroba・web-metronome）の作業コピーはここでは読まない（順は「正本が先」。Q-463）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WHOLE } from '../tools/sync-common.mjs';

const MASTER = readFileSync(new URL('../tools/common/share-card.js', import.meta.url), 'utf8');

test('WHOLE の表: まるごとの写しは used.js と share-card.js と reset-storage.js と share-stub.mjs と make-share-og.mjs と zip.js と reset-storage.test.js と screen.js で、どれも正本が tools/common に在る', () => {
  assert.deepEqual(WHOLE, ['used.js', 'share-card.js', 'reset-storage.js', 'share-stub.mjs', 'make-share-og.mjs', 'zip.js', 'reset-storage.test.js', 'screen.js']);
  for (const n of WHOLE) assert.ok(existsSync(new URL('../tools/common/' + n, import.meta.url)), n);
});

test('sync-common.mjs --check はフォルダの下の share-card.js も正本と比べ（改行の形は問わない）、--write が正本に戻す', () => {
  const d = mkdtempSync(join(tmpdir(), 'yz-share-'));
  try {
    const tool = fileURLToPath(new URL('../tools/sync-common.mjs', import.meta.url));
    const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' });
    writeFileSync(join(d, 'style.css'), '/* t */\n');
    assert.equal(run('--insert', d).status, 0);   // --check は印のある css が無いフォルダを「なし」で落とすので、正本の begin〜end を 1 つ置く
    writeFileSync(join(d, 'share-card.js'), MASTER.replace(/\n/g, '\r\n'));
    const ok = run('--check', d);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /同じ .*share-card\.js（share-card\.js）/);
    writeFileSync(join(d, 'share-card.js'), MASTER.replace('margin:12px 0', 'margin:13px 0'));
    const bad = run('--check', d);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /違う .*share-card\.js（share-card\.js が正本と違う）/);
    assert.equal(run('--write', d).status, 0);
    assert.equal(readFileSync(join(d, 'share-card.js'), 'utf8'), MASTER);
    assert.equal(run('--check', d).status, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
