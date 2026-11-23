// トップの構成（yorozu-plans ROADMAP 7.23・ACCEPTANCE 3 章「束 A … トップの構成」）のテスト
// 使い方: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTop, loadPages, loadSeason, buildAll, stripSeason, searchRows, seasonData, sectionsJa, cardsJa, cardTag, allRows, newest, nextKaitei, nextHtml, updatesSection, UPDATES_ROWS } from '../tools/build-top.mjs';

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
  assert.match(html, /data-season-key="7"/);
  assert.match(html, /hayamiban/);
});

test('いまの時期の日付の窓（Q-081）: 2027-01-20〜02-03 だけ 3 枠目が恵方の行に入れ替わる。件数は 3 のまま', () => {
  const sd = seasonData(data, season, 'ja');
  const at = (y, m, d) => YT.seasonFor(sd, new Date(y, m - 1, d)).map((x) => x.path);
  const EHO = '/gengo/guide.html#q-eho';
  // 境目の 4 日: 窓の外は月の表のまま、窓の中は replaces の行（1 月 hyakunin、2 月 koko-mushoka）だけがその位置で恵方の行になる
  const OLD = { 1: '/quiz-hiroba/hyakunin/', 2: '/seido-keisan/koko-mushoka/' };
  for (const [[y, m, d], on] of [[[2027, 1, 19], false], [[2027, 1, 20], true], [[2027, 2, 3], true], [[2027, 2, 4], false]]) {
    const p = at(y, m, d), name = `${y}-${m}-${d}`, month = season.months[String(m)].map((x) => x.path);
    assert.equal(p.length, 3, name);
    assert.equal(p.includes(EHO), on, name);
    assert.deepEqual(p, on ? month.map((x) => (x === OLD[m] ? EHO : x)) : month, name);
  }
  // 窓は year の年だけ（2028 年の同じ日は出ない）
  assert.ok(!at(2028, 1, 25).includes(EHO));
  // 鍵が窓の出入りで変わる（top.js はこれで入れ替える）
  assert.notEqual(YT.seasonKey(sd, new Date(2027, 0, 19)), YT.seasonKey(sd, new Date(2027, 0, 20)));
  assert.notEqual(YT.seasonKey(sd, new Date(2027, 1, 3)), YT.seasonKey(sd, new Date(2027, 1, 4)));
  // 静的な HTML も作った日で出る（恵方の行は、元の行 /gengo/ の節 ＝ 家族・介護の札の頭に、一言の代わりに理由で）
  const html = buildAll(data, season, new Date(2027, 0, 25))['index.html'](read('index.html'));
  const card = html.slice(html.indexOf('id="kazoku" data-card'), html.indexOf('</section>', html.indexOf('id="kazoku" data-card')));
  assert.match(card, /<ul class="yt-crows">\s*(?:<li[^>]*><a href="[^"]+"><span class="yt-cn">[^<]+<\/span>[^]*?<\/li>\s*)*?<li><a href="\.\/gengo\/guide\.html#q-eho"><span class="yt-cn">[^<]+<\/span> <span class="yt-cs">2027 年の恵方は北北西です。<\/span><\/a><\/li>/);
  // 英語の表には窓が無い
  assert.deepEqual(seasonData(data, season, 'en').windows, []);
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

test('更新の記録（v2）: 「新しいツール」の見出しは無く、/updates/ を作っている行の上から 5 件（日付・道具の名前・更新履歴の 1 行）。英語トップの新着は今のまま', () => {
  const html = read('index.html');
  assert.ok(!html.includes('新しいツール') && !html.includes('最近の更新'));
  const at = html.indexOf('<section class="yt-sec" id="new"');
  const sec = html.slice(at, html.indexOf('</section>', at));
  assert.match(sec, /<h2 id="new-h">更新の記録<\/h2><a href="\.\/updates\/">更新情報<\/a>/);
  const rows = [...sec.matchAll(/<li><time datetime="(\d{4}-\d{2}-\d{2})">[^<]+<\/time> <a href="([^"]+)">([^<]+)<\/a> <span class="yt-note">([^<]+)<\/span><\/li>/g)];
  assert.equal(rows.length, UPDATES_ROWS);
  const dates = rows.map((m) => m[1]);
  assert.deepEqual([...dates].sort().reverse(), dates, '新しい順');
  assert.match(updatesSection([{ date: '2026-11-22', url: '/x/guide.html', name: '道具', what: '直した' }]), /<time datetime="2026-11-22">2026-11-22<\/time> <a href="\.\/x\/guide\.html">道具<\/a> <span class="yt-note">直した<\/span>/);
  assert.equal(newest(data).length, 3);
  assert.match(read('en/index.html'), /class="yt-rows yt-new"/);
});

test('札（site-strategy-v2 3.4・3.5）: 節 ＝ 札の 7 枚が木の順（用事 5 ＋ たのしみ 2）。柱の印は 3 つ。札の行は pages.json の今の字。「令和 8 年分・令和 9 年度」は節の頭の文と同じ元。たのしみの見出しは 1 つ', () => {
  const secs = sectionsJa(data).filter((s) => s.layer);
  assert.deepEqual(secs.map((s) => [s.id, s.name, s.layer, s.pillar]), [
    ['okane', 'お金と制度', '用事', true], ['gakko', '学校', '用事', true], ['it', '情シス・PC', '用事', true],
    ['kazoku', '家族・介護', '用事', false], ['atsumari', '集まり', '用事', false], ['hoshi', '星空', 'たのしみ', false], ['oto', '音楽・ためす', 'たのしみ', false]]);
  assert.equal(cardTag(data, 'okane'), '令和 8 年分・令和 9 年度');
  const html = read('index.html');
  assert.equal((html.match(/<section class="yt-card/g) || []).length, 7);
  assert.equal((html.match(/<section class="yt-card yt-pillar"/g) || []).length, 3);
  assert.equal((html.match(/<h2 class="yt-layer">/g) || []).length, 1);
  assert.ok(html.includes('<h2 id="okane-h">お金と制度 <span class="yt-tag"><span>令和 8 年分</span>・<span>令和 9 年度</span></span></h2>'));
  for (const s of secs) assert.ok(html.includes(`<h2 id="${s.id}-h">${s.name}`), s.name);
  const at = (id) => html.indexOf(`id="${id}" data-card`);
  assert.ok(at('okane') < at('gakko') && at('gakko') < at('it') && at('it') < at('kazoku') && at('kazoku') < at('atsumari') && at('atsumari') < html.indexOf('<h2 class="yt-layer">たのしみ</h2>') && html.indexOf('<h2 class="yt-layer">たのしみ</h2>') < at('hoshi') && at('hoshi') < at('oto'));
  // 札の下に別の一覧は置かない（節の見出しも「この節をすべて見る」も無い）。札の脚は行き先のページの名前
  assert.ok(!html.includes('この節をすべて見る') && !html.includes('class="yt-secs"'));
  const FOOT = { okane: [['./seido-keisan/', '制度の計算機']], gakko: [['./gakko-keisan/', '学校の計算機'], ['./for/teachers/', '先生向けの道具']], it: [['./for/it/', '情シス向けの道具']],
    kazoku: [['./otasuke/', 'くらしのおたすけ'], ['./for/kaigo/', '介護・デイサービス向けの道具']], hoshi: [['./hoshizora-sanpo/', 'ほしぞらさんぽ']], oto: [['./tameshite/', 'ためして']] };
  for (const [id, links] of Object.entries(FOOT)) {
    const card = html.slice(html.indexOf(`id="${id}" data-card`), html.indexOf('</section>', html.indexOf(`id="${id}" data-card`)));
    assert.ok(card.includes('<p class="yt-cf">' + links.map(([h, n]) => `<a href="${h}">${n}</a>`).join('') + '</p>'), id);
  }
  // 情シス・PC の札の頭の別館 2 行は節の annex と同じ字。PAC ファイル テスターがその次
  const annex = data.sections.find((x) => x.id === 'it').annex;
  assert.deepEqual(annex.map((x) => [x.name, x.note]), [['ストップボード', 'サービスの障害と休止の予定'], ['エンドボード', 'サポート終了日']]);
  const it = html.slice(html.indexOf('id="it" data-card'), html.indexOf('</section>', html.indexOf('id="it" data-card')));
  assert.deepEqual([...it.split('<details')[0].matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]).slice(0, 3), ['https://stopboard.yorozu-craft.com/', 'https://endboard.yorozu-craft.com/', './pac-tester/']);
  // 行の名前と一言は pages.json の今の字（いまの時期の行は一言の代わりに理由）
  const byPath = new Map(data.pages.map((p) => [p.path, p]));
  const cards = new Map(cardsJa(data).map((c) => [c.id, c]));
  for (const c of cards.values()) for (const r of c.rows) { const p = byPath.get(r.p); assert.equal(r.t, p.name || (p.short || p.title.replace(/（[^）]*）/g, '').trim()), r.p); assert.equal(r.n, p.note, r.p); }
  // 札は屋号の下の 1 行の後。検索の箱は頭に在る
  assert.ok(html.indexOf('class="yt-cards"') > html.indexOf('<p class="lead">制度の計算機と、学校・情シスの道具</p>'));
  assert.ok(html.indexOf('role="search"') < html.indexOf('</header>'));
  // 使う人から・いまの時期の段は無い。/for/* は札の脚から
  assert.ok(!html.includes('使う人から') && !html.includes('class="yt-for"') && !html.includes('class="yt-now"') && !html.includes('いまの時期'));
});

test('札の中のいまの時期: season.json の今月の行は、その節の札の 1 行目に上がり、一言の代わりに理由を出す。月が替われば top.js が入れ替える鍵と、行の表（yt-cards）を埋めてある', () => {
  const sd = seasonData(data, season, 'ja');
  const nov = new Date(2026, 10, 23);
  const items = YT.seasonFor(sd, nov);
  assert.equal(items.length, 3);
  const html = buildAll(data, season, nov)['index.html'](read('index.html'));
  const byPath = new Map(data.pages.map((p) => [p.path, p]));
  assert.match(html, /<div class="yt-cards" data-season-key="11" data-base="\.\/">/);
  for (const it of items) {
    assert.equal(it.sec, byPath.get(it.page || it.path).section, it.path);
    const card = html.slice(html.indexOf(`id="${it.sec}" data-card`), html.indexOf('</section>', html.indexOf(`id="${it.sec}" data-card`)));
    const rows = [...card.split('<details')[0].matchAll(/<li(?: class="yt-mh")?><a href="([^"]+)"><span class="yt-cn">[^<]+<\/span>(?: <span class="yt-cs">([^<]*)<\/span>)?/g)];
    const mine = rows.findIndex((m) => m[1] === './' + it.path.slice(1));
    assert.ok(mine >= 0 && mine < items.filter((x) => x.sec === it.sec).length, `${it.path} は札の頭に`);
    assert.equal(rows[mine][2], it.reason.replace(/&/g, '&amp;'), `${it.path} は一言の代わりに理由`);
  }
  assert.ok(html.includes('<script type="application/json" id="yt-cards">'));
  // 別の月で作れば、別の行が上がる（静的な HTML も作った日の月で出る）
  const jul = buildAll(data, season, new Date(2027, 6, 10))['index.html'](read('index.html'));
  assert.match(jul, /data-season-key="7"/);
  assert.match(jul, /hayamiban/);
});

test('これからの改定（v2）: kaitei.json の items のうち今日より後の 3 件を、日付と題のまま。読めなければ段ごと出さない', () => {
  const items = [
    { date: '2026-11-22', title: '過去', url: 'https://yorozu-craft.com/seido-keisan/kaitei/#i-a' },
    { date: '2026-12-01', title: '甲', url: 'https://yorozu-craft.com/seido-keisan/kaitei/#i-b' },
    { date: '2027-01-01', title: '乙', url: 'https://yorozu-craft.com/seido-keisan/kaitei/#i-c' },
    { date: '2027-01-01', title: '丙', url: 'https://yorozu-craft.com/seido-keisan/kaitei/#i-d' },
    { date: '2027-04-01', title: '丁', url: 'https://yorozu-craft.com/seido-keisan/kaitei/#i-e' },
  ];
  const d = new Date(2026, 10, 23);
  assert.deepEqual(nextKaitei(items, d).map((x) => x.title), ['甲', '乙', '丙']);
  assert.deepEqual(nextKaitei(items, new Date(2026, 11, 1)).map((x) => x.title), ['乙', '丙', '丁'], '当日は「今日より後」に入れない');
  const h = nextHtml(items, d, './');
  assert.match(h, /<h2 id="up-h">これからの改定<\/h2>/);
  assert.match(h, /<li><time datetime="2026-12-01">2026-12-01<\/time> <a href="\.\/seido-keisan\/kaitei\/#i-b">甲<\/a><\/li>/);
  assert.match(h, /<a href="\.\/seido-keisan\/kaitei\/">改定カレンダー<\/a>/);
  assert.equal(nextHtml(null, d), '', '読めなければ段ごと出さない');
  assert.equal(nextHtml([], d), '');
});

test('トップの窓（D366）: 問いの見出し・例の一行を aria-describedby で結ぶ。/all/ は「道具を探す」のまま', () => {
  const top = read('index.html');
  assert.match(top, /<label for="yt-q" class="yt-ask">何に困っていますか<\/label>/);
  assert.match(top, /<p class="yt-hint" id="yt-q-hint">例: /);
  assert.match(top, /aria-describedby="yt-q-hint"/);
  assert.match(read('all/index.html'), /<label for="yt-q">道具を探す<\/label>/);
});

test('作った欄が data と同じ（node tools/build-top.mjs 済み）', () => {
  for (const [f, fn] of Object.entries(buildAll(data, season))) {
    const html = read(f);
    assert.equal(stripSeason(fn(html)), stripSeason(html), `${f} が古い`);
  }
});

test('トップの構造（v3）: 札 7 → 日付の段（これからの改定・更新の記録）→ LINE・ホーム画面。更新の記録は札の後。節の目次はスマホ用に 1 つ。札の行にチップなし', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('class="yt-toc"') < html.indexOf('class="yt-cards"'));
  assert.ok(html.indexOf('class="yt-cards"') < html.indexOf('class="yt-dates"'));
  assert.ok(html.indexOf('<section class="yt-sec" id="new"') > html.indexOf('id="oto" data-card'), '更新の記録は札の後');
  assert.ok(html.indexOf('class="yt-dates"') < html.indexOf('<div class="yt-first">'));
  const toc = html.slice(html.indexOf('<nav class="yt-toc"'), html.indexOf('</nav>', html.indexOf('<nav class="yt-toc"')));
  assert.deepEqual([...toc.matchAll(/href="#([a-z]+)"/g)].map((m) => m[1]), ['okane', 'gakko', 'it', 'kazoku', 'atsumari', 'hoshi', 'oto']);
  assert.ok(toc.indexOf('たのしみ') > toc.indexOf('集まり') && toc.indexOf('たのしみ') < toc.indexOf('星空'));
  for (const s of sectionsJa(data).filter((x) => x.layer)) {
    const card = html.slice(html.indexOf(`id="${s.id}" data-card`), html.indexOf('</section>', html.indexOf(`id="${s.id}" data-card`)));
    assert.doesNotMatch(card, /yt-chips/, s.id);
    for (const r of s.rows) assert.ok(card.includes('href="./' + r.path.slice(1) + '"') || card.includes('href="./' + r.path.slice(1) + '#'), s.id + ' ' + r.path + ' が札か「ほかに」に無い');
    const rest = card.includes('<details') ? Number(card.match(/<span class="yt-pc">ほかに (\d+) 件<\/span>/)[1]) : 0;
    const shown = (card.split('<details')[0].match(/<li(?: class="yt-mh")?><a /g) || []).length - (s.annex || []).length;
    assert.equal(shown + rest, s.rows.length, s.id + ': 札の行 ＋ ほかに ＝ その節の行');
    for (const r of s.rows.filter((x) => x.note != null)) assert.ok([...r.note].length <= 15, r.note);
  }
  assert.match(html, /<p class="yt-quick"><a href="\.\/line\/">LINE で聞く<\/a>/);
  assert.match(html, /<details class="yt-home">/);
  assert.ok(html.includes('<a href="./all/">すべての道具</a>'), '脚から /all/ へ');
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
    assert.match(h, /<label for="yt-q"( class="yt-ask")?>/, f);
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
  assert.match(h, /class="yt-rows yt-new"/);
  for (const p of data.en.pages) assert.ok(h.includes(`href="..${p.path}"`), p.path);
});

test('英語トップ: 候補の一覧の aria-label は英文（「の候補」を混ぜない。Q-822）', () => {
  const h = read('en/index.html');
  assert.ok(!h.includes('の候補'));
  assert.match(h, /role="listbox" aria-label="Tool suggestions"/);
});

test('アイコン: /all/ の全行と、いまの時期の入れ替え（1 月）に、その道具の favicon.svg（alt 空・寸法あり・1 画面目より下は lazy）', () => {
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
      if (YT.ROOT_DIRS.includes(fs(href))) {
        // サイト本体の中のページ（/line/ など）は本体の favicon.svg
        assert.match(src, /^(\.\.\/|\.\/)favicon\.svg$/, `${f} ${href} の src（サイト本体）`);
        assert.equal(/loading="lazy"/.test(img), lazy, `${f} ${href} の loading`);
        continue;
      }
      assert.match(src, /^(\.\.\/|\.\/)[^/]+\/favicon\.svg$/, `${f} ${href} の src`);
      assert.equal(fs(src), fs(href), `${f} ${href} は親リポジトリのアイコン`);
      assert.equal(/loading="lazy"/.test(img), lazy, `${f} ${href} の loading`);
    }
    return items.length;
  };
  const row = /<li><a class="yt-name" href="([^"]+)">(<img class="yt-ico"[^>]*>)?/g;
  const top = read('index.html'), all = read('all/index.html');
  assert.ok(!top.includes('class="yt-ico"'), 'トップの札の行にアイコンは付けない（札の中は名前だけ。v3）');
  assert.equal(check(all, row, true, 'all/index.html'), allRows(data).reduce((n, s) => n + s.items.length, 0));
  // 月が変わったときの入れ替え（top.js）も同じ形
  const sd = seasonData(data, season, 'ja');
  const h = YT.seasonItemsHtml(YT.seasonFor(sd, new Date(2027, 0, 1)), './', true);
  assert.equal(check(h, /<li><a href="([^"]+)"><strong>(<img class="yt-ico"[^>]*>)?/g, false, '1 月'), YT.seasonFor(sd, new Date(2027, 0, 1)).length);
  // 新しい画像は作らない: 指す先はすべて既存のリポジトリ（pages.json の第 1 階層）
  const repos = new Set(data.pages.map((p) => p.path.split('/')[1]));
  for (const m of (top + all).matchAll(/class="yt-ico" src="(?:\.\.\/|\.\/)([^/]+)\/favicon\.svg"/g)) assert.ok(repos.has(m[1]), m[1]);
});

