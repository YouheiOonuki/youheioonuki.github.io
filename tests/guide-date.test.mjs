// tools/common/guide-date.test.js（最終確認日の突き合わせのテストの本体。7.256 の 3・D668・7.271）を、作り物の repo で走らせて確かめる。
// 各 repo には WHOLE の表で写しが配られ、repo の値は tests/guide-date.values.json だけが持つ。
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const CORE = fileURLToPath(new URL('../tools/common/guide-date.test.js', import.meta.url));
const CONSTANTS = "(function (root) { var CHECKED = '2026-10-01'; var C = { CHECKED: CHECKED, LIB: { CHECKED: '2026-09-01' } };\n" +
  "  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.Constants = C; })(this);\n";
const DRAW = '<script>var K = window.Constants; var t = document.getElementById("checked"); var p = K.CHECKED.split("-").map(Number);' +
  ' t.dateTime = K.CHECKED; t.textContent = p[0] + "年" + p[1] + "月" + p[2] + "日";</script>';

// 外の node --test の中から呼ぶと、子は run() の入れ子として走らず、報告も出さない。印の環境変数を消して、独りで走らせる
const CHILD_ENV = { ...process.env };
delete CHILD_ENV.NODE_TEST_CONTEXT;

// 作り物の repo を作り、本体を走らせて、失敗の数を返す
function run(files, values) {
  const d = mkdtempSync(join(tmpdir(), 'yz-guide-date-'));
  try {
    mkdirSync(join(d, 'tests'));
    copyFileSync(CORE, join(d, 'tests', 'guide-date.test.js'));
    writeFileSync(join(d, 'tests', 'guide-date.values.json'), JSON.stringify(values));
    writeFileSync(join(d, 'constants.js'), CONSTANTS);
    for (const [p, s] of Object.entries(files)) { mkdirSync(join(d, p, '..'), { recursive: true }); writeFileSync(join(d, p), s); }
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(d, 'tests', 'guide-date.test.js')], { encoding: 'utf8', env: CHILD_ENV });
    return Number((r.stdout.match(/^# fail (\d+)/m) || [])[1]);
  } finally { rmSync(d, { recursive: true, force: true }); }
}

const HTML_OK = {
  'guide.html': '<p>最終確認日 <time datetime="2026-10-01">2026年10月1日</time>。</p><p>最終確認日は 2026 年 10 月 1 日です。</p>',
  'en/guide.html': '<p>Last checked <time datetime="2026-10-01">October 1, 2026</time>.</p><p>Last checked 2026-09-01.</p>',
  'drawn.html': '<script src="./constants.js"></script><p>最終確認日 <time datetime="" id="checked"></time></p>' + DRAW,
};
const VALUES = {
  html: { 'guide.html': 'constants.js#CHECKED', 'en/guide.html': ['constants.js#CHECKED', 'constants.js#LIB.CHECKED'] },
  drawn: { 'drawn.html': { src: './constants.js', values: 'constants.js', ids: ['checked'] } },
};

test('日付が元の値と合う repo は通る（html の 1 つの値・順の配列・drawn）', () => {
  assert.equal(run(HTML_OK, VALUES), 0);
});

test('HTML の日付が元の値と 1 日でも違えば落ちる', () => {
  assert.ok(run({ ...HTML_OK, 'guide.html': HTML_OK['guide.html'].replace('2026 年 10 月 1 日', '2026 年 10 月 2 日') }, VALUES) > 0);
});

test('datetime と表示が食い違えば落ちる', () => {
  assert.ok(run({ ...HTML_OK, 'guide.html': HTML_OK['guide.html'].replace('2026年10月1日', '2026年10月2日') }, VALUES) > 0);
});

test('日付を書いたページが値のファイルに無ければ落ちる（notTied に理由を書けば通る）', () => {
  const more = { ...HTML_OK, 'new.html': '<p>最終確認日 2026-10-01。</p>' };
  assert.ok(run(more, VALUES) > 0);
  assert.equal(run(more, { ...VALUES, notTied: { 'new.html': '値のファイルに相手が無い' } }), 0);
});

test('drawn のページに手で書いた日付が在れば落ちる', () => {
  const hand = HTML_OK['drawn.html'].replace('<time datetime="" id="checked"></time>', '<time datetime="2026-10-01" id="checked">2026年10月1日</time>');
  assert.ok(run({ ...HTML_OK, 'drawn.html': hand }, VALUES) > 0);
});

test('"#oldest:名前" は値の木の中のいちばん古い日付', () => {
  const page = { 'guide.html': '<p>最終確認日 2026-09-01。</p>' };
  assert.equal(run(page, { html: { 'guide.html': 'constants.js#oldest:CHECKED' } }), 0);
  assert.ok(run(page, { html: { 'guide.html': 'constants.js#CHECKED' } }) > 0);
});

test('値のファイルに知らない名前が在れば落ちる', () => {
  assert.ok(run(HTML_OK, { ...VALUES, expect: {} }) > 0);
});
