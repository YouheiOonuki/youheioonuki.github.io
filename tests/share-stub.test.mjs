// 共有される結果の着地ページと OG 画像の道具 share-stub.mjs・make-share-og.mjs（yorozu-plans K124・D667・Q-867）の正本 tools/common/ と写しの門:
// ファイルまるごとが正本の写しで、share-card.js と同じ道（sync-common.mjs の WHOLE の表）で --check が比べ、--write が置き換える。
// 写しは各 repo の tools/ の下に在るので、フォルダの下の tools/ の同じ名前のファイルも見ることを確かめる。
// 写しの repo（hoshizora-sanpo・quiz-hiroba・tameshite・web-metronome）の作業コピーはここでは読まない（順は「正本が先」。Q-463）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NAMES = ['share-stub.mjs', 'make-share-og.mjs'];
const master = (n) => readFileSync(new URL('../tools/common/' + n, import.meta.url), 'utf8');

test('正本は、写しを手で直さないことと正本の在り処を頭に書き、「直したら全部に写す」を持たない', () => {
  for (const n of NAMES) {
    const s = master(n);
    assert.ok(s.includes(`正本は youheioonuki.github.io の tools/common/${n}`), n);
    assert.ok(!s.includes('直したら全部に写す'), n);
  }
});

test('sync-common.mjs --check はフォルダの下の tools/ の share-stub.mjs・make-share-og.mjs も正本と比べ（改行の形は問わない）、--write が正本に戻す', () => {
  const d = mkdtempSync(join(tmpdir(), 'yz-stub-'));
  try {
    const tool = fileURLToPath(new URL('../tools/sync-common.mjs', import.meta.url));
    const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' });
    writeFileSync(join(d, 'style.css'), '/* t */\n');
    assert.equal(run('--insert', d).status, 0);   // --check は印のある css が無いフォルダを「なし」で落とすので、正本の begin〜end を 1 つ置く
    mkdirSync(join(d, 'tools'));
    for (const n of NAMES) writeFileSync(join(d, 'tools', n), master(n).replace(/\n/g, '\r\n'));
    const ok = run('--check', d);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    for (const n of NAMES) assert.match(ok.stdout, new RegExp(`同じ .*tools.${n.replace('.', '\\.')}（${n.replace('.', '\\.')}）`));
    writeFileSync(join(d, 'tools', 'share-stub.mjs'), master('share-stub.mjs').replace("lang || 'ja'", "lang || 'en'"));
    const bad = run('--check', d);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /違う .*tools.share-stub\.mjs（share-stub\.mjs が正本と違う）/);
    assert.equal(run('--write', d).status, 0);
    assert.equal(readFileSync(join(d, 'tools', 'share-stub.mjs'), 'utf8'), master('share-stub.mjs'));
    assert.equal(run('--check', d).status, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
