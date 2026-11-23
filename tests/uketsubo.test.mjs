// Q-1219: 受け皿（/for/teachers/・/for/it/・/for/kaigo/・/en/）の字。別館の 2 行は pages.json の annex と合い、先生の「授業」から星座早見盤と天文カレンダーに届く。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const data = JSON.parse(read('data/pages.json'));
const row = (path) => data.pages.find((x) => x.path === path);

test('Q-1219: /for/it/ の「期限と停止」の別館 2 行は pages.json の annex の名前と一言（句点つき）で、h2「道具」の上にある。頭の文に「入力は送信しません」は無い', () => {
  const html = read('for/it/index.html');
  const annex = data.sections.find((s) => s.id === 'it').annex;
  assert.equal(annex.length, 2);
  const h = html.indexOf('<h2 id="kigen">期限と停止</h2>');
  assert.ok(h > 0 && h < html.indexOf('<h2 id="tools">道具</h2>'));
  let at = h;
  for (const a of annex) {
    const li = `<li><a class="go" href="${a.href}"><strong>${a.name}</strong><span>${a.note}。</span></a></li>`;
    const i = html.indexOf(li);
    assert.ok(i > at, `${a.name} の行が順に在る`);
    at = i;
  }
  assert.ok(!html.includes('入力は送信しません'));
});

test('Q-1219: /for/teachers/ の「授業」の末尾に星座早見盤と天文カレンダー。リンク先が在り、名前と一言は pages.json の字', () => {
  const html = read('for/teachers/index.html');
  const sec = html.slice(html.indexOf('<h3 id="jugyo">授業</h3>'), html.indexOf('<h3 id="tanoshimi">'));
  const lis = sec.match(/<li>.*<\/li>/g);
  assert.equal(lis.length, 5);
  for (const [i, path] of [[3, '/hoshizora-sanpo/hayamiban/'], [4, '/hoshizora-sanpo/calendar/']]) {
    const r = row(path);
    assert.equal(lis[i], `<li><a class="go" href="../..${path}"><strong>${r.name}</strong><span>${r.note}。</span></a></li>`);
    assert.ok(r, path);
  }
  assert.ok(!html.includes('登録なしで、印刷の手順つき'));
});

test('Q-1219: /for/kaigo/ の description と /en/ の description・og:description から断りの句を消した', () => {
  assert.ok(!read('for/kaigo/index.html').includes('広告なし・登録なし、'));
  const en = read('en/index.html');
  assert.equal(en.split('Made by one person. No sign-up.').length - 1, 0);
  assert.equal(en.split('IT admin tools (PAC file tester, ADSearch, FILETIME converter). Made by one person.">').length - 1, 2);
});
