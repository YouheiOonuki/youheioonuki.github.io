// QUEUE Q-018: /updates/ の一覧（公開日と各 guide の更新履歴の最新行、新しい順、英語は入れない）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { latestChange, updateRows, fill, LIMIT, MAX_WHAT } from '../tools/build-updates.mjs';

const guide = (...items) => `<article id="changelog"><h2>更新履歴</h2><ul>${items.map(([d, t]) => `<li><time datetime="${d}">${d}</time> ${t}</li>`).join('')}</ul></article>`;

test('latestChange: datetime のいちばん新しい行（並びの順に依らない）。履歴が無ければ null', () => {
  assert.deepEqual(latestChange(guide(['2026-09-01', '公開'], ['2026-10-05', '値を<strong>直した</strong>'])), { date: '2026-10-05', text: '値を直した' });
  assert.equal(latestChange('<main></main>'), null);
});

test('updateRows: 公開と更新履歴を新しい順に。英語と、公開日と同じ日の「公開」の重なりは入れない。長い内容は切る', () => {
  const pages = [
    { path: '/a/', date: '2026-10-01', name: 'A' },
    { path: '/a/sub/', date: '2026-10-03', name: 'A の子' },
    { path: '/b/', date: '2026-09-01', name: 'B' },
    { path: '/en/a/', date: '2026-10-09', name: 'A en' },
  ];
  const guides = { '/a/guide.html': guide(['2026-10-01', '公開']), '/b/guide.html': guide(['2026-10-05', 'あ'.repeat(MAX_WHAT + 5)]) };
  const rows = updateRows(pages, (p) => guides[p] ?? null);
  assert.deepEqual(rows.map((r) => [r.date, r.url]), [['2026-10-05', '/b/guide.html'], ['2026-10-03', '/a/sub/'], ['2026-10-01', '/a/'], ['2026-09-01', '/b/']]);
  assert.equal([...rows[0].what].length, MAX_WHAT + 1);
});

test('fill: 印の間だけを書き換える。ひな形に印があり、行数の上限は intro 型に収まる数', () => {
  const tpl = readFileSync(new URL('../updates/index.html', import.meta.url), 'utf8');
  const out = fill(tpl, [{ date: '2026-10-23', url: '/x/', name: '<X>', what: '公開' }]);
  assert.match(out, /<li><time datetime="2026-10-23">2026-10-23<\/time> <a href="\/x\/">&lt;X&gt;<\/a>: 公開<\/li>/);
  assert.equal(out.replace(/<!-- updates:begin -->[\s\S]*<!-- updates:end -->/, ''), tpl.replace(/<!-- updates:begin -->[\s\S]*<!-- updates:end -->/, ''));
  assert.ok(LIMIT <= 12);
});

test('D411: /updates/ は案内のページ。トップの脚と sitemap に載り、サイト本体のフォルダ（ROOT_DIRS）なので道具として数えない', () => {
  const top = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const footer = top.slice(top.lastIndexOf('<footer'));
  assert.match(footer, /<a href="\.\/updates\/">更新情報<\/a>/);
  assert.match(footer, /<a href="https:\/\/lab\.yorozu-craft\.com\/">/); // D412
  assert.match(readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8'), /<loc>https:\/\/yorozu-craft\.com\/updates\/<\/loc>/);
  assert.match(readFileSync(new URL('../top.js', import.meta.url), 'utf8'), /var ROOT_DIRS = \[[^\]]*'updates'/);
});
