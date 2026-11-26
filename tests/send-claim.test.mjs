// 「送らない」の字と送る口の食い違い（tools/send-claim.mjs。check-site が読む。yorozu-plans D1017・Q-1212）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judge, sendPorts, claimsOf, groupEntries } from '../tools/send-claim.mjs';

const ORIGIN = 'https://yorozu-craft.com';
const PING = "const PING = 'https://yorozu-ai.example.workers.dev/v1/ping'; navigator.sendBeacon(PING, new Blob(['x']));";

test('「送らない」の語: Q-1261 の測りの語と never leave', () => {
  assert.deepEqual(claimsOf('入力は端末の外に出ません。外部には送信されません。どこにも送信しません。'), ['外に出ません', '送信されません', '送信しません']);
  assert.deepEqual(claimsOf('Your inputs never leave this browser. It never leaves.'), ['never leave', 'never leaves']);
  assert.deepEqual(claimsOf('結果は端末に保存します'), []);
});

test('計測の口（/v1/ping への sendBeacon）は送る口に数えない', () => {
  assert.deepEqual(sendPorts(PING, '', ORIGIN), []);
});

test('自分の data・辞書を読むだけの fetch（GET）は数えない。method・body つきは数える', () => {
  assert.deepEqual(sendPorts("fetch(new URL('data/rates.json', location.href)).then(r => r.json())", '', ORIGIN), []);
  assert.deepEqual(sendPorts("fetch('/post/api', { method: 'POST', headers: {} })", '', ORIGIN), ['fetch で送る（method・body）']);
  assert.deepEqual(sendPorts("fetch(u, { body: JSON.stringify(x) })", '', ORIGIN), ['fetch で送る（method・body）']);
});

test('Worker の口（workers.dev の道・/v1/…）の字と呼び出しが在れば数える。道の無いホストだけは数えない', () => {
  assert.deepEqual(sendPorts("const API = 'https://yorozu-ai.example.workers.dev/v1/listen'; fetch(API + '?q=' + v)", '', ORIGIN), ['Worker の口 yorozu-ai.example.workers.dev/v1/listen']);
  assert.deepEqual(sendPorts("const H = 'https://yorozu-ai.example.workers.dev'; fetch(H + p)", '', ORIGIN), []);
  assert.deepEqual(sendPorts("fetch('/v1/yasashii?t=' + t)", '', ORIGIN), ['Worker の口 /v1/yasashii']);
  assert.deepEqual(sendPorts("ws = new WebSocket(WS)", '', ORIGIN), ['WebSocket']);
});

test('form: method="dialog"・onsubmit="return false"・自分への get は数えない。post と外への action は数える', () => {
  assert.deepEqual(sendPorts('', '<form method="dialog" id="a"></form><form id="b" onsubmit="return false"></form><form action="./"></form>', ORIGIN), []);
  assert.deepEqual(sendPorts('', '<form method="post" action="/post/"></form>', ORIGIN), ['form post /post/']);
  assert.deepEqual(sendPorts('', '<form action="https://example.com/q"></form>', ORIGIN), ['form get https://example.com/q']);
  assert.deepEqual(sendPorts('', '<form action="https://yorozu-craft.com/all/"></form>', ORIGIN), []);
});

test('判定: 送る口が在り「送らない」と書き、サーバーの断りが無い時だけ落とす', () => {
  const code = PING + "fetch('https://yorozu-ai.example.workers.dev/v1/listen', { method: 'POST', body: b })";
  assert.equal(judge({ text: '入力は端末の外に出ません。', code, html: '', origin: ORIGIN }).bad, true);
  // Q-1261 の形: 声の入力はサーバーで文字にすると書いている
  assert.equal(judge({ text: '声の入力はサーバーで文字にします。保存しません。ほかの入力は端末の外に出ません。', code, html: '', origin: ORIGIN }).bad, false);
  // 送る口が計測だけ
  assert.equal(judge({ text: '入力は端末の外に出ません。', code: PING, html: '', origin: ORIGIN }).bad, false);
  // コメントの中の fetch は数えない
  assert.equal(judge({ text: '送信しません。', code: "// fetch(u, { method: 'POST' })\n/* new WebSocket(x) */", html: '', origin: ORIGIN }).bad, false);
  // 「送らない」と書いていない
  const r = judge({ text: 'AI に聞く', code, html: '', origin: ORIGIN });
  assert.equal(r.bad, false);
  assert.ok(r.ports.length > 0);
});

test('群の入口: /<群>/ が断りなしに「送らない」と書き、同じ群のページが送る口を持つ時', () => {
  const pages = new Map([
    ['/otasuke/', { claims: ['外に出ません'], ports: [], disclose: false }],
    ['/otasuke/yasashii/', { claims: [], ports: ['Worker の口 /v1/yasashii'], disclose: true }],
    ['/gengo/', { claims: ['送信しません'], ports: [], disclose: false }],
    ['/gengo/kaiki/', { claims: ['送信しません'], ports: [], disclose: false }],
    ['/seido-keisan/', { claims: ['外に出ません'], ports: [], disclose: true }],
    ['/seido-keisan/iryohi/', { claims: ['外に出ません'], ports: ['Worker の口 /v1/listen'], disclose: true }],
  ]);
  assert.deepEqual(groupEntries(pages), [{ entry: '/otasuke/', claims: ['外に出ません'], senders: ['/otasuke/yasashii/'] }]);
});
