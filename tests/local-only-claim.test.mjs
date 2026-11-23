// 入力をサーバーへ送る道具（やさしい日本語・困りごと検索・声の入力・投書箱）を並べるページと llms.txt に、
// 「入力は端末の外に出ない」と言い切る字を置かない（オーナーが /all/ で見つけた誤り。about の同じ 1 文は Q-1082 で消した）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('/all/ と llms.txt の生成元に、入力を端末の外に出さないと言い切る字が無い', () => {
  const all = read('all/index.html');
  assert.match(all, /<p class="lead">用途の節ごとに、すべてのページを並べています。<\/p>/);
  assert.match(all, /href="\.\.\/otasuke\/yasashii\/"/);
  const agent = read('tools/build-agent.mjs');
  for (const [f, s] of [['all/index.html', all], ['tools/build-agent.mjs', agent]]) {
    assert.doesNotMatch(s, /入力は端末の外に出ません|サーバーに送りません|入力は端末の中で計算し/, f);
  }
});
