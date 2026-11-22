// sync-common.mjs --check の枠（begin〜end）の比較は、改行の形を問わず中身で比べる（QUEUE Q-595、条件 32）。
// CRLF の作業コピー（gakushu-print・md-viewer・hoshizora-sanpo）で中身が同じ枠は OK、1 字違う枠は今までどおり NG
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { master, swMaster, HONKAN, FRAMELESS, CALC } from '../tools/sync-common.mjs';

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

// --status: 本館の配信に乗らない repo は「枠の外」、乗るのに枠が無い repo は「未」（yorozu-plans D672・Q-870）。
// 乗る repo の名前は root の robots.txt の Sitemap 行（yorozu-plans の tools/deploy/sync.ps1 が読む表）から読む
function withRepo(name, fn) {
  const base = mkdtempSync(join(tmpdir(), 'yz-status-'));
  const d = join(base, name);
  try {
    mkdirSync(d);
    spawnSync('git', ['init', '-q'], { cwd: d });
    return fn(d);
  } finally { rmSync(base, { recursive: true, force: true }); }
}

test('--status: 本館に乗るのに枠が無い repo は「未」で、終了コード 1', () => {
  assert.ok(HONKAN.length > 0);
  withRepo(HONKAN[0], (d) => {
    const r = run('--status', d);
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /^未 /m);
    assert.match(r.stdout, /済 0・古い 0・枠の外 0・未 1/);
  });
});

test('--status: 本館に乗らない repo は「枠の外」で、未に数えない（終了コード 0）', () => {
  assert.ok(!HONKAN.includes('lab'));
  withRepo('lab', (d) => {
    const r = run('--status', d);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /^枠の外 /m);
    assert.doesNotMatch(r.stdout, /手で入れる/);
    assert.match(r.stdout, /済 0・古い 0・枠の外 1・未 0/);
  });
});

test('HONKAN は robots.txt の Sitemap 行、FRAMELESS は CALC の repo のうち HONKAN に無いもの（表を 2 つ持たない）', () => {
  const robots = readFileSync(new URL('../robots.txt', import.meta.url), 'utf8');
  assert.equal(HONKAN.length, (robots.match(/^Sitemap: https:\/\/yorozu-craft\.com\/[^/]+\/sitemap\.xml/gm) || []).length);
  assert.deepEqual(FRAMELESS, [...new Set(CALC.map((c) => c.repo))].filter((r) => !HONKAN.includes(r)));
  assert.deepEqual(FRAMELESS, ['infra-dashboard', 'yorozu-cron']);
});

// sw.js の枠（yorozu-plans D667・D684・Q-860）: 枠の中は取り方の正本 tools/common/sw-frame.js、名前と一覧は枠の外。css の正本とは別に比べる
function withSw(text, fn) {
  const d = mkdtempSync(join(tmpdir(), 'yz-sw-'));
  try { writeFileSync(join(d, 'sw.js'), text); writeFileSync(join(d, 'style.css'), `/* t */\n${master()}\n`); return fn(d); } finally { rmSync(d, { recursive: true, force: true }); }
}
const swText = (block) => `'use strict';\nconst CACHE_PREFIX = 'x-';\nconst CACHE_NAME = \`\${CACHE_PREFIX}v1\`;\nconst PRECACHE_URLS = ['./'];\n\n${block}\n`;

test('sw.js の枠: 中身が正本 sw-frame.js と同じなら OK（CRLF でも）', () => {
  assert.match(swMaster(), /^\/\* yorozu-common:begin sw /);
  assert.ok(swMaster().endsWith('\n}\n/* yorozu-common:end */'));
  for (const text of [swText(swMaster()), crlf(swText(swMaster()))]) {
    withSw(text, (d) => {
      const r = run('--check', d);
      assert.equal(r.status, 0, r.stdout);
      assert.match(r.stdout, /^同じ .*sw\.js（sw）/m);
    });
  }
});

test('sw.js の枠: 中が 1 字違えば NG。--write は枠の中だけを正本に戻し、枠の外（名前と一覧）は変えない', () => {
  const one = swMaster().replace('NETWORK_TIMEOUT_MS = 4000', 'NETWORK_TIMEOUT_MS = 4001');
  assert.notEqual(one, swMaster());
  withSw(swText(one), (d) => {
    const r = run('--check', d);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /^違う .*sw\.js/m);
    assert.equal(run('--write', d).status, 0);
    assert.equal(readFileSync(join(d, 'sw.js'), 'utf8'), swText(swMaster()));
  });
});

test('印の無い sw.js は見ない（枠を入れていない repo の --check は今までどおり）', () => {
  withSw(`'use strict';\nconst NETWORK_TIMEOUT_MS = 1;\n`, (d) => {
    const r = run('--check', d);
    assert.equal(r.status, 0, r.stdout);
    assert.doesNotMatch(r.stdout, /sw\.js/);
  });
});
