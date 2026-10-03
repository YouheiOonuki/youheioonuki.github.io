// トップの構成（yorozu-plans ROADMAP 7.23・ACCEPTANCE 3 章「束 A … トップの構成」）のテスト
// 使い方: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTop, loadPages, loadSeason, buildAll, stripSeason, searchRows, seasonData, sectionsJa, allRows, newest } from '../tools/build-top.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const YT = loadTop(ROOT);
const data = loadPages(ROOT);
const season = loadSeason(ROOT);

test('検索: pages.json の全行が、題名で候補（8 件まで）に出る', () => {
  const rows = searchRows(data, 'ja');
  assert.equal(rows.length, data.pages.length);
  for (const p of data.pages) {
    const got = YT.search(rows, p.title, 8).map((r) => r.p);
    assert.ok(got.includes(p.path), `${p.title} → ${p.path} が候補に無い: ${got.join(' ')}`);
    assert.equal(got[0], p.path, `${p.title} の先頭が ${got[0]}`);
    if (p.short) assert.ok(YT.search(rows, p.short, 8).some((r) => r.p === p.path), `short ${p.short}`);
  }
});

test('検索: 別名・カタカナとひらがな・全角半角で引ける', () => {
  const rows = searchRows(data, 'ja');
  const first = (q) => YT.search(rows, q, 8).map((r) => r.p);
  assert.ok(first('ルビ').includes('/furigana/'));
  assert.ok(first('席順').includes('/sekigae/'));
  assert.ok(first('106万円').includes('/shaho-check/'));
  assert.ok(first('１０６万円').includes('/shaho-check/'));
  assert.ok(first('扶養').includes('/shaho-check/'));
  assert.ok(first('フリガナ').includes('/furigana/'));
  assert.ok(first('年末調整').includes('/seido-keisan/nenmatsu/'));
  assert.ok(YT.search(rows, '年末調整', 8).length <= 8);
  assert.equal(YT.search(rows, 'zzzz存在しない語', 8).length, 0);
  assert.equal(YT.search(rows, '   ', 8).length, 0);
});

test('検索（英語）: 英語の全行が題名と別名で引ける', () => {
  const rows = searchRows(data, 'en');
  assert.equal(rows.length, data.en.pages.length);
  for (const p of data.en.pages) {
    assert.ok(YT.search(rows, p.title, 8).some((r) => r.p === p.path), p.title);
    for (const a of p.aliases || []) assert.ok(YT.search(rows, a, 8).some((r) => r.p === p.path), `${a} → ${p.path}`);
  }
});

test('検索は送信しない: top.js に通信が無く、ページに <form> が無い', () => {
  const js = read('top.js');
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|\.submit\(|new Image/);
  for (const f of ['index.html', 'en/index.html', 'all/index.html', 'for/teachers/index.html', 'for/kaigo/index.html', 'for/it/index.html']) {
    assert.doesNotMatch(read(f), /<form\b/i, f);
  }
});

test('いまの時期: 日付で月が切り替わる', () => {
  const sd = seasonData(data, season, 'ja');
  const oct = YT.seasonFor(sd, new Date(2026, 9, 3)).map((x) => x.path);
  assert.deepEqual([...oct], ['/seido-keisan/nenmatsu/', '/gakko-keisan/naishin/', '/seido-keisan/koko-mushoka/']);
  const jan = YT.seasonFor(sd, new Date(2027, 0, 1)).map((x) => x.path);
  assert.equal(jan[0], '/gengo/yakudoshi/');
  const nov30 = YT.seasonFor(sd, new Date(2026, 10, 30)).map((x) => x.path);
  const dec1 = YT.seasonFor(sd, new Date(2026, 11, 1)).map((x) => x.path);
  assert.notDeepEqual([...nov30], [...dec1]);
  assert.ok(dec1.includes('/bingo/'));
  for (let m = 0; m < 12; m++) assert.ok(YT.seasonFor(sd, new Date(2026, m, 15)).length >= 1, `${m + 1} 月が空`);
  // 静的な HTML も作った日の月で出る
  const html = buildAll(data, season, new Date(2027, 6, 10))['index.html'](read('index.html'));
  assert.match(html, /data-season-month="7"/);
  assert.match(html, /hayamiban/);
});

