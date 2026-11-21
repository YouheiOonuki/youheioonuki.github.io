// check-site の確認先（BASE）と計算の API の節（yorozu-plans D708・Q-927）の門:
// 確認先が手元のとき、本番の host（yorozu-craft.com・計算の API の Worker）への要求が 0。
// 要求は fetch を差し替えて数える。本番には出さない（外への要求は差し替えが 503 を返して止める）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = join(ROOT, 'tools', 'check-site.mjs');

// 差し替え: 127.0.0.1 は通し、ほかの host は数えて 503 を返す（/api/openapi.json だけは 200 の空の定義。Worker の突き合わせまで進ませる）
const PRELOAD = `
const real = globalThis.fetch;
const outside = [];
globalThis.fetch = async (input, init) => {
  const u = new URL(typeof input === 'string' ? input : input.url);
  if (u.hostname === '127.0.0.1') return real(input, init);
  outside.push(u.host + u.pathname);
  if (u.pathname === '/api/openapi.json') return new Response('{"openapi":"3.1.0","paths":{}}', { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response('', { status: 503, headers: { 'content-type': 'text/plain' } });
};
process.on('exit', () => process.stderr.write('OUTSIDE ' + JSON.stringify(outside) + '\\n'));
`;

function run(args, preload) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--import', pathToFileURL(preload).href, SCRIPT, ...args], { cwd: ROOT });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => {
      const m = err.match(/^OUTSIDE (.*)$/m);
      resolve({ code, out, err, outside: m ? JSON.parse(m[1]) : null });
    });
  });
}

function withPreload(fn) {
  return async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'check-site-base-'));
    const preload = join(tmp, 'count-fetch.mjs');
    writeFileSync(preload, PRELOAD);
    try { await fn(preload); } finally { rmSync(tmp, { recursive: true, force: true }); }
  };
}

test('確認先が手元のとき、本番の host への要求は 0 で、計算の API の節を飛ばしたとメモに 1 行出す', withPreload(async (preload) => {
  const server = createServer((req, res) => {
    if (req.url === '/robots.txt') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('User-agent: *\nAllow: /\n'); return; }
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html lang="ja"><head><title>t</title></head><body><main><h1>t</h1></main></body></html>'); return; }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const { out, outside } = await run([`http://127.0.0.1:${server.address().port}/`], preload);
    assert.ok(outside, '差し替えが動いていない');
    assert.deepEqual(outside, [], '手元を見る回に外へ出た要求: ' + outside.join(', '));
    const skipped = out.split('\n').filter((l) => l.startsWith('メモ  計算の API: Worker と突き合わせていない'));
    assert.equal(skipped.length, 1);
    assert.match(skipped[0], /本番でない。D708/);
    assert.doesNotMatch(out, /警告  \/api\/openapi\.json/);
    assert.doesNotMatch(out, /NG    \/api\/openapi\.json/);
  } finally { server.close(); }
}));

test('確認先が本番のとき、計算の API の節は前と同じく Worker と突き合わせる（要求は差し替えが止める）', withPreload(async (preload) => {
  const { out, outside } = await run(['https://yorozu-craft.com/'], preload);
  assert.ok(outside, '差し替えが動いていない');
  assert.ok(outside.includes('yorozu-craft.com/api/openapi.json'));
  assert.ok(outside.some((h) => h.startsWith('yorozu-api.oonuki-youhei.workers.dev/')), 'Worker を呼びに行っていない');
  assert.doesNotMatch(out, /D708/);
  assert.match(out, /警告  \/api\/openapi\.json: 本番の Worker と突き合わせられない/);
}));
