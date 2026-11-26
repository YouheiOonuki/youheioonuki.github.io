// tools/common/backup.test.js（バックアップファイルのテストの本体。D31・7.271）を、作り物の repo で走らせて確かめる。
// 各 repo には WHOLE の表で写しが配られ、repo の値は tests/backup.values.json だけが持つ。
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const CORE = fileURLToPath(new URL('../tools/common/backup.test.js', import.meta.url));

// 外の node --test の中から呼ぶと、子は run() の入れ子として走らず、報告も出さない。印の環境変数を消して、独りで走らせる
const CHILD_ENV = { ...process.env };
delete CHILD_ENV.NODE_TEST_CONTEXT;

// テンプレートの calc.js と同じ形の実装。errors が code なら理由の名前を返す
const impl = (byCode, { version = 1 } = {}) => `
const pad = (n) => String(n).padStart(2, '0');
function backupFileName(tool, d) { return tool + '-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json'; }
function buildBackup(tool, data, now) { return { tool, version: ${version}, exportedAt: (now || new Date()).toISOString(), data }; }
function no(code, error, extra) { return Object.assign({ ok: false }, ${byCode} ? { code } : { error }, extra); }
function parseBackup(text, tool, required) {
  let o; try { o = JSON.parse(text); } catch { o = null; }
  if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.tool !== 'string') return no('unreadable', 'ファイルを読み取れませんでした');
  if (o.tool !== tool) return no('otherTool', 'ほかのツール（' + o.tool + '）のファイルです', { tool: o.tool });
  if (o.version !== 1) return no(typeof o.version === 'number' && o.version > 1 ? 'newer' : 'format', typeof o.version === 'number' && o.version > 1 ? '新しい版のファイルです' : '形が違います');
  if (!o.data || typeof o.data !== 'object' || Array.isArray(o.data)) return no('format', '形が違います');
  if ((required || []).some((k) => !(k in o.data))) return no('missing', '中身が欠けています');
  return { ok: true, data: o.data };
}
module.exports = { backupFileName, buildBackup, parseBackup };
`;

// 作り物の repo を作り、本体を走らせて、失敗の数を返す
function run(lib, values, dir = 'tests') {
  const d = mkdtempSync(join(tmpdir(), 'yz-backup-'));
  try {
    mkdirSync(join(d, dir));
    copyFileSync(CORE, join(d, dir, 'backup.test.js'));
    writeFileSync(join(d, dir, 'backup.values.json'), JSON.stringify(values));
    writeFileSync(join(d, 'calc.js'), lib);
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(d, dir, 'backup.test.js')], { encoding: 'utf8', env: CHILD_ENV });
    return Number((r.stdout.match(/^# fail (\d+)/m) || [])[1]);
  } finally { rmSync(d, { recursive: true, force: true }); }
}

const VALUES = { module: 'calc.js', tool: 'demo', data: { draft: { a: 1 }, list: [] }, required: ['draft'] };

test('画面の文で断る実装は通る（tests/ でも test/ でも）', () => {
  assert.equal(run(impl(false), VALUES), 0);
  assert.equal(run(impl(false), VALUES, 'test'), 0);
});

test('理由の名前で断る実装は errors: "code" で通り、既定（message）では落ちる', () => {
  assert.equal(run(impl(true), { ...VALUES, errors: 'code' }), 0);
  assert.ok(run(impl(true), VALUES) > 0);
});

test('書き出す版が 1 でなければ落ちる', () => {
  assert.ok(run(impl(false, { version: 2 }), VALUES) > 0);
});

test('required が data に無い名前なら落ちる', () => {
  assert.ok(run(impl(false), { ...VALUES, required: ['nope'] }) > 0);
});

test('値のファイルに知らない名前が在れば落ちる', () => {
  assert.ok(run(impl(false), { ...VALUES, expect: {} }) > 0);
});
