// トップの行の順（priority）を計算して data/pages.json に書く（yorozu-plans ROADMAP 7.24.1）
// 式: priority ＝ 需要 ＋ 検索 ＋ 季節（3 項の和。2〜8）
//   需要: DEMAND の根拠 A＝3・B＝2・C／なし＝1。ページに台帳（ROADMAP 7.2）の K 行があればその根拠（demand.pages → demand.grades）、
//         無ければ道具（リポジトリ）の根拠（demand.tools。台帳より前の道具: DEMAND 7 章 / ROADMAP 7.24.2 の 1）をその道具の全ページに
//   検索: Search Console の直近 4 週の表示回数のリポジトリ単位の順位で 1〜10 位＝3・11〜30 位＝2・それ以下と表に無い道具＝1。
//         その道具の全ページに同じ値（子ページ単位の値はまだ無いので代理。7.24.2 の 2）。入力は gsc.repos（repo → 表示回数）。
//         週次レポート（content\Notes\metrics\*_weekly.md）の「ツール別」の表から。空なら全ページ 1
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

// gsc.repos: { "seido-keisan": 1234, "loan-sim": 567 }。表示回数の多い順に順位（同数は同じ順位）
export const repoOf = (path) => path.split('/')[1];
export function gscRanks(repos = {}) {
  const list = Object.entries(repos).map(([k, n]) => [String(k).replace(/^\/|\/$/g, ''), Number(n) || 0]);
  return new Map(list.map(([k, n]) => [k, 1 + list.filter(([, m]) => m > n).length]));
}
export const rankOf = (path, ranks) => ranks.get(repoOf(path)) ?? null;
export function seasonPoints(path, season, month) {
  return (season.months[String(month)] || []).some((x) => x.path === path) ? 2 : 0;
}
// 1 ページの 3 項
export function terms(path, input, season, ranks = gscRanks(input.gsc?.repos)) {
  const k = input.demand.pages[path];
  const tool = (input.demand.tools || {})['/' + repoOf(path) + '/'];
  const grade = k ? input.demand.grades[k] : tool || 'なし';
  const rank = rankOf(path, ranks);
  const d = demandPoints(grade), s = searchPoints(rank), m = seasonPoints(path, season, input.month);
  return { k: k || (tool ? '道具' : ''), grade, rank, demand: d, search: s, season: m, priority: d + s + m };
}
export function computeAll(pages, input, season) {
  const ranks = gscRanks(input.gsc?.repos);
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
  for (const t of Object.keys(input.demand.tools || {})) if (!data.pages.some((x) => x.path === t)) throw new Error(`demand.tools の ${t} が pages.json に無い`);
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
  if (!Object.keys(input.gsc?.repos || {}).length) console.log('注: gsc.repos が空なので、検索の項は全ページ 1');
}
