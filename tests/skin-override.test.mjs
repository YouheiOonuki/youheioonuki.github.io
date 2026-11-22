// 共通の皮のページは h1 の大きさと太さを皮に任せる（yorozu-plans D637・D695・Q-906。Q-819 と同じ手順）。
// 前はトップの .site-head h1 を 1.375rem（22px）にし、英語のトップ・すべての道具・legal.css は皮と同じ --fs-xl を書き直していた。
// 皮の後ろ（yorozu-common:end の後）に、h1 の font-size・font-weight の上書きを戻さない。土台のページ（data-skin="base"）だけに当たる規則は数えない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = ['index.html', 'en/index.html', 'all/index.html', 'legal.css'];

for (const f of FILES) {
  test(`${f}: 皮の後ろに h1 の大きさ・太さの上書きが無い`, () => {
    const css = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const at = css.indexOf('/* yorozu-common:end */');
    assert.ok(at >= 0);
    const own = css.slice(at).split('</style>')[0];
    const hits = [...own.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(m => /\bh1\b/.test(m[1]) && /font-(size|weight)\s*:/.test(m[2]) && !/html\[data-skin="base"\]/.test(m[1]))
      .map(m => m[1].trim());
    assert.deepEqual(hits, []);
  });
}
