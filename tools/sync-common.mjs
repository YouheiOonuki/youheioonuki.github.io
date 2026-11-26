// 共通の土台と皮（tools/common/v2/base.css・skin.css、yorozu-plans DESIGN.md）を各ツールに配る・確かめる（企画書 59 の束 A で v1、企画書 98 の K192 段 3 で v2）
// 使い方:
//   node tools/sync-common.mjs --check <ファイルかフォルダ ...>   … 配った版と同じかを確かめる（違えば終了コード 1）
//   node tools/sync-common.mjs --write <ファイルかフォルダ ...>   … begin〜end を正本で置き換える
//   node tools/sync-common.mjs --insert <リポジトリのフォルダ ...> … 印の無い style.css の先頭（最初のコメントの後）に入れる
//   node tools/sync-common.mjs --status <リポジトリのフォルダ ...>  … リポジトリごとに 済（同じ版）／古い／未（印なし）／枠の外（本館の配信に乗らない repo）を 1 行ずつ（配る前後の確認）
//   node tools/sync-common.mjs --used <リポジトリのフォルダ ...>    … リポジトリの最上位に used.js（正本 tools/common/used.js の写し）を置く・同じにする
// フォルダを渡すと、その下の .css と .html（node_modules・.git を除く）のうち印のあるものを対象にする。
// 印: /* yorozu-common:begin … */ 〜 /* yorozu-common:end */。この間は手で直さない。ツール固有の上書きは end の後に書く
// sw.js（Service Worker）も同じ印で囲める。枠の中は取り方（正本 tools/common/sw-frame.js）、キャッシュの名前と一覧は枠の外（yorozu-plans D667・D684・Q-860）
// （後に書いた :root や規則が勝つので、入れるだけでは見た目は変わらない。トークンの重複は配ったあとに消してよい）
// v1 から v2 に替えたとき、v1 の見た目（和紙の色・body・リンク）は各ファイルの end の直後に /* yorozu-v1-carry … */〜/* yorozu-v1-carry:end */ で持ち込んだ。
// 段 3 の 2〜4 で各ページを v2 のトークンに載せ替えるときに消す。--status が残りの数を出す
// ファイルまるごとが正本の写し（WHOLE の表: used.js〈道具が使われた回数。yorozu-plans D468〉・share-card.js〈結果カード。K124・Q-464〉・reset-storage.js〈保存した内容をすべて消す。K123・Q-506〉・
// share-stub.mjs と make-share-og.mjs〈共有される結果の着地ページと OG 画像。各 repo の tools/ に置く。K124・D667・Q-867〉・zip.js〈zip の読み書き。ai-log・fitbit-export。D685・Q-887〉・
// reset-storage.test.js〈reset-storage.js のテストの本体。各 repo の tests/ に置き、repo の値は同じフォルダの reset-storage.values.json だけが持つ。D683・D706・Q-918〉・
// screen.js〈上端の固定バーと折りたたみの状態。D667・D682〉・
// guide-date.test.js〈最終確認日と元の値の突き合わせのテストの本体。各 repo の tests/ に置き、repo の値は同じフォルダの guide-date.values.json だけが持つ。D668・7.271〉・
// backup.test.js〈バックアップファイルの書き出し・読み込みのテストの本体。各 repo の tests/ か test/ に置き、repo の値は同じフォルダの backup.values.json だけが持つ。D31・7.271〉）。
// --check と --write はフォルダの下（tools/ などの下も）のその名のファイルも正本 tools/common/<名> と比べる・置き換える
//   node tools/sync-common.mjs --calc <リポジトリのフォルダ ...>    … 道具をまたいで使う計算（正本 tools/common/calc/、yorozu-plans D484）の写しを CALC の表の場所に置く・同じにする
// 計算の写しは「先頭の 1 行（生成物の印）＋ 正本のまま」。--check と --write はリポジトリのフォルダ（git の最上位）を渡すと、その repo の CALC の行も比べる・置き換える。
// 写しは 1 字も変えないので、正本の中の require('./…') と window の名は配り先の名のまま（例: pension.js は './kuriage-values.js' を読む）
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const V2 = join(dirname(fileURLToPath(import.meta.url)), 'common', 'v2');
const BEGIN = '/* yorozu-common:begin';
const END = '/* yorozu-common:end */';
const CARRY = '/* yorozu-v1-carry';
// ファイルまるごとが正本の写し: 配り先のファイル名（正本は tools/common/<名>）。写しは印の行を持たない
export const WHOLE = ['used.js', 'share-card.js', 'reset-storage.js', 'share-stub.mjs', 'make-share-og.mjs', 'zip.js', 'reset-storage.test.js', 'screen.js', 'guide-date.test.js', 'backup.test.js'];
const wholeMaster = (name) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'common', name), 'utf8');
const lf = (t) => t.replace(/\r\n/g, '\n');   // 枠・まるごとの写し・計算の写しは、改行の形（git の autocrlf）を問わず中身で比べる
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
  // インフラダッシュボード（本館の外の repo。yorozu-plans Q-799）: infra-board.js は require('./teishi.js') なので同じフォルダに置く。
  // 置き場は site/calc/ の 1 か所で、画面（calc/）も Worker（../site/calc/）も同じ 1 本を読む（yorozu-plans D661・Q-842）
  { master: 'teishi.js', repo: 'infra-dashboard', to: 'site/calc/teishi.js' },
  { master: 'infra-board.js', repo: 'infra-dashboard', to: 'site/calc/infra-board.js' },
  // yorozu-cron（Workers。本館の外）: 5 分の回の終わりに、ストップボードの Worker と同じ計算で now.json・ahead.json を作って R2 に書く（yorozu-plans QUEUE Q-1011、D782）。
  // infra-board.js は require('./teishi.js') なので同じフォルダ。src/calc/package.json が type: commonjs を持つ（yorozu-cron は type: module）
  { master: 'teishi.js', repo: 'yorozu-cron', to: 'src/calc/teishi.js' },
  { master: 'infra-board.js', repo: 'yorozu-cron', to: 'src/calc/infra-board.js' },
];
// 本館（yorozu-craft.com）の配信に乗る repo: root の robots.txt の Sitemap 行（yorozu-plans の tools/deploy/sync.ps1 が配信の一覧として読む表。
// 名前の表をここに 2 つ目として持たない。yorozu-plans D672・Q-870）。root 自身（/sitemap.xml）も乗る
const ROOT_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const HONKAN = [...readFileSync(join(ROOT_DIR, 'robots.txt'), 'utf8').matchAll(/^Sitemap:\s*https:\/\/yorozu-craft\.com\/([^/]+)\/sitemap\.xml/gm)].map((m) => m[1]);
// 計算の写しだけを受け、共通の枠（begin〜end）を持たない repo = CALC の repo のうち本館に乗らないもの。--check と --write は枠の無いことで落とさない
// （infra-dashboard は本館の外の独立したサブドメインで、本館の枠・皮を入れない。yorozu-plans D603・Q-799）。check-site・yorozu-plans の check.ps1 もこれを読む
export const FRAMELESS = [...new Set(CALC.map((c) => c.repo))].filter((r) => !HONKAN.includes(r));
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
const calcRows = (dir) => { const r = statSync(dir).isDirectory() ? repoOf(dir) : null; return r ? CALC.filter(c => c.repo === r) : []; };
const wholeOf = (f) => WHOLE.find((n) => basename(f) === n) || null;
// 正本: 土台 → 皮 の順に begin〜end で包む（値は v2 の 2 つのファイルだけが持つ）
export const master = () => [
  '/* yorozu-common:begin v2 — サイト共通の土台と皮。正本は youheioonuki.github.io の tools/common/v2/base.css と skin.css（yorozu-plans DESIGN.md）。',
  '   この begin〜end の間は手で直さない（tools/sync-common.mjs で全ツールに配る。ツール固有の上書きは end の後に書く） */',
  readFileSync(join(V2, 'base.css'), 'utf8').trim(),
  readFileSync(join(V2, 'skin.css'), 'utf8').trim(),
  END,
].join('\n');
export const version = (text) => (text.match(/yorozu-common:begin (v\d+|sw)/) || [])[1] || null;
// sw.js の枠の正本: 取り方（install・activate・fetch・ネットワーク優先）。名前（CACHE_NAME）と一覧（PRECACHE_URLS）は配り先の枠の外が持つ
export const swMaster = () => [
  '/* yorozu-common:begin sw — Service Worker の取り方。正本は youheioonuki.github.io の tools/common/sw-frame.js。この begin〜end の間は手で直さない（tools/sync-common.mjs で配る。名前と一覧は枠の外） */',
  lf(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'common', 'sw-frame.js'), 'utf8')).replace(/\n$/, ''),
  END,
].join('\n');
const blockOf = (f) => (basename(f) === 'sw.js' ? swMaster() : master());

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
    if (st.isDirectory()) walk(q, out); else if (/\.(css|html)$/.test(n) || WHOLE.includes(n) || n === 'sw.js') out.push(q);
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
    const n = { 済: 0, 古い: 0, 枠の外: 0, 未: 0 };
    const rootName = repoOf(ROOT_DIR);
    // 本館に乗らない repo（git の最上位で、root でも HONKAN でもない）は、入れる枠が無い。git の最上位でないフォルダは今までどおり未
    const outside = (t) => { const r = statSync(t).isDirectory() ? repoOf(t) : null; return r !== null && r !== rootName && !HONKAN.includes(r); };
    for (const t of targets) {
      const files = walk(t).filter(f => /\.(css|html)$/.test(f));
      const marked = files.filter(f => extract(readFileSync(f, 'utf8')));
      const stale = marked.filter(f => lf(extract(readFileSync(f, 'utf8')).body) !== lf(block));
      const st = !marked.length ? (outside(t) ? '枠の外' : '未') : stale.length ? '古い' : '済';
      n[st]++;
      const carry = marked.filter(f => readFileSync(f, 'utf8').includes(CARRY)).length;
      console.log(`${st}  ${t}${marked.length ? `（印のあるファイル ${marked.length}、古い ${stale.length}${carry ? `、v1 の持ち込み ${carry}` : ''}）` : st === '枠の外' ? '（本館の配信に乗らない）' : existsSync(join(t, 'style.css')) ? '（style.css あり。--insert で入れる）' : '（style.css なし。手で入れる）'}`);
    }
    console.log(`済 ${n.済}・古い ${n.古い}・枠の外 ${n.枠の外}・未 ${n.未}`);
    process.exit(n.古い || n.未 ? 1 : 0);
  }
  const used = wholeMaster('used.js');
  // 計算の写し（D484）: --calc は置く、--write は置き換える、--check は比べる
  const calcFiles = (t) => {
    for (const c of calcRows(t)) {
      const f = join(t, c.to), want = calcCopy(c.master);
      const had = existsSync(f) ? lf(readFileSync(f, 'utf8')) : null;
      if (had === want) { console.log(`同じ  ${f}（計算 ${c.master}）`); continue; }
      if (mode === '--check') { console.log(`違う  ${f}（計算の写しが正本 tools/common/calc/${c.master} と違う。--calc で配り直す）`); bad++; continue; }
      mkdirSync(dirname(f), { recursive: true });
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
    const files = all.filter(f => !wholeOf(f) && extract(readFileSync(f, 'utf8')));
    if (!files.length && statSync(t).isDirectory() && FRAMELESS.includes(repoOf(t))) continue;   // 枠を持たない repo は計算の写しだけを見た
    if (!files.length) { console.log(`なし  ${t}（印のあるファイルが無い）`); bad++; continue; }
    for (const f of all.filter(wholeOf)) {
      const n = wholeOf(f), want = wholeMaster(n);
      if (lf(readFileSync(f, 'utf8')) === lf(want)) { console.log(`同じ  ${f}（${n}）`); continue; }
      if (mode === '--write') { writeFileSync(f, want); console.log(`更新  ${f}（${n}）`); }
      else { console.log(`違う  ${f}（${n} が正本と違う）`); bad++; }
    }
    for (const f of files) {
      const s = readFileSync(f, 'utf8'); const x = extract(s); const want = blockOf(f);
      if (lf(x.body) === lf(want)) { console.log(`同じ  ${f}（${version(s)}）`); continue; }   // 枠も改行の形（git の autocrlf）を問わず中身で比べる（Q-595）
      if (mode === '--write') { writeFileSync(f, replaceBlock(s, want)); console.log(`更新  ${f}（${version(s)} → ${version(want)}）`); }
      else { console.log(`違う  ${f}（${version(s)}。正本は ${version(want)}）`); bad++; }
    }
  }
  process.exit(bad ? 1 : 0);
}
