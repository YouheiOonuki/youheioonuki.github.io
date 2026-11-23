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
  const WHO = { okane: '年末調整・申告・給付の書類を、自分で書く人に', gakko: '生徒と親と先生に。県や学校ごとの決まりで計算します', it: 'システムの開発・保守をする IT 部門の人に' };
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

// Q-1239: 学校の札の見える行に出席日数（答えの箱が指す先）。pin は学校でこの 1 件だけ。偏差値・内申点は priority のまま
test('Q-1239: 学校の札の頭の行は出席日数（pin）。PC の 5 行・スマホの 3 行の中に入り、pin は学校でこの 1 件だけ', () => {
  const c = card('gakko');
  const rows = [...c.matchAll(/<li( class="yt-mh")?><a href="([^"]*)"><span class="yt-cn">([^<]*)/g)].map((m) => ({ mh: !!m[1], href: m[2], name: m[3] }));
  assert.equal(rows.length, 5, 'PC は 5 行');
  assert.deepEqual(rows[0], { mh: false, href: './gakko-keisan/shusseki/', name: '出席日数・欠課時数' });
  assert.equal(rows.filter((r) => !r.mh).length, 3, 'スマホは 3 行');
  assert.ok(rows.filter((r) => !r.mh).some((r) => r.href === './gakko-keisan/shusseki/'));
  assert.deepEqual(data.pages.filter((p) => p.section === 'gakko' && p.pin).map((p) => p.path), ['/gakko-keisan/shusseki/']);
  const ans = c.match(/<a class="yt-ans" href="([^"]*)"/)[1];
  assert.ok(rows.some((r) => r.href === ans), '答えの箱の行き先が札の行に在る');
  for (const p of ['/gakko-keisan/naishin/', '/gakko-keisan/hensachi/']) assert.equal(data.pages.find((x) => x.path === p).pin, undefined, p + ' は pin にしない');
});
