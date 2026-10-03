// トップの行の順（priority）を計算して data/pages.json に書く（yorozu-plans ROADMAP 7.24.1）
// 式: priority ＝ 需要 ＋ 検索 ＋ 季節（3 項の和。2〜8）
//   需要: DEMAND の根拠 A＝3・B＝2・C／なし＝1。ページに台帳（ROADMAP 7.2）の K 行があればその根拠（demand.pages → demand.grades）、
//         無ければ道具（リポジトリ）の根拠（demand.tools。台帳より前の道具: DEMAND 7 章 / ROADMAP 7.24.2 の 1）をその道具の全ページに
//   検索: max(表示の点, 遷移の点)（ROADMAP 7.24.3）。点は順位で 1〜10 位＝3・11〜30 位＝2・それ以下＝1。
//         表示: Search Console の表示回数（直近 4 週の合計）のリポジトリ単位の順位。表示 10 回以上の道具の中だけで付け、
//               10 回未満と表に無い道具は 1。その道具の全ページに同じ値（子ページ単位の値はまだ無いので代理。7.24.2 の 2）
//         遷移: Cloudflare の「トップから移った先」の PV（直近 4 週の合計）のページ単位の順位。5 PV 以上のページの中だけで付ける
//         入力は yorozu-plans の docs/data/weekly-tools.json（企画側のサイクルが週次レポートから写す）。
//         既定の場所は隣のクローン ../yorozu-plans/docs/data/weekly-tools.json（WEEKLY_TOOLS で変えられる）。
//         読めたら data/weekly-tools.json に写しを置く（--check と CI は写しを読む）
//   季節: data/season.json の当月（data/priority-input.json の month）に入っていれば ＋2
// 使い方: node tools/top/priority.mjs           … data/pages.json の priority を書き換える（その後 node tools/build-top.mjs）
//         node tools/top/priority.mjs --check   … 書き換えが要るか（要れば終了コード 1）
//         node tools/top/priority.mjs --table   … ページごとの 3 項を表で出す（書き換えない）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const demandPoints = (grade) => (grade === 'A' ? 3 : grade === 'B' ? 2 : 1);
export const searchPoints = (rank) => (rank == null ? 1 : rank <= 10 ? 3 : rank <= 30 ? 2 : 1);
export const MIN_IMPRESSIONS = 10;   // 表示の順位を付ける下限（7.24.3 の 1）
export const MIN_FROM_TOP = 5;       // 遷移の順位を付ける下限（7.24.3 の 1）
export const WEEKS = 4;              // 直近 4 週を合算

export const repoOf = (path) => path.split('/')[1];
// { key: 数 } を数の多い順の順位に（同数は同じ順位）。min 未満は順位なし
export function ranksOf(counts = {}, min = 0) {
  const list = Object.entries(counts).map(([k, n]) => [k, Number(n) || 0]).filter(([, n]) => n >= min);
  return new Map(list.map(([k, n]) => [k, 1 + list.filter(([, m]) => m > n).length]));
}
// weekly-tools.json の直近 WEEKS 週を合算: { impressions: {repo: 数}, fromTop: {path: 数}, periods: [...] }
export function aggregate(weekly) {
  const weeks = (weekly && weekly.weeks || []).slice(-WEEKS);
  const impressions = {}, fromTop = {};
  for (const w of weeks) {
    for (const [repo, v] of Object.entries(w.tools || {})) {
      if (v && v.impressions != null) impressions[String(repo).replace(/^\/|\/$/g, '')] = (impressions[String(repo).replace(/^\/|\/$/g, '')] || 0) + Number(v.impressions);
    }
    for (const [path, n] of Object.entries(w.from_top || {})) fromTop[path] = (fromTop[path] || 0) + Number(n);
  }
  return { impressions, fromTop, periods: weeks.map((w) => w.period) };
}
export function ranksFrom(weekly) {
  const a = aggregate(weekly);
  return { impr: ranksOf(a.impressions, MIN_IMPRESSIONS), from: ranksOf(a.fromTop, MIN_FROM_TOP) };
}
export function seasonPoints(path, season, month) {
  return (season.months[String(month)] || []).some((x) => x.path === path) ? 2 : 0;
}
// 1 ページの 3 項
export function terms(path, input, season, ranks) {
  const k = input.demand.pages[path];
  const tool = (input.demand.tools || {})['/' + repoOf(path) + '/'];
  const grade = k ? input.demand.grades[k] : tool || 'なし';
  const imprRank = ranks.impr.get(repoOf(path)) ?? null;
  const fromRank = ranks.from.get(path) ?? null;
  const d = demandPoints(grade), s = Math.max(searchPoints(imprRank), searchPoints(fromRank)), m = seasonPoints(path, season, input.month);
  return { k: k || (tool ? '道具' : ''), grade, imprRank, fromRank, demand: d, search: s, season: m, priority: d + s + m };
}
export function computeAll(pages, input, season, weekly) {
  const ranks = ranksFrom(weekly);
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
  // 週次の表: 隣の yorozu-plans から読めたら写しを更新、読めなければ写しを使う（--check は写しだけを見る）
  const copy = join(ROOT, 'data', 'weekly-tools.json');
  const src = process.env.WEEKLY_TOOLS || join(ROOT, '..', 'yorozu-plans', 'docs', 'data', 'weekly-tools.json');
  let weeklyText = null;
  if (!process.argv.includes('--check') && existsSync(src)) {
    weeklyText = readFileSync(src, 'utf8');
    if (!existsSync(copy) || readFileSync(copy, 'utf8') !== weeklyText) { writeFileSync(copy, weeklyText); console.log('写し: data/weekly-tools.json ← ' + src); }
  }
  if (weeklyText == null) weeklyText = existsSync(copy) ? readFileSync(copy, 'utf8') : '{"weeks": []}';
  const weekly = JSON.parse(weeklyText);
  for (const k of Object.values(input.demand.pages)) if (!input.demand.grades[k]) throw new Error(`demand.grades に ${k} が無い（node tools/top/ledger.mjs）`);
  for (const t of Object.keys(input.demand.tools || {})) if (!data.pages.some((x) => x.path === t)) throw new Error(`demand.tools の ${t} が pages.json に無い`);
  for (const p of Object.keys(input.demand.pages)) if (!data.pages.some((x) => x.path === p)) throw new Error(`demand.pages の ${p} が pages.json に無い`);
  const values = computeAll(data.pages, input, season, weekly);
  if (process.argv.includes('--table')) {
    console.log('path\tK\t根拠\t需要\t表示順位\t遷移順位\t検索\t季節\tpriority');
    for (const [p, t] of [...values].sort((a, b) => b[1].priority - a[1].priority)) console.log([p, t.k, t.grade, t.demand, t.imprRank ?? '-', t.fromRank ?? '-', t.search, t.season, t.priority].join('\t'));
    process.exit(0);
  }
  const next = rewrite(text, values);
  if (process.argv.includes('--check')) {
    if (next !== text) { console.log('data/pages.json の priority が data/priority-input.json と違う。node tools/top/priority.mjs を実行する'); process.exit(1); }
    console.log('priority は最新'); process.exit(0);
  }
  if (next !== text) { writeFileSync(file, next); console.log('書き換え: data/pages.json'); } else console.log('変更なし');
  if (!(weekly.weeks || []).length) console.log('注: weekly-tools.json が空なので、検索の項は全ページ 1');
}
