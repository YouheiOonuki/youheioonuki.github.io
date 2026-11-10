// 共通の土台と皮（tools/common/v2/base.css・skin.css、yorozu-plans DESIGN.md）を各ツールに配る・確かめる（企画書 59 の束 A で v1、企画書 98 の K192 段 3 で v2）
// 使い方:
//   node tools/sync-common.mjs --check <ファイルかフォルダ ...>   … 配った版と同じかを確かめる（違えば終了コード 1）
//   node tools/sync-common.mjs --write <ファイルかフォルダ ...>   … begin〜end を正本で置き換える
//   node tools/sync-common.mjs --insert <リポジトリのフォルダ ...> … 印の無い style.css の先頭（最初のコメントの後）に入れる
//   node tools/sync-common.mjs --status <リポジトリのフォルダ ...>  … リポジトリごとに 済（同じ版）／古い／未（印なし）を 1 行ずつ（配る前後の確認）
//   node tools/sync-common.mjs --used <リポジトリのフォルダ ...>    … リポジトリの最上位に used.js（正本 tools/common/used.js の写し）を置く・同じにする
// フォルダを渡すと、その下の .css と .html（node_modules・.git を除く）のうち印のあるものを対象にする。
// 印: /* yorozu-common:begin … */ 〜 /* yorozu-common:end */。この間は手で直さない。ツール固有の上書きは end の後に書く
// （後に書いた :root や規則が勝つので、入れるだけでは見た目は変わらない。トークンの重複は配ったあとに消してよい）
// v1 から v2 に替えたとき、v1 の見た目（和紙の色・body・リンク）は各ファイルの end の直後に /* yorozu-v1-carry … */〜/* yorozu-v1-carry:end */ で持ち込んだ。
// 段 3 の 2〜4 で各ページを v2 のトークンに載せ替えるときに消す。--status が残りの数を出す
// used.js（道具が使われた回数。yorozu-plans D468）はファイルまるごとが正本の写し。--check と --write はフォルダの下の used.js も正本と比べる・置き換える
//   node tools/sync-common.mjs --calc <リポジトリのフォルダ ...>    … 道具をまたいで使う計算（正本 tools/common/calc/、yorozu-plans D484）の写しを CALC の表の場所に置く・同じにする
// 計算の写しは「先頭の 1 行（生成物の印）＋ 正本のまま」。--check と --write はリポジトリのフォルダ（git の最上位）を渡すと、その repo の CALC の行も比べる・置き換える。
// 写しは 1 字も変えないので、正本の中の require('./…') と window の名は配り先の名のまま（例: pension.js は './kuriage-values.js' を読む）
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const V2 = join(dirname(fileURLToPath(import.meta.url)), 'common', 'v2');
const BEGIN = '/* yorozu-common:begin';
const END = '/* yorozu-common:end */';
const CARRY = '/* yorozu-v1-carry';
const USED = join(dirname(fileURLToPath(import.meta.url)), 'common', 'used.js');
export const usedMaster = () => readFileSync(USED, 'utf8');
const lf = (t) => t.replace(/\r\n/g, '\n');   // used.js は改行の形（git の autocrlf）を問わず中身で比べる
const CALC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'common', 'calc');
// 計算の正本 → 配り先（repo の名とその中の場所）。repo の名は git の本体のフォルダの名（worktree でも同じ）
export const CALC = [
  { master: 'loan.js', repo: 'loan-sim', to: 'calc.js' },
  { master: 'loan.js', repo: 'seido-keisan', to: 'lib/loan.js' },
  { master: 'pension.js', repo: 'seido-keisan', to: 'lib/kuriage.js' },
  { master: 'pension-values.js', repo: 'seido-keisan', to: 'lib/kuriage-values.js' },
  { master: 'kaitei-data.js', repo: 'seido-keisan', to: 'lib/kaitei-values.js' },
  { master: 'gakunen.js', repo: 'gengo', to: 'gakunen-calc.js' },
  { master: 'gakunen.js', repo: 'seido-keisan', to: 'lib/gakunen.js' },
  { master: 'yakudoshi.js', repo: 'gengo', to: 'yakudoshi-calc.js' },
];
export const calcHeader = (master) => `// 生成物。正本は youheioonuki.github.io の tools/common/calc/${master}（tools/sync-common.mjs --calc で配る。ここは手で直さない。yorozu-plans D484）\n`;
export const calcCopy = (master) => calcHeader(master) + lf(readFileSync(join(CALC_DIR, master), 'utf8'));
// フォルダが git の最上位なら repo の名（worktree は本体の名）。そうでなければ null
export function repoOf(dir) {
  try {
    // 最上位かは --show-prefix（最上位なら空）で見る。--show-toplevel の文字列と比べると、別名のパス（短い名・リダイレクト）で外れる
    const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (prefix) return null;
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: dir, encoding: 'utf8' }).trim();
    return basename(dirname(common));
  } catch { return null; }
}
// 隣の repo の基点（Claude/Projects）: git の共通の .git の 2 つ上。worktree（%LOCALAPPDATA%/yorozu-wt）で開いても作業コピーの隣を指す（QUEUE Q-134）。
// YOROZU_PROJECTS で上書きできる。テストもここを読む（場所の計算を 1 か所に）
export function projectsOf(dir) {
  if (process.env.YOROZU_PROJECTS) return resolve(process.env.YOROZU_PROJECTS);
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: dir, encoding: 'utf8' }).trim();
  return dirname(dirname(common));
}
export const calcRows = (dir) => { const r = statSync(dir).isDirectory() ? repoOf(dir) : null; return r ? CALC.filter(c => c.repo === r) : []; };
const isUsed = (f) => /(^|[\\/])used\.js$/.test(f);
// 正本: 土台 → 皮 の順に begin〜end で包む（値は v2 の 2 つのファイルだけが持つ）
export const master = () => [
  '/* yorozu-common:begin v2 — サイト共通の土台と皮。正本は youheioonuki.github.io の tools/common/v2/base.css と skin.css（yorozu-plans DESIGN.md）。',
  '   この begin〜end の間は手で直さない（tools/sync-common.mjs で全ツールに配る。ツール固有の上書きは end の後に書く） */',
  readFileSync(join(V2, 'base.css'), 'utf8').trim(),
  readFileSync(join(V2, 'skin.css'), 'utf8').trim(),
  END,
].join('\n');
export const version = (text) => (text.match(/yorozu-common:begin (v\d+)/) || [])[1] || null;

