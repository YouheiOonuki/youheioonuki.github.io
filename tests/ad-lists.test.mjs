// 子どもの画面の集合と、広告の script を置かない集合を分ける（yorozu-plans D882・Q-1119）。約束（META_ONLY）と待ち（REVIEW_HOLD）を分ける（D898・Q-1137）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { META_ONLY_PAGES, CHILD_SCREEN_PAGES, REVIEW_HOLD_PAGES, isMetaOnly, hasAdScript } from '../tools/ad-lists.mjs';

const REVIEW_16 = [
  '/sekigae/', '/shaho-check/', '/gakushu-print/', '/toban/en/',
  '/seido-keisan/en/childcare-leave/', '/seido-keisan/en/moving-checklist/', '/seido-keisan/en/pension-refund/', '/seido-keisan/en/residence-tax/', '/seido-keisan/en/take-home-pay/',
  '/hoshizora-sanpo/shinwa/', '/hoshizora-sanpo/shinwa/keizu.html', '/hoshizora-sanpo/shinwa/hyoki.html',
  '/hoshizora-sanpo/calendar/new-moon.html', '/hoshizora-sanpo/en/calendar/new-moon.html',
  '/web-roulette/odai/', '/tameshite/kioku/guide.html',
];

test('審査員の目で外した 16 枚は待ちの集合（REVIEW_HOLD）に在り、約束の集合と子どもの画面の集合には無い。script は置かないまま', () => {
  for (const p of REVIEW_16) {
    assert.ok(REVIEW_HOLD_PAGES.has(p), p);
    assert.ok(!isMetaOnly(p), p);
    assert.ok(!CHILD_SCREEN_PAGES.has(p), p);
    assert.equal(hasAdScript(p), false, p);
  }
});

test('子どもの画面の集合は Q-1137 の前と同じ 39 枚（16 枚を待ちへ移しても変わらない）', () => {
  assert.equal(CHILD_SCREEN_PAGES.size, 39);
  assert.deepEqual([...CHILD_SCREEN_PAGES].sort(), [...META_ONLY_PAGES].filter((p) => !p.endsWith('guide.html')).sort());
  for (const p of ['/hoshizora-sanpo/', '/easy-split/quick/', '/quiz-hiroba/showa/', '/for/kaigo/', '/updates/']) assert.ok(CHILD_SCREEN_PAGES.has(p), p);
});

test('約束の集合と待ちの集合は重ならない', () => {
  for (const p of META_ONLY_PAGES) assert.ok(!REVIEW_HOLD_PAGES.has(p), p);
});

test('子どもの画面は全部、広告の script を置かない集合の中。使い方ページを含まない', () => {
  assert.ok(CHILD_SCREEN_PAGES.size > 0);
  for (const p of CHILD_SCREEN_PAGES) {
    assert.ok(META_ONLY_PAGES.has(p), p);
    assert.ok(!p.endsWith('guide.html'), p);
  }
  for (const p of ['/todofuken-quiz/', '/quiz-hiroba/kokki/', '/gakushu-print/kuku/', '/unplugged/try.html']) assert.ok(CHILD_SCREEN_PAGES.has(p), p);
});

test('check-site の外部リンクの検査は CHILD_SCREEN_PAGES に掛かる（META_ONLY_PAGES には掛けない）', () => {
  const src = readFileSync(new URL('../tools/check-site.mjs', import.meta.url), 'utf8');
  const i = src.indexOf('CHILD_NG_LINK.test(h)');
  const head = src.slice(src.lastIndexOf('if (', i), i);
  assert.match(head, /CHILD_SCREEN_PAGES\.has\(p\)/);
  assert.ok(!/META_ONLY_PAGES\.has\(p\)/.test(head));
});