test('D849・Q-1081（v2）: title・og:title、description・og:description が食い違わない。屋号の下の 1 行は 柱の名前を並べた 1 行（title の後ろ半分から「出典つきの」を除いた物。title も「星空」を外した字に替えた。D1035）。断りの文は置かない', () => {
  const top = read('index.html');
  const meta = (re) => (top.match(re) || [])[1];
  const title = meta(/<title>([^<]+)<\/title>/), desc = meta(/<meta name="description" content="([^"]+)">/);
  assert.match(title, /出典つきの制度の計算機/);
  assert.equal(meta(/<meta property="og:title" content="([^"]+)">/), title);
  assert.equal(meta(/<meta property="og:description" content="([^"]+)">/), desc);
  for (const w of ['無料ツール集', 'ちょっと便利', '便利ツール', '少しずつ増やして']) assert.ok(!(title + desc).includes(w), w);
  const line = '制度の計算機と、学校・情シスの道具';
  assert.equal(title, 'yorozu-craft｜出典つきの制度の計算機と、学校・情シスの道具', 'title は 3.6 の字（星空を外した。D1035・Q-1218）');
  assert.ok(desc.endsWith('公開しています。') && !desc.includes('登録なし・無料'), 'description は末尾の「登録なし・無料。」だけ消した字');
  assert.match(top, /<header class="site-head">[\s\S]*<p class="lead">制度の計算機と、学校・情シスの道具<\/p>[\s\S]*<\/header>/);
  assert.ok(line.length > 0);
  assert.doesNotMatch(top.slice(top.indexOf('<header'), top.indexOf('<!-- top:search:begin -->')), /class="trust|。/);
  assert.doesNotMatch(top, /その制度、あなたの場合はいくら|いつ上げるか。誰の障害か|法令と国税庁・厚生労働省などの資料どおりに|ちょっと計算したい|入れた文は、探すためにサーバーへ送ります|（広告なし）|確かめ方|年末調整で、いくら戻るか|保険料控除は、いくら効くか|住民税は、来年いくらか/);
  assert.ok(top.includes('<a href="./about.html#kakunin">計算の根拠</a>') && top.includes('<a href="./api/">公開データ</a>'), '脚に 計算の根拠・公開データ');
  for (const href of ['./about.html', './privacy-policy.html', './post/', 'https://stopboard.yorozu-craft.com/', 'https://endboard.yorozu-craft.com/']) assert.ok(top.includes('<a href="' + href + '">'), href);
  const about = read('about.html');
  assert.match(about, /<h2 id="kakunin">計算の根拠<\/h2>/, 'Q-1219: 見出しは 計算の根拠（id は kakunin のまま）');
  assert.ok(!about.includes('確かめ方'), 'Q-1219: about に「確かめ方」は無い');
});

