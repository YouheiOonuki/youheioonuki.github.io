// yorozu-plans の ROADMAP 7.2「候補台帳」の「根拠」列を、data/priority-input.json の demand.grades に機械的に写す（ROADMAP 7.24.1）
// 使い方: node tools/top/ledger.mjs <yorozu-plans の docs/ROADMAP.md> [<その commit>]
//   例: (cd ../yorozu-plans && git show origin/main:docs/ROADMAP.md > /tmp/RM.md) && node tools/top/ledger.mjs /tmp/RM.md 974aaa8
// 根拠の欄の先頭の字が A・B・C ならその字、ほか（「—」「仮説」など）は「なし」。ページと K 番号の対応（demand.pages）は手で持つ
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INPUT = join(ROOT, 'data', 'priority-input.json');

// 7.2 の節（### 7.2 候補台帳 から次の ### まで）の表の行 | Kxx | 候補 | 出どころ | 根拠 | … を読む
export function parseLedger(md) {
  const start = md.search(/^### 7\.2 候補台帳/m);
  if (start < 0) throw new Error('ROADMAP に「### 7.2 候補台帳」が無い');
  const rest = md.slice(start + 1);
  const end = rest.search(/^### /m);
  const body = end < 0 ? rest : rest.slice(0, end);
  const grades = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^\|\s*(K\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (!m) continue;
    const g = m[4].trim().charAt(0);
    grades[m[1]] = 'ABC'.includes(g) && g ? g : 'なし';
  }
  return grades;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, commit = ''] = process.argv.slice(2);
  if (!file) { console.error('使い方: node tools/top/ledger.mjs <ROADMAP.md> [commit]'); process.exit(2); }
  const grades = parseLedger(readFileSync(file, 'utf8'));
  const input = JSON.parse(readFileSync(INPUT, 'utf8'));
  input.demand.grades = grades;
  input.demand.source = `yorozu-plans docs/ROADMAP.md 7.2 候補台帳の「根拠」列${commit ? `（${commit}）` : ''}。tools/top/ledger.mjs で写した`;
  const missing = Object.entries(input.demand.pages).filter(([, k]) => !grades[k]);
  if (missing.length) { console.error('台帳に無い K 番号:', missing.map(([p, k]) => `${p} ${k}`).join(', ')); process.exit(1); }
  writeFileSync(INPUT, JSON.stringify(input, null, 2) + '\n');
  console.log(`K ${Object.keys(grades).length} 件を写した`);
}
