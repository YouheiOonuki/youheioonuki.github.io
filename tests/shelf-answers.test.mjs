// Q-1228: トップの札に、誰の棚か 1 行と、実際に出る答え（お金と制度・学校に 1 つずつ）。情シスの 375 は 4 行。
// 答えの値は字で持つ（Q-1223・Q-1224 の例の値と同じ）。変える時は yorozu-plans の docs/MAINTENANCE.md の手順に従い、2 か所を揃える
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const html = read('index.html');
const data = JSON.parse(read('data/pages.json'));

const card = (id) => {
  const m = html.match(new RegExp(`<section class="yt-card[^"]*" id="${id}"[\\s\\S]*?</section>`));
  assert.ok(m, `札 ${id}`);
  return m[0];
};
const IDS = ['okane', 'gakko', 'it', 'kazoku', 'atsumari', 'hoshi', 'oto'];

test('Q-1228: 誰の棚か 1 行は、お金と制度・学校・情シス・PC の札だけ。名前の見出しの直後', () => {
  const WHO = { okane: '年末調整・申告・給付の書類を、自分で書く人に', gakko: '生徒と親と先生に。県や学校ごとの決まりで計算します', it: '一人情シスと、AD を触る人に' };
  for (const id of IDS) {
    const c = card(id);
    const n = (c.match(/class="yt-who"/g) || []).length;
    if (WHO[id]) {
      assert.equal(n, 1, id);
      assert.match(c, new RegExp(`</h2>\\n        <p class="yt-who">${WHO[id]}</p>`), id);
    } else assert.equal(n, 0, `${id} に足さない`);
  }
});

test('Q-1228: 答えの箱は お金と制度・学校に 1 つずつ。入力の例・結果・リンク先が字で入っている。情シス（別館の JS は別の行）・ほかの札には無い', () => {
  const ANS = {
    okane: ['./seido-keisan/juminzei/', '給与 300 万円・社会保険料 45 万円', '令和 9 年度の住民税 年 116,500 円', '自分の数字で計算する'],
    gakko: ['./gakko-keisan/shusseki/', '授業 70 回・出席は 3 分の 2 以上・10 回休んだ', 'あと 13 回休める', '自分の科目で計算する'],
  };
  for (const id of IDS) {
    const c = card(id);
    const n = (c.match(/class="yt-ans"/g) || []).length;
    if (ANS[id]) {
      const [h, i, o, g] = ANS[id];
      assert.equal(n, 1, id);
      assert.ok(c.includes(`<a class="yt-ans" href="${h}"><span class="yt-ai">${i}</span><span class="yt-ao">${o}</span><span class="yt-ag">${g}</span></a>`), id);
      assert.ok(c.indexOf('class="yt-ans"') < c.indexOf('class="yt-cbody"'), '箱は行の一覧の上');
    } else assert.equal(n, 0, id);
  }
});

test('Q-1228: 答えの箱のリンク先は pages.json に在るページで、その節のもの', () => {
  for (const s of data.sections.filter((x) => x.ans)) for (const a of s.ans) {
    assert.ok(data.pages.some((p) => p.path === a.href && p.section === s.id), `${a.href}`);
  }
});

test('Q-1228: 375 で見える行は、情シス・PC だけ 4 行（別館 2 ＋ ADSearch ＋ PAC）。ほかは柱 3・その他 2 のまま', () => {
  const vis = (id) => (card(id).match(/<ul class="yt-crows">[\s\S]*?<\/ul>/)[0].match(/<li( class="yt-mh")?>/g) || []).filter((x) => x === '<li>').length;
  assert.equal(vis('it'), 4);
  const it = card('it');
  for (const name of ['ストップボード', 'エンドボード', 'ADSearch', 'PAC ファイル テスター']) {
    const m = it.match(new RegExp(`<li( class="yt-mh")?><a href="[^"]*"><span class="yt-cn">${name}</span>`));
    assert.ok(m && !m[1], `${name} は 375 で見える`);
  }
  for (const id of ['okane', 'gakko']) assert.equal(vis(id), 3, id);
  for (const id of ['kazoku', 'atsumari', 'hoshi', 'oto']) assert.equal(vis(id), 2, id);
  const cards = JSON.parse(html.match(/<script type="application\/json" id="yt-cards">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(cards.map((c) => [c.id, c.mob]), [['okane', 3], ['gakko', 3], ['it', 4], ['kazoku', 2], ['atsumari', 2], ['hoshi', 2], ['oto', 2]]);
});