test('D849・Q-1082: about の「内容」は柱を言い、入力の扱いは「入力したデータの扱い」の節の 1 か所だけが書く（著作権の節の「ブラウザ内でのみ」は無い）', () => {
  const about = read('about.html');
  assert.match(about, /<dt>内容<\/dt>\s*<dd>税・社会保険・学校の制度の計算機と、暮らし・学校・仕事で使う道具の制作・公開。/);
  assert.ok(!about.includes('ちょっと便利なツール'));
  assert.ok(!about.includes('ブラウザ内でのみ扱われ'));
  assert.match(about, /<h2>入力したデータの扱い<\/h2>\s*<p>多くの道具は、入力した内容をお使いのブラウザの中だけで計算します。/);
});

test('節の頭の 1 文（D865・v3）: lead は柱の 3 節とたのしみの星空の 4 つ。トップには出さず、/all/ の節の頭に 1 回ずつ。別館の 2 行は情シス・PC の札の頭。更新の記録の見出しの右に更新情報', () => {
  const html = read('index.html'), all = read('all/index.html');
  const leads = data.sections.filter((s) => s.lead).map((s) => s.id);
  assert.deepEqual(leads, ['okane', 'gakko', 'it', 'hoshi']);
  for (const s of data.sections.filter((x) => x.lead)) {
    assert.equal(html.split(s.lead).length - 1, 0, s.id + ': トップには出さない');
    assert.equal(all.split(`<p class="yt-lead">${s.lead}</p>`).length - 1, 1, s.id + ': /all/ に 1 回');
  }
  assert.ok(html.includes('<li><a href="https://stopboard.yorozu-craft.com/"><span class="yt-cn">ストップボード</span> <span class="yt-cs">サービスの障害と休止の予定</span></a></li>'));
  assert.ok(html.includes('<li><a href="https://endboard.yorozu-craft.com/"><span class="yt-cn">エンドボード</span> <span class="yt-cs">サポート終了日</span></a></li>'));
  assert.match(html, /<h2 id="new-h">更新の記録<\/h2><a href="\.\/updates\/">更新情報<\/a>/);
});