// begin から end までを取り出す（無ければ null）
export function extract(text) {
  const b = text.indexOf(BEGIN); if (b < 0) return null;
  const e = text.indexOf(END, b); if (e < 0) return null;
  return { start: b, end: e + END.length, body: text.slice(b, e + END.length) };
}
function replaceBlock(text, block = master()) {
  const x = extract(text); if (!x) return null;
  return text.slice(0, x.start) + block + text.slice(x.end);
}
// 先頭のコメント（ファイルの説明）の直後に入れる
function insertBlock(text, block = master()) {
  const m = text.match(/^\s*\/\*[\s\S]*?\*\/\s*\n/);
  const at = m ? m[0].length : 0;
  return text.slice(0, at) + block + '\n\n' + text.slice(at);
}

function walk(p, out = []) {
  if (statSync(p).isFile()) { out.push(p); return out; }
  for (const n of readdirSync(p)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const q = join(p, n); const st = statSync(q);
    if (st.isDirectory()) walk(q, out); else if (/\.(css|html)$/.test(n) || n === 'used.js') out.push(q);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, ...targets] = process.argv.slice(2);
  if (!['--check', '--write', '--insert', '--status', '--used', '--calc'].includes(mode) || !targets.length) {
    console.error('使い方: node tools/sync-common.mjs --check|--write|--insert|--status|--used|--calc <ファイルかフォルダ ...>'); process.exit(2);
  }
  const block = master(); let bad = 0;
  if (mode === '--status') {
    const n = { 済: 0, 古い: 0, 未: 0 };
    for (const t of targets) {
      const files = walk(t).filter(f => /\.(css|html)$/.test(f));
      const marked = files.filter(f => extract(readFileSync(f, 'utf8')));
      const stale = marked.filter(f => extract(readFileSync(f, 'utf8')).body !== block);
      const st = !marked.length ? '未' : stale.length ? '古い' : '済';
      n[st]++;
      const carry = marked.filter(f => readFileSync(f, 'utf8').includes(CARRY)).length;
      console.log(`${st}  ${t}${marked.length ? `（印のあるファイル ${marked.length}、古い ${stale.length}${carry ? `、v1 の持ち込み ${carry}` : ''}）` : existsSync(join(t, 'style.css')) ? '（style.css あり。--insert で入れる）' : '（style.css なし。手で入れる）'}`);
    }
    console.log(`済 ${n.済}・古い ${n.古い}・未 ${n.未}`);
    process.exit(n.古い || n.未 ? 1 : 0);
  }
  const used = usedMaster();
  // 計算の写し（D484）: --calc は置く、--write は置き換える、--check は比べる
  const calcFiles = (t) => {
    for (const c of calcRows(t)) {
      const f = join(t, c.to), want = calcCopy(c.master);
      const had = existsSync(f) ? lf(readFileSync(f, 'utf8')) : null;
      if (had === want) { console.log(`同じ  ${f}（計算 ${c.master}）`); continue; }
      if (mode === '--check') { console.log(`違う  ${f}（計算の写しが正本 tools/common/calc/${c.master} と違う。--calc で配り直す）`); bad++; continue; }
      writeFileSync(f, want); console.log(`${had === null ? '追加' : '更新'}  ${f}（計算 ${c.master}）`);
    }
  };
  for (const t of targets) {
    if (mode === '--calc') {
      if (!calcRows(t).length) { console.log(`なし  ${t}（git の最上位でないか、CALC の表に無い repo）`); bad++; continue; }
      calcFiles(t); continue;
    }
    if (mode === '--check' || mode === '--write') calcFiles(t);
    if (mode === '--used') {
      const f = join(t, 'used.js');
      const had = existsSync(f) ? readFileSync(f, 'utf8') : null;
      if (had !== null && lf(had) === lf(used)) { console.log(`同じ  ${f}`); continue; }
      writeFileSync(f, used); console.log(`${had === null ? '追加' : '更新'}  ${f}`);
      continue;
    }
    if (mode === '--insert') {
      const css = join(t, 'style.css');
      if (!existsSync(css)) { console.log(`なし  ${css}（style.css が無い。手で入れる）`); bad++; continue; }
      const s = readFileSync(css, 'utf8');
      if (extract(s)) { const r = replaceBlock(s, block); if (r !== s) writeFileSync(css, r); console.log(`更新  ${css}`); }
      else { writeFileSync(css, insertBlock(s, block)); console.log(`追加  ${css}`); }
      continue;
    }
    const all = walk(t);
    const files = all.filter(f => !isUsed(f) && extract(readFileSync(f, 'utf8')));
    if (!files.length) { console.log(`なし  ${t}（印のあるファイルが無い）`); bad++; continue; }
    for (const f of all.filter(isUsed)) {
      if (lf(readFileSync(f, 'utf8')) === lf(used)) { console.log(`同じ  ${f}（used.js）`); continue; }
      if (mode === '--write') { writeFileSync(f, used); console.log(`更新  ${f}（used.js）`); }
      else { console.log(`違う  ${f}（used.js が正本と違う）`); bad++; }
    }
    for (const f of files) {
      const s = readFileSync(f, 'utf8'); const x = extract(s);
      if (x.body === block) { console.log(`同じ  ${f}（${version(s)}）`); continue; }
      if (mode === '--write') { writeFileSync(f, replaceBlock(s, block)); console.log(`更新  ${f}（${version(s)} → ${version(block)}）`); }
      else { console.log(`違う  ${f}（${version(s)}。正本は ${version(block)}）`); bad++; }
    }
  }
  process.exit(bad ? 1 : 0);
}
