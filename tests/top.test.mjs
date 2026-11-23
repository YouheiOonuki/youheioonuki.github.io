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
  assert.deepEqual([...oct], ['/seido-keisan/iryohi/', '/seido-keisan/kogaku-ryoyohi/', '/gakko-keisan/naishin/'], '4〜10 月は 3 月の 3 つ');
  const jan = YT.seasonFor(sd, new Date(2027, 0, 1)).map((x) => x.path);
  assert.equal(jan[0], '/seido-keisan/iryohi/');
  const nov30 = YT.seasonFor(sd, new Date(2026, 10, 30)).map((x) => x.path);
  const dec1 = YT.seasonFor(sd, new Date(2026, 11, 1)).map((x) => x.path);
  assert.deepEqual([...nov30], [...dec1], '11 月と 12 月は同じ 3 つ');
  assert.deepEqual([...dec1], ['/seido-keisan/nenmatsu/', '/seido-keisan/nenmatsu/hoken/', '/seido-keisan/juminzei/']);
  assert.notDeepEqual([...dec1], [...jan]);
  for (let m = 0; m < 12; m++) assert.ok(YT.seasonFor(sd, new Date(2026, m, 15)).length >= 1, `${m + 1} 月が空`);
  // 静的な HTML も作った日の月で出る
  const html = buildAll(data, season, new Date(2027, 6, 10))['index.html'](read('index.html'));
  assert.match(html, /data-season-month="7"/);
  assert.match(html, /<li><a href="\.\/seido-keisan\/iryohi\/"><strong>医療費控除で、いくら戻るか<\/strong><\/a><\/li>/);
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
        if (lang === 'en') assert.ok(x.reason && !/[。.].+[。.]/.test(x.reason), `${lang} ${m} 月 ${x.path} の理由は 1 文`);
        else assert.ok(x.q && !x.reason, `${lang} ${m} 月 ${x.path} は問い（q）だけ`);
      }
    }
  }
});

