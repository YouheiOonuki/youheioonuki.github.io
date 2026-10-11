// トップの「次の改定」（yorozu-plans ROADMAP 7.44.1 K141）: 読むのは /v1/now だけ、送るものは無い、読めなければ出さない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../top-next.js', import.meta.url), 'utf8');

function run(fetchImpl) {
  const el = { hidden: true, textContent: '', children: [], appendChild(c) { this.children.push(c); } };
  const document = { getElementById: (id) => (id === 'yt-next' ? el : null), createElement: () => ({}) };
  const calls = [];
  const window = { fetch: (u, o) => { calls.push([u, o]); return fetchImpl(u, o); }, AbortController };
  vm.runInNewContext(src, { window, document, fetch: window.fetch, setTimeout: () => 0, AbortController });
  return { el, calls };
}
const settle = () => new Promise((r) => setTimeout(r, 10));
const ok = (j) => () => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });

test('読めたら 1 行（月日と題、改定カレンダーへのリンク）。GET だけで本文を送らない', async () => {
  const { el, calls } = run(ok({ next: { date: '2026-12-01', items: [{ title: '基礎控除', url: 'https://yorozu-craft.com/seido-keisan/kaitei/#x' }] } }));
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://yorozu-api.oonuki-youhei.workers.dev/v1/now');
  assert.ok(!calls[0][1].method && !calls[0][1].body, '送るものは無い');
  assert.equal(el.hidden, false);
  assert.equal(el.textContent, '次の改定: 12月1日 ');
  assert.equal(el.children[0].href, 'https://yorozu-craft.com/seido-keisan/kaitei/#x');
});

test('読めない・形が違う・よそへのリンクなら出さない', async () => {
  for (const f of [() => Promise.reject(new Error('x')), () => Promise.resolve({ ok: false }), ok({ next: null }), ok({ next: { date: 'x', items: [{}] } }),
    ok({ next: { date: '2026-12-01', items: [{ title: 'a', url: 'https://evil.example/' }] } })]) {
    const { el } = run(f);
    await settle();
    assert.equal(el.hidden, true);
  }
});
