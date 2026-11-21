// 画面の部品 screen.js（yorozu-plans docs/SCREEN.md）の正本 tools/common/screen.js（D667・D668。Q-855・Q-878）:
// 道具の repo に在った tests/screen.test.js（18 本）の試しは、ここに 1 本。
// sync-common.mjs の WHOLE の表にはまだ入れない（写しを持つ repo の全部が正本と同じになった後に足す。D682）。
// 道具の repo の作業コピーはここでは読まない（順は「正本が先」。Q-463）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
