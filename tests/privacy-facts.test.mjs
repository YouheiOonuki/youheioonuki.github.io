// 運営者情報とプライバシーポリシーの「送らない」の言い切り（yorozu-plans Q-773、D589・D595）:
// サーバーに送る道具（7 章）が在るので、「すべてブラウザの中」「サーバーに送ることはありません」と全体を言い切らない。
// about の文は 7 章（#third-party）へリンクし、その id が privacy-policy に在る。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const JA = ['about.html', 'privacy-policy.html'];
const EN = ['en/about.html', 'en/privacy-policy.html'];

test('日本語の about と privacy-policy に、全体を言い切る文が無い', () => {
  for (const p of JA) {
    const s = read(p);
    for (const bad of ['運営者のサーバーに送ることはありません', 'すべてユーザーのブラウザの中で', 'ブラウザの中にだけあり、外部に送信されることはありません']) {
      assert.ok(!s.includes(bad), `${p} に「${bad}」`);
    }
  }
});

test('英語の about と privacy-policy に、全体を言い切る文が無い', () => {
  for (const p of EN) {
    const s = read(p);
    for (const bad of ['The operator never receives it', 'Every tool does its calculations and processing inside your browser', 'is never sent anywhere']) {
      assert.ok(!s.includes(bad), `${p} に「${bad}」`);
    }
  }
});

test('about の文は privacy-policy の 7 章へリンクし、7 章の見出しにその id が在る', () => {
  for (const [about, policy] of [['about.html', 'privacy-policy.html'], ['en/about.html', 'en/privacy-policy.html']]) {
    assert.match(read(about), /<a href="\.\/privacy-policy\.html#third-party">/, about);
    assert.match(read(policy), /<h2 id="third-party">7\. /, policy);
  }
});