test('新しいツール: pages.json の公開日から自動（newCount 件＝3、新しい順。7.96 の高さ 3.6）', () => {
  const html = read('index.html');
  for (const p of newest(data)) assert.ok(html.includes(`href="./${p.path.slice(1)}"`), p.path);
  assert.equal(newest(data).length, 3);
  // 他の節と同じ行の形: 名前（yt-name）と一言（pages.json の note）。D360・7.100
  for (const p of newest(data)) assert.ok(html.includes(`<a class="yt-name" href="./${p.path.slice(1)}">`) && html.includes(`<span class="yt-note">${p.note}</span>`), p.path);
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

test('トップの構造（第 2 版 D323・D865・Q-1207）: 節 7 の順（くらし・お金 → 情シス・IT → 子どもの学び → 親・家族 → 星空 → 変換 → 集まり）・各節の表示 5 行まで・残りは details と見出しの「ほかに N 件 →」・最近の更新は最後・行にチップなし', () => {
  const secs = sectionsJa(data);
  assert.deepEqual(secs.map((s) => s.id), ['kurashi', 'it', 'manabi', 'oya', 'asobu', 'henkan', 'atsumari']);
  const html = read('index.html');
  const at = (id) => html.indexOf(`<section class="yt-sec" id="${id}"`);
  assert.ok(at('new') > at('atsumari'), '最近の更新は最後の節の後');
  for (const s of secs) {
    const block = html.slice(at(s.id), html.indexOf('</section>', at(s.id)));
    const shown = block.split('<details>')[0];
    const annex = (s.annex || []).length;   // 節の頭の別館の行（行の数には入れない）
    assert.ok((shown.match(/class="yt-name"/g) || []).length - annex <= 5, s.id);
    assert.doesNotMatch(shown, /yt-chips/, s.id + ': 見える行にチップを出さない');
    assert.equal((block.match(/class="yt-name"/g) || []).length - annex, s.rows.length, s.id);
    if (s.rows.length > 5) {
      assert.match(block, /<details>\s*<summary>ほかに \d+ 件<\/summary>/);
      assert.match(block, new RegExp(`<span class="yt-narrow">ほかに ${s.rows.length - 5} 件 →</span>`), s.id + ': スマホの見出しのリンク');
    }
    assert.match(block, new RegExp(`<h2 id="${s.id}-h">`));
    for (const r of s.rows) assert.ok([...r.note].length <= 15, r.note);
  }
  // 1 画面目: 使う人から 4・LINE で聞く・ホーム画面に追加
  const first = html.slice(html.indexOf('<div class="yt-first">'), html.indexOf('<div class="yt-secs">'));
  assert.equal((first.match(/<li><a href="\.\/(for\/[a-z]+|en)\/"/g) || []).length, 4);
  assert.match(first, /<p class="yt-quick"><a href="\.\/line\/">LINE で聞く<\/a>/);
  assert.match(first, /<details class="yt-home">/);
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
  // 節の行に、新しいツールの行（7.100 で同じ形に）を足した数
  assert.equal(check(top, row, true, 'index.html'), sectionsJa(data).reduce((n, s) => n + s.rows.length, 0) + newest(data).length);
  assert.equal(check(all, row, true, 'all/index.html'), allRows(data).reduce((n, s) => n + s.items.length, 0));
  // いまの時期（問い 3 つ）は字だけで、アイコンを付けない（Q-1207）。月が変わったときの入れ替え（top.js）も同じ形
  const seasonUl = top.match(/<ul class="yt-season"[\s\S]*?<\/ul>/)[0];
  assert.equal([...seasonUl.matchAll(/<li><a href="[^"]+"><strong>[^<]+<\/strong><\/a><\/li>/g)].length, 3);
  assert.doesNotMatch(seasonUl, /yt-ico|data-icons/);
  const sd = seasonData(data, season, 'ja');
  assert.doesNotMatch(YT.seasonItemsHtml(YT.seasonFor(sd, new Date(2027, 0, 1)), './'), /yt-ico|<span>/);
  // 新しい画像は作らない: 指す先はすべて既存のリポジトリ（pages.json の第 1 階層）
  const repos = new Set(data.pages.map((p) => p.path.split('/')[1]));
  for (const m of (top + all).matchAll(/class="yt-ico" src="(?:\.\.\/|\.\/)([^/]+)\/favicon\.svg"/g)) assert.ok(repos.has(m[1]), m[1]);
});

test('D849・Q-1081: トップの名乗りは柱（出典つきの制度の計算）で、title・og:title、description・og:description が食い違わない。1 文の下に、2 本柱の札（計算の根拠・改定カレンダー・公開データ）', () => {
  const top = read('index.html');
  const meta = (re) => (top.match(re) || [])[1];
  const title = meta(/<title>([^<]+)<\/title>/), desc = meta(/<meta name="description" content="([^"]+)">/);
  assert.match(title, /出典つきの制度の計算機/);
  assert.equal(meta(/<meta property="og:title" content="([^"]+)">/), title);
  assert.equal(meta(/<meta property="og:description" content="([^"]+)">/), desc);
  for (const w of ['無料ツール集', 'ちょっと便利', '便利ツール', '少しずつ増やして']) assert.ok(!(title + desc).includes(w), w);
  assert.match(top, /<header class="site-head">[\s\S]*<p class="lead">その制度、あなたの場合はいくら。<\/p>[\s\S]*<\/header>/);
  assert.doesNotMatch(top.slice(top.indexOf('<header'), top.indexOf('</header>')), /class="trust|説明/);
  const main = top.slice(top.indexOf('<main'), top.indexOf('</main>'));
  for (const href of ['./seido-keisan/', './about.html#kakunin', './seido-keisan/kaitei/', 'https://stopboard.yorozu-craft.com/', './for/it/']) assert.ok(main.includes(`href="${href}"`), href);
  assert.ok(top.includes('<a href="./about.html#kakunin">計算の根拠</a>') && top.includes('<a href="./api/">公開データ</a>'), '脚に 計算の根拠・公開データ');
  // 運営者情報・プライバシーポリシー・ご要望は、トップの HTML から直に届く（脚）
  for (const href of ['./about.html', './privacy-policy.html', './post/']) assert.ok(top.includes(`<a href="${href}">`), href);
  assert.ok(!top.includes('確かめ方'), 'トップに「確かめ方」の語が無い');
  assert.ok(!top.includes('endboard.yorozu-craft.com'), 'エンドボードの字は Q-1211 の配信の後に足す');
  assert.ok(top.indexOf('class="yt-pillar"') < top.indexOf('class="yt-now"') && top.indexOf('class="yt-now"') < top.indexOf('class="yt-search"'), '1 文 → 札 → 問い → 検索の順');
  assert.equal((top.match(/class="yt-pillar"/g) || []).length, 2);
});

test('D849・Q-1082: about の「内容」は柱を言い、入力の扱いは「入力したデータの扱い」の節の 1 か所だけが書く（著作権の節の「ブラウザ内でのみ」は無い）', () => {
  const about = read('about.html');
  assert.match(about, /<dt>内容<\/dt>\s*<dd>税・社会保険・学校の制度の計算機と、暮らし・学校・仕事で使う道具の制作・公開。/);
  assert.ok(!about.includes('ちょっと便利なツール'));
  assert.ok(!about.includes('ブラウザ内でのみ扱われ'));
  assert.match(about, /<h2>入力したデータの扱い<\/h2>\s*<p>多くの道具は、入力した内容をお使いのブラウザの中だけで計算します。/);
});

test('節の頭の 1 文（D865）: 柱の 4 節だけに lead、HTML に 1 回ずつ。最近の更新の見出しの右に更新情報。情シスの節の頭に別館の行', () => {
  const html = read('index.html');
  const leads = data.sections.filter((s) => s.lead).map((s) => s.id);
  assert.deepEqual(leads, ['kurashi', 'it', 'manabi', 'asobu']);
  for (const s of data.sections.filter((x) => x.lead)) assert.equal(html.split(`<p class="yt-lead">${s.lead}</p>`).length - 1, 1, s.id);
  assert.ok(html.includes('<li class="yt-annex"><a class="yt-name" href="https://stopboard.yorozu-craft.com/">ストップボード</a> <span class="yt-note">公式が発表した障害と休止を、1 枚に</span></li>'));
  assert.match(html, /<h2 id="new-h">最近の更新<\/h2><span class="yt-links"><a href="\.\/updates\/">更新情報<\/a>/);
});

test('D874・Q-1116: about の「このサイトについて」は節の名前を並べない。英語に確かめ方の節（日本語と同じ事実の 5 行）と、運営者の紹介の 4 文目', () => {
  const ja = read('about.html'), en = read('en/about.html');
  assert.match(ja, /<p>道具は使う人ごとに分けて並べています。子どもが遊ぶ画面と、親・家族向けのページには広告を出していません。<\/p>/);
  assert.match(en, /<dt>What we do<\/dt>\s*<dd>Calculators for Japan's tax and benefit rules with official sources, /);
  assert.ok(!en.includes('Small, useful tools'));
  const sec = en.slice(en.indexOf('<h2 id="check">How the tools are made and checked</h2>'), en.indexOf('<h2>Disclaimer</h2>'));
  assert.ok(sec.length > 0 && en.indexOf('</dl>') < en.indexOf('<h2 id="check">'));
  assert.equal(sec.split('<li>').length - 1, 5);
  for (const href of ['../seido-keisan/kaitei/', '../api/']) assert.ok(sec.includes(`href="${href}"`), href);
  assert.match(en, /How the figures are checked is described <a href="#check">below<\/a>\.<\/p>/);
});
