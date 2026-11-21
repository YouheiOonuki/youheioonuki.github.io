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

// メールの記録（yorozu-plans Q-802、D624）: Cloudflare Email Routing は差出人・宛先・件名・Message-ID を約 31 日残すので、
// 「転送するだけで保存しません」と言い切らず、7.8 と 7.10 に記録の 4 つと期間を書く。
test('privacy-policy の 7.8・7.10 に、メールを保存しないと言い切る文が無く、記録の 4 つと期間が在る', () => {
  const ja = read('privacy-policy.html');
  assert.ok(!ja.includes('転送するだけで保存しません'), 'privacy-policy.html に「転送するだけで保存しません」');
  assert.equal(ja.split('差出人・宛先・件名・Message-ID').length - 1, 2, 'privacy-policy.html の 7.8・7.10 に記録の 4 つ');
  assert.ok(ja.includes('約 31 日'), 'privacy-policy.html に期間');
  const en = read('en/privacy-policy.html');
  assert.ok(!en.includes('does not store it'), 'en/privacy-policy.html に「does not store it」');
  assert.ok(en.includes('(sender, recipient, subject and Message-ID) for about 31 days'), 'en 7.8');
  assert.ok(en.includes('keeps the sender, recipient, subject and Message-ID for about 31 days'), 'en 7.10');
});
