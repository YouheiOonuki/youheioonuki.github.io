// 印刷物のセットの手元の配り口（tools/print-set）。配るのは 3 つのリポジトリの中だけ、../ で外へ出ない、127.0.0.1 だけで待つ（K191 段 2）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { servePath, SERVE } from '../tools/print-set/serve-path.mjs';

const P = path.resolve('/projects');

test('使う 3 つのリポジトリの中は配る（/ で終われば index.html）', () => {
  assert.deepEqual(SERVE, ['otasuke', 'bingo', 'henkan']);
  assert.equal(servePath(P, '/otasuke/notore/'), path.join(P, 'otasuke', 'notore', 'index.html'));
  assert.equal(servePath(P, '/bingo/cards.html?x=1'), path.join(P, 'bingo', 'cards.html'));
  assert.equal(servePath(P, '/henkan/vendor/pdf-lib/pdf-lib.min.js'), path.join(P, 'henkan', 'vendor', 'pdf-lib', 'pdf-lib.min.js'));
});

test('ほかのリポジトリ・../ で外へ・壊れた % は配らない', () => {
  for (const u of [
    '/fitbit-obsidian/state/fitbit_token.json',
    '/ad-patch-healthcheck/README.md',
    '/',
    '/..%2f..%2fUsers/x/.ssh/id_ed25519',
    '/otasuke/../fitbit-obsidian/state/x.json',
    '/otasuke/..%2f..%2fx',
    '/otasuke/%2e%2e/bingo/../../x',
    '/otasuke/%E0%A4%A',
  ]) assert.equal(servePath(P, u), null, u);
});

test('build.mjs は 127.0.0.1 だけで待ち、Host を確かめ、servePath を通す', () => {
  const src = readFileSync(new URL('../tools/print-set/build.mjs', import.meta.url), 'utf8');
  assert.match(src, /\.listen\(PORT, '127\.0\.0\.1'\)/);
  assert.match(src, /HOSTS\.includes\(q\.headers\.host\) \? servePath\(PROJECTS, q\.url\)/);
  assert.doesNotMatch(src, /path\.join\(PROJECTS, p\)/);
});