test('season.json: 各行のページが pages.json にあり、出典があり、各月 3 件まで（日英）', () => {
  for (const [lang, src, pages] of [['ja', season.months, data.pages], ['en', season.en, data.en.pages]]) {
    const have = new Set(pages.map((p) => p.path));
    assert.equal(Object.keys(src).length, 12, lang);
    for (const [m, list] of Object.entries(src)) {
      assert.ok(list.length <= 3, `${lang} ${m}`);
      for (const x of list) {
        assert.ok(have.has(x.path), `${lang} ${m} 月 ${x.path} が無い`);
        assert.ok(x.source && x.source.length > 3, `${lang} ${m} 月 ${x.path} の出典`);
        assert.ok(x.reason && !/[。.].+[。.]/.test(x.reason), `${lang} ${m} 月 ${x.path} の理由は 1 文`);
      }
    }
  }
});

test('新しいツール: pages.json の公開日から自動（6 件、新しい順）', () => {
  const html = read('index.html');
  for (const p of newest(data)) assert.ok(html.includes(`href="./${p.path.slice(1)}"`), p.path);
  assert.equal(newest(data).length, 6);
});

test('作った欄が data と同じ（node tools/build-top.mjs 済み）', () => {
  for (const [f, fn] of Object.entries(buildAll(data, season))) {
    const html = read(f);
    assert.equal(stripSeason(fn(html)), stripSeason(html), `${f} が古い`);
  }
});

test('トップの構造: 節 7・各節の表示 3 行まで・残りは details・チップ 3 つまで', () => {
  const secs = sectionsJa(data);
  assert.equal(secs.length, 7);
  const html = read('index.html');
  for (const s of secs) {
    const block = html.slice(html.indexOf(`<section class="yt-sec" id="${s.id}"`), html.indexOf('</section>', html.indexOf(`id="${s.id}"`)));
    const shown = block.split('<details>')[0];
    assert.ok((shown.match(/class="yt-name"/g) || []).length <= 3, s.id);
    assert.equal((block.match(/class="yt-name"/g) || []).length, s.rows.length, s.id);
    if (s.rows.length > 3) assert.match(block, /<details>\s*<summary>ほかに \d+ 件<\/summary>/);
    assert.match(block, new RegExp(`<h2 id="${s.id}-h">`));
    for (const r of s.rows) assert.ok(r.chips.length <= 3);
    for (const r of s.rows) assert.ok([...r.note].length <= 15, r.note);
  }
});

test('アクセシビリティ: スキップリンク・combobox/listbox・aria-live・lang と hreflang', () => {
  for (const [f, lang] of [['index.html', 'ja'], ['en/index.html', 'en'], ['all/index.html', 'ja']]) {
    const h = read(f);
    assert.match(h, new RegExp(`<html lang="${lang}"`), f);
    assert.match(h, /<a class="yt-skip" href="#main">/, f);
    assert.match(h, /<main id="main">/, f);
    assert.match(h, /role="combobox"[^>]*aria-autocomplete="list"[^>]*aria-expanded="false"[^>]*aria-controls="yt-q-list"/, f);
    assert.match(h, /<ul id="yt-q-list" role="listbox"/, f);
    assert.match(h, /aria-live="polite"/, f);
    assert.match(h, /<label for="yt-q">/, f);
  }
  assert.match(read('index.html'), /hreflang="en" href="https:\/\/yorozu-craft.com\/en\/"/);
  assert.match(read('en/index.html'), /hreflang="ja" href="https:\/\/yorozu-craft.com\/"/);
  const js = read('top.js');
  for (const k of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'aria-activedescendant', 'aria-selected']) assert.ok(js.includes(k), k);
});

