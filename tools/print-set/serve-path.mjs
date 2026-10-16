// build.mjs の手元の配り口が、URL の道からどのファイルを返してよいか（K191 段 2）。テストから読めるように build.mjs と分ける
import path from 'node:path';

/** 配るのは、印刷物のセットが開く 3 つのリポジトリの中だけ */
export const SERVE = ['otasuke', 'bingo', 'henkan'];

/** URL の道 → 配ってよいファイルの場所（projects はリポジトリの並ぶ所）。配らないものは null */
export function servePath(projects, url) {
  let p;
  try { p = decodeURIComponent(String(url).split(/[?#]/)[0]); } catch { return null; }
  const top = p.split('/')[1];
  if (!SERVE.includes(top)) return null;
  const base = path.join(projects, top);
  let f = path.resolve(projects, '.' + p);
  if (f !== base && !f.startsWith(base + path.sep)) return null;
  if (p.endsWith('/') || f === base) f = path.join(f, 'index.html');
  return f;
}
