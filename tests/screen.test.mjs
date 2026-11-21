// 画面の部品 screen.js（yorozu-plans docs/SCREEN.md）の正本 tools/common/screen.js（D667・D668。Q-855・Q-878）:
// 道具の repo に在った tests/screen.test.js（18 本）の試しは、ここに 1 本。
// ファイルまるごとが正本の写しで、used.js と同じ道（sync-common.mjs の WHOLE の表）で --check が比べ、--write が置き換える。
// 道具の repo の作業コピーはここでは読まない（順は「正本が先」。Q-463）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const MASTER = readFileSync(new URL('../tools/common/screen.js', import.meta.url), 'utf8');

// 固定バーの見本。height はバーの実の高さ（下の線を含む）で、隠れている間の offsetHeight は 0（display: none と同じ）
function setup(height) {
  const seen = [];   // バーが描かれる形で見えたとき（visibility が hidden でない間に hidden が false になったとき）の字
  const textEl = { textContent: '' };
  const bar = {
    _hidden: true,
    style: { visibility: '' },
    get hidden() { return this._hidden; },
    set hidden(v) { this._hidden = v; if (!v && this.style.visibility !== 'hidden') seen.push(textEl.textContent); },
    get offsetHeight() { return this._hidden ? 0 : height; },
    setAttribute() {},
    addEventListener() {},
  };
  const els = { fixbar: bar, print: {}, 'fixbar-text': textEl };
  let observe, options;
  const timers = [];
  const win = {
    IntersectionObserver: function (cb, o) { observe = cb; options = o; this.observe = function () {}; },
  };
  win.window = win;
  win.document = { getElementById: (id) => els[id] };
  win.setTimeout = (fn) => { timers.push(fn); };
  vm.runInNewContext(MASTER, win);
  const fb = win.YorozuScreen.fixedBar({ bar: 'fixbar', watch: 'print', text: 'fixbar-text', onClick() {} });
  return { fb, bar, textEl, seen, options: () => options, scrollOut: () => observe([{ isIntersecting: false }]), flush: () => { while (timers.length) timers.shift()(); } };
}

test('バーは字を入れてから見せる（見えている間ボタンの字が空にならない。Q-727）', () => {
  const s = setup(44);
  s.fb.set('印刷する（2026年度の学年早見表）');
  s.scrollOut();
  assert.equal(s.bar.hidden, false);
  assert.deepEqual(s.seen, ['印刷する（2026年度の学年早見表）']);
  assert.equal(s.textEl.textContent, '印刷する（2026年度の学年早見表）');
  s.flush();
  assert.equal(s.textEl.textContent, '印刷する（2026年度の学年早見表）');
});

for (const h of [44, 45]) {
  test(`見張りの上の余白はバーの実の高さ（${h}px）を画面から読む。測る間も見えず、測った後は隠れたまま`, () => {
    const s = setup(h);
    assert.equal(s.options().rootMargin, `-${h}px 0px 0px 0px`);
    assert.deepEqual(s.seen, []);
    assert.equal(s.bar.hidden, true);
    assert.equal(s.bar.style.visibility, '');
  });
}

test('正本は高さの数を持たない（高さは style.css だけ。BAR_H の定数をやめた。D667）', () => {
  assert.doesNotMatch(MASTER, /BAR_H/);
  assert.doesNotMatch(MASTER, /rootMargin: '-\d/);
});

test('sync-common.mjs --check はフォルダの下の screen.js も正本と比べ（改行の形は問わない）、1 文字違えば落ち、--write が正本に戻す', () => {
  const d = mkdtempSync(join(tmpdir(), 'yz-screen-'));
  try {
    const tool = fileURLToPath(new URL('../tools/sync-common.mjs', import.meta.url));
    const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' });
    writeFileSync(join(d, 'style.css'), '/* t */\n');
    assert.equal(run('--insert', d).status, 0);   // --check は印のある css が無いフォルダを「なし」で落とすので、正本の begin〜end を 1 つ置く
    writeFileSync(join(d, 'screen.js'), MASTER.replace(/\n/g, '\r\n'));
    const ok = run('--check', d);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /同じ .*screen\.js（screen\.js）/);
    const i = MASTER.indexOf('offsetHeight');
    writeFileSync(join(d, 'screen.js'), MASTER.slice(0, i) + 'O' + MASTER.slice(i + 1));   // 1 文字だけ変える
    const bad = run('--check', d);
    assert.notEqual(bad.status, 0);
    assert.match(bad.stdout, /違う .*screen\.js（screen\.js が正本と違う）/);
    assert.equal(run('--write', d).status, 0);
    assert.equal(readFileSync(join(d, 'screen.js'), 'utf8'), MASTER);
    assert.equal(run('--check', d).status, 0);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