test('デザイン: 動きなし・強調色の面は「いまの時期」だけ・字は 14px 以上', () => {
  const css = read('top.css');
  assert.doesNotMatch(css, /animation|transition|@keyframes|marquee/);
  for (const m of css.matchAll(/([^{}]+)\{([^}]*var\(--accent(?:-soft)?\)[^}]*)\}/g)) assert.match(m[1], /yt-season/, `強調色: ${m[1].trim()}`);
  assert.doesNotMatch(css, /font-size:\s*(?:0\.[0-7]|1[0-3]px|\d(?:\.\d+)?px)/);
  assert.doesNotMatch(css, /box-shadow/);
});

test('すべての道具（/all/）: pages.json の全行が 1 回ずつ', () => {
  const rows = allRows(data).flatMap((s) => s.items.flatMap((i) => [i.page.path, ...i.kids.map((k) => k.path)]));
  assert.equal(rows.length, data.pages.length);
  assert.equal(new Set(rows).size, data.pages.length);
  const html = read('all/index.html');
  for (const p of data.pages) assert.ok(html.includes(`href="../${p.path.slice(1)}"`), p.path);
});

test('英語トップ: 同じ骨組み（検索・いまの時期・誰向け 3・節 3・新着）', () => {
  const h = read('en/index.html');
  assert.equal((h.match(/<section class="yt-sec" id="(life|learn|it)"/g) || []).length, 3);
  assert.equal((h.match(/<li><a href="#(life|learn|it)">/g) || []).length, 3);
  assert.match(h, /class="yt-season"/);
  assert.match(h, /class="yt-chips yt-new"/);
  for (const p of data.en.pages) assert.ok(h.includes(`href="..${p.path}"`), p.path);
});

test('アイコン: 節・「ほかに」・/all/ の全行と「いまの時期」に、その道具の favicon.svg（alt 空・寸法あり・1 画面目より下は lazy）', () => {
  const fs = (u) => u.replace(/^(\.\.\/|\.\/)/, '').split('/')[0];
  const check = (html, sel, lazy, f) => {
    const items = [...html.matchAll(sel)];
    assert.ok(items.length > 0, `${f} に行が無い`);
    for (const m of items) {
      const [, href, img] = m;
      assert.ok(img, `${f} ${href} にアイコンが無い`);
      assert.match(img, /alt=""/, `${f} ${href} の alt`);
      assert.match(img, /width="(2[0-4])" height="\1"/, `${f} ${href} の寸法`);
      const src = img.match(/src="([^"]+)"/)[1];
      assert.match(src, /^(\.\.\/|\.\/)[^/]+\/favicon\.svg$/, `${f} ${href} の src`);
      assert.equal(fs(src), fs(href), `${f} ${href} は親リポジトリのアイコン`);
      assert.equal(/loading="lazy"/.test(img), lazy, `${f} ${href} の loading`);
    }
    return items.length;
  };
  const row = /<li><a class="yt-name" href="([^"]+)">(<img class="yt-ico"[^>]*>)?/g;
  const top = read('index.html'), all = read('all/index.html');
  assert.equal(check(top, row, true, 'index.html'), sectionsJa(data).reduce((n, s) => n + s.rows.length, 0));
  assert.equal(check(all, row, true, 'all/index.html'), allRows(data).reduce((n, s) => n + s.items.length, 0));
  assert.equal(check(top, /<li><a href="([^"]+)"><strong>(<img class="yt-ico"[^>]*>)?/g, false, 'いまの時期'), 3);
  // 月が変わったときの入れ替え（top.js）も同じ形
  const sd = seasonData(data, season, 'ja');
  const h = YT.seasonItemsHtml(YT.seasonFor(sd, new Date(2027, 0, 1)), './', true);
  assert.equal(check(h, /<li><a href="([^"]+)"><strong>(<img class="yt-ico"[^>]*>)?/g, false, '1 月'), YT.seasonFor(sd, new Date(2027, 0, 1)).length);
  assert.match(top, /class="yt-season"[^>]*data-icons/);
  // 新しい画像は作らない: 指す先はすべて既存のリポジトリ（pages.json の第 1 階層）
  const repos = new Set(data.pages.map((p) => p.path.split('/')[1]));
  for (const m of (top + all).matchAll(/class="yt-ico" src="(?:\.\.\/|\.\/)([^/]+)\/favicon\.svg"/g)) assert.ok(repos.has(m[1]), m[1]);
});
