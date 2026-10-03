// トップの行の順（priority）を計算して data/pages.json に書く（yorozu-plans ROADMAP 7.24.1）
// 式: priority ＝ 需要 ＋ 検索 ＋ 季節（3 項の和。2〜8）
//   需要: DEMAND の根拠（ROADMAP 7.2 の台帳の列）A＝3・B＝2・C／なし＝1。ページと K 番号の対応は data/priority-input.json の demand.pages
//   検索: Search Console の直近 4 週の表示回数のサイト内の順位で 1〜10 位＝3・11〜30 位＝2・それ以下と表に無いページ＝1
//         （週次レポートの「ツール別」の表。data/priority-input.json の gsc.rows。空なら全ページ 1）
//   季節: data/season.json の当月（data/priority-input.json の month）に入っていれば ＋2
// 使い方: node tools/top/priority.mjs           … data/pages.json の priority を書き換える（その後 node tools/build-top.mjs）
//         node tools/top/priority.mjs --check   … 書き換えが要るか（要れば終了コード 1）
//         node tools/top/priority.mjs --table   … ページごとの 3 項を表で出す（書き換えない）
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const demandPoints = (grade) => (grade === 'A' ? 3 : grade === 'B' ? 2 : 1);
export const searchPoints = (rank) => (rank == null ? 1 : rank <= 10 ? 3 : rank <= 30 ? 2 : 1);

// gsc.rows: [{ "key": "/seido-keisan/nenmatsu/" か "/seido-keisan/" か "seido-keisan", "impressions": 1234 }]
// 表示回数の多い順に順位（同数は同じ順位）。ページの順位は、そのページの path に前方一致する最も長い key の順位
const normKey = (k) => { let s = String(k).trim(); if (!s.startsWith('/')) s = '/' + s; if (!s.endsWith('/')) s += '/'; return s; };
export function gscRanks(rows = []) {
  const list = rows.map((r) => ({ key: normKey(r.key), n: Number(r.impressions) || 0 }));
  const ranks = new Map();
  for (const r of list) ranks.set(r.key, 1 + list.filter((x) => x.n > r.n).length);
  return ranks;
}
export function rankOf(path, ranks) {
  let best = null, len = -1;
  for (const [k, r] of ranks) if (path.startsWith(k) && k.length > len) { best = r; len = k.length; }
  return best;
}
export function seasonPoints(path, season, month) {
  return (season.months[String(month)] || []).some((x) => x.path === path) ? 2 : 0;
}
// 1 ページの 3 項
export function terms(path, input, season, ranks = gscRanks(input.gsc?.rows)) {
  const k = input.demand.pages[path];
  const grade = k ? input.demand.grades[k] : 'なし';
  const rank = rankOf(path, ranks);
  const d = demandPoints(grade), s = searchPoints(rank), m = seasonPoints(path, season, input.month);
  return { k: k || '', grade, rank, demand: d, search: s, season: m, priority: d + s + m };
}
export function computeAll(pages, input, season) {
  const ranks = gscRanks(input.gsc?.rows);
  return new Map(pages.map((p) => [p.path, terms(p.path, input, season, ranks)]));
}

// pages.json は 1 行 1 ページなので、行ごとに "priority": N だけを置き換える（ほかの書式を崩さない）
export function rewrite(text, values) {
  return text.split('\n').map((line) => {
    const m = line.match(/^\s*\{"path": "([^"]+)"/);
    if (!m || !values.has(m[1])) return line;
    return line.replace(/"priority": \d+/, `"priority": ${values.get(m[1]).priority}`);
  }).join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = join(ROOT, 'data', 'pages.json');
  const text = readFileSync(file, 'utf8');
  const data = JSON.parse(text);
  const input = JSON.parse(readFileSync(join(ROOT, 'data', 'priority-input.json'), 'utf8'));
  const season = JSON.parse(readFileSync(join(ROOT, 'data', 'season.json'), 'utf8'));
  for (const k of Object.values(input.demand.pages)) if (!input.demand.grades[k]) throw new Error(`demand.grades に ${k} が無い（node tools/top/ledger.mjs）`);
  for (const p of Object.keys(input.demand.pages)) if (!data.pages.some((x) => x.path === p)) throw new Error(`demand.pages の ${p} が pages.json に無い`);
  const values = computeAll(data.pages, input, season);
  if (process.argv.includes('--table')) {
    console.log('path\tK\t根拠\t需要\t検索順位\t検索\t季節\tpriority');
    for (const [p, t] of [...values].sort((a, b) => b[1].priority - a[1].priority)) console.log([p, t.k, t.grade, t.demand, t.rank ?? '-', t.search, t.season, t.priority].join('\t'));
    process.exit(0);
  }
  const next = rewrite(text, values);
  if (process.argv.includes('--check')) {
    if (next !== text) { console.log('data/pages.json の priority が data/priority-input.json と違う。node tools/top/priority.mjs を実行する'); process.exit(1); }
    console.log('priority は最新'); process.exit(0);
  }
  if (next !== text) { writeFileSync(file, next); console.log('書き換え: data/pages.json'); } else console.log('変更なし');
  if (!(input.gsc?.rows || []).length) console.log('注: gsc.rows が空なので、検索の項は全ページ 1');
}