test('D874・Q-1116: about の「このサイトについて」は節の名前を並べない。英語に確かめ方の節（日本語と同じ事実の 5 行）と、運営者の紹介の 4 文目', () => {
  const ja = read('about.html'), en = read('en/about.html');
  assert.ok(!ja.includes('道具は使う人ごとに分けて並べています'), 'Q-1219: 2 段落目は消した（D1012）');
  assert.match(ja, /<h2>このサイトについて<\/h2>\s*<p>yorozu-craft は、情報システムの仕事をしている個人が作っているサイトです。/);
  assert.match(en, /<dt>What we do<\/dt>\s*<dd>Calculators for Japan's tax and benefit rules with official sources, /);
  assert.ok(!en.includes('Small, useful tools'));
  const sec = en.slice(en.indexOf('<h2 id="check">How the tools are made and checked</h2>'), en.indexOf('<h2>Disclaimer</h2>'));
  assert.ok(sec.length > 0 && en.indexOf('</dl>') < en.indexOf('<h2 id="check">'));
  assert.equal(sec.split('<li>').length - 1, 5);
  for (const href of ['../seido-keisan/kaitei/', '../api/']) assert.ok(sec.includes(`href="${href}"`), href);
  assert.match(en, /How the figures are checked is described <a href="#check">below<\/a>\.<\/p>/);
});
