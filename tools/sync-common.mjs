// 共通の部品とトークン（tools/common/yorozu-common.css）を各ツールに配る・確かめる（yorozu-plans 企画書 59、束 A）
// 使い方:
//   node tools/sync-common.mjs --check <ファイルかフォルダ ...>   … 配った版と同じかを確かめる（違えば終了コード 1）
//   node tools/sync-common.mjs --write <ファイルかフォルダ ...>   … begin〜end を正本で置き換える
//   node tools/sync-common.mjs --insert <リポジトリのフォルダ ...> … 印の無い style.css の先頭（最初のコメントの後）に入れる
//   node tools/sync-common.mjs --status <リポジトリのフォルダ ...>  … リポジトリごとに 済（同じ版）／古い／未（印なし）を 1 行ずつ（配る前後の確認）
// フォルダを渡すと、その下の .css と .html（node_modules・.git を除く）のうち印のあるものを対象にする。
// 印: /* yorozu-common:begin … */ 〜 /* yorozu-common:end */。この間は手で直さない。ツール固有の上書きは end の後に書く
// （後に書いた :root や規則が勝つので、入れるだけでは見た目は変わらない。トークンの重複は配ったあとに消してよい）
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MASTER = join(dirname(fileURLToPath(import.meta.url)), 'common', 'yorozu-common.css');
const BEGIN = '/* yorozu-common:begin';
const END = '/* yorozu-common:end */';
export const master = () => readFileSync(MASTER, 'utf8').trim();
export const version = (text) => (text.match(/yorozu-common:begin (v\d+)/) || [])[1] || null;

// begin から end までを取り出す（無ければ null）
export function extract(text) {
  const b = text.indexOf(BEGIN); if (b < 0) return null;
  const e = text.indexOf(END, b); if (e < 0) return null;
  return { start: b, end: e + END.length, body: text.slice(b, e + END.length) };
}
export function replaceBlock(text, block = master()) {
  const x = extract(text); if (!x) return null;
  return text.slice(0, x.start) + block + text.slice(x.end);
}
// 先頭のコメント（ファイルの説明）の直後に入れる
export function insertBlock(text, block = master()) {
  const m = text.match(/^\s*\/\*[\s\S]*?\*\/\s*\n/);
  const at = m ? m[0].length : 0;
  return text.slice(0, at) + block + '\n\n' + text.slice(at);
}

function walk(p, out = []) {
  if (statSync(p).isFile()) { out.push(p); return out; }
  for (const n of readdirSync(p)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const q = join(p, n); const st = statSync(q);
    if (st.isDirectory()) walk(q, out); else if (/\.(css|html)$/.test(n)) out.push(q);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, ...targets] = process.argv.slice(2);
  if (!['--check', '--write', '--insert', '--status'].includes(mode) || !targets.length) {
    console.error('使い方: node tools/sync-common.mjs --check|--write|--insert|--status <ファイルかフォルダ ...>'); process.exit(2);
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
      console.log(`${st}  ${t}${marked.length ? `（印のあるファイル ${marked.length}、古い ${stale.length}）` : existsSync(join(t, 'style.css')) ? '（style.css あり。--insert で入れる）' : '（style.css なし。手で入れる）'}`);
    }
    console.log(`済 ${n.済}・古い ${n.古い}・未 ${n.未}`);
    process.exit(n.古い || n.未 ? 1 : 0);
  }
  for (const t of targets) {
    if (mode === '--insert') {
      const css = join(t, 'style.css');
      if (!existsSync(css)) { console.log(`なし  ${css}（style.css が無い。手で入れる）`); bad++; continue; }
      const s = readFileSync(css, 'utf8');
      if (extract(s)) { const r = replaceBlock(s, block); if (r !== s) writeFileSync(css, r); console.log(`更新  ${css}`); }
      else { writeFileSync(css, insertBlock(s, block)); console.log(`追加  ${css}`); }
      continue;
    }
    const files = walk(t).filter(f => extract(readFileSync(f, 'utf8')));
    if (!files.length) { console.log(`なし  ${t}（印のあるファイルが無い）`); bad++; continue; }
    for (const f of files) {
      const s = readFileSync(f, 'utf8'); const x = extract(s);
      if (x.body === block) { console.log(`同じ  ${f}（${version(s)}）`); continue; }
      if (mode === '--write') { writeFileSync(f, replaceBlock(s, block)); console.log(`更新  ${f}（${version(s)} → ${version(block)}）`); }
      else { console.log(`違う  ${f}（${version(s)}。正本は ${version(block)}）`); bad++; }
    }
  }
  process.exit(bad ? 1 : 0);
}
