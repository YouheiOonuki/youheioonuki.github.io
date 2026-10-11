// トップの 1 画面目のクリックの計測（ROADMAP 7.57 の 4）: 1 画面目のリンクだけ、移った先と top1 だけを送る
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../top-click.js', import.meta.url), 'utf8');
function run(top) {
  const sent = [];
  let handler = null;
  const main = { addEventListener: (t, f) => { handler = f; } };
  const link = (href) => ({ getAttribute: () => href, getBoundingClientRect: () => ({ top }) });
  const ctx = {
    document: { getElementById: (id) => (id === 'main' ? main : null) },
    window: { scrollY: 0, innerHeight: 844 },
    navigator: { sendBeacon: (u, b) => { sent.push([u, b]); return true; } },
    Blob: class { constructor(parts) { this.text = parts.join(''); } },
    JSON,
  };
  vm.runInNewContext(src, ctx);
  return { click: (href) => handler({ target: { closest: () => link(href) } }), sent };
}

test('1 画面目のリンクは、移った先の場所と top1 だけを送る', () => {
  const r = run(300);
  r.click('./seido-keisan/nenmatsu/');
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0][0], 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/ping');
  assert.deepEqual(JSON.parse(r.sent[0][1].text), { page: '/seido-keisan/nenmatsu/', event: 'top1' });
});

test('1 画面目より下のリンクは送らない', () => {
  const r = run(900);
  r.click('./toban/');
  assert.equal(r.sent.length, 0);
});

test('top.js は今も通信をしない（計測は top-click.js に分けた）', () => {
  assert.doesNotMatch(readFileSync(new URL('../top.js', import.meta.url), 'utf8'), /sendBeacon|fetch\(/);
});
