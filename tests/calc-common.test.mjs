// 道具をまたいで使う計算の正本（tools/common/calc/、yorozu-plans D484・企画書 102 の 4 章）の門:
// (1) 同値性: 正本に同じ入力を通した出力が、移す前の元のファイルの出力（tests/fixtures/calc-before.json）と同じ（1 円も変わらない）
// (2) 同一性: 各リポジトリの写しが「生成物の印の 1 行＋正本」と同じ（sync-common.mjs --check と同じ判定）
// (3) sync-common.mjs --calc が写しを置き、--check が違いを落とす
//     各リポジトリの作業コピーを読む。場所は環境変数 YOROZU_PROJECTS か、このリポジトリの git の本体（worktree でも同じ）の 1 つ上
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { CALC, calcCopy, calcHeader, master, projectsOf } from '../tools/sync-common.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CALC_DIR = join(ROOT, 'tools', 'common', 'calc');
const require = createRequire(import.meta.url);
const lf = (t) => t.replace(/\r\n/g, '\n');

// 正本を読み込む。正本の中の require('./x.js') は配り先の名なので、同じ repo の CALC の行から正本に引き直す
function load(master, seen = new Map(), patch = (t) => t) {
  if (seen.has(master)) return seen.get(master);
  const repo = CALC.find(c => c.master === master).repo;
  const module = { exports: {} };
  const req = (name) => {
    const row = CALC.find(c => c.repo === repo && basename(c.to) === basename(name));
    assert.ok(row, `${master} が読む ${name} が CALC の表に無い`);
    return load(row.master, seen);
  };
  vm.runInNewContext(patch(readFileSync(join(CALC_DIR, master), 'utf8')), { module, require: req }, { filename: master });
  seen.set(master, module.exports);
  return module.exports;
}

// 出典の欄は値ではないので比べない: 満額の行の source・url・checked は外し、表全体の確認日 CHECKED は移す前の値（2026-09-25）に置いて比べる
// （calc-before.json は移す前の出力の写しで、CHECKED を含む。CHECKED は出典を開き直すたびに変わる。2026-11-11、Q-162）
const CHECKED_BEFORE = '2026-09-25';
const withoutSourceOf = (V) => { const m = { ...V.mangaku }; for (const k of ['source', 'url', 'checked']) delete m[k]; return { ...V, CHECKED: CHECKED_BEFORE, mangaku: m }; };

test('同値性: 正本の出力は、移す前の元のファイルの出力と同じ（451 件。住宅ローン・年金の繰上げ繰下げ・改定カレンダー・学年・厄年）', () => {
  const cases = require('./fixtures/calc-cases.cjs');
  const before = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'calc-before.json'), 'utf8'));
  const G = load('gakunen.js'), Y = load('yakudoshi.js');
  const out = cases({
    loan: load('loan.js'),
    // 移した後（2026-11-05、yorozu-plans 7.189 の続き 3）に満額の行へ足した出典の欄（source・url・checked）は値ではないので、外して比べる。値は 1 つも変えていない
    pension: Object.assign({}, load('pension.js'), { __values: withoutSourceOf(load('pension-values.js')) }),
    // 改定カレンダーの CHECKED は .ics の DTSTAMP などに出るので、読み込む前に移す前の値に置く（2026-11-12、Q-169）
    kaitei: load('kaitei-data.js', new Map(), (t) => t.replace(/var CHECKED = '[^']*'/, `var CHECKED = '${CHECKED_BEFORE}'`)),
    gakunen: Object.assign({}, G, { __K: G.VALUES }),
    yakudoshi: Object.assign({}, Y, { __K: Y.VALUES }),
  });
  const got = {};
  for (const k of Object.keys(out)) got[k] = createHash('sha256').update(JSON.stringify(out[k])).digest('hex').slice(0, 16);
  assert.equal(Object.keys(before).length, 451);
  assert.deepEqual(got, before);
});

test('CALC の表: 正本はどれも表に行があり、表の正本はどれもある。配り先は repo の中で重ならない', () => {
  const masters = ['loan.js', 'pension.js', 'pension-values.js', 'kaitei-data.js', 'gakunen.js', 'yakudoshi.js'];
  for (const m of masters) {
    assert.ok(existsSync(join(CALC_DIR, m)), m);
    assert.ok(CALC.some(c => c.master === m), m);
  }
  for (const c of CALC) assert.ok(masters.includes(c.master), c.master);
  const keys = CALC.map(c => c.repo + '/' + c.to);
  assert.equal(new Set(keys).size, keys.length);
  for (const m of masters) assert.match(calcCopy(m), /^\/\/ 生成物。正本は youheioonuki\.github\.io の tools\/common\/calc\//);
});

test('同一性: 各リポジトリの写しは「生成物の印の 1 行＋正本」と同じ（違えば node tools/sync-common.mjs --calc <repo>）', () => {
  const P = projectsOf(ROOT);
  const problems = [];
  for (const c of CALC) {
    const f = join(P, c.repo, c.to);
    if (!existsSync(join(P, c.repo, '.git'))) { problems.push(`${c.repo}: リポジトリが ${P} に無い`); continue; }
    if (!existsSync(f)) problems.push(`${c.repo}/${c.to}: 写しが無い`);
    else if (lf(readFileSync(f, 'utf8')) !== calcCopy(c.master)) problems.push(`${c.repo}/${c.to}: 正本 ${c.master} と違う`);
  }
  assert.deepEqual(problems, []);
});

test('sync-common.mjs --calc は CALC の表の場所に写しを置き、--check は手で直した写しを落とす', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'calc-'));
  try {
    const repo = join(tmp, 'loan-sim');
    mkdirSync(repo);
    execFileSync('git', ['init', '-q'], { cwd: repo });
    writeFileSync(join(repo, 'style.css'), '/* x */\n' + master() + '\n');   // --check は印のある css が無いフォルダを「なし」で落とすので、正本の印を置く
    const tool = join(ROOT, 'tools', 'sync-common.mjs');
    const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' });
    let r = run('--calc', repo);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(readFileSync(join(repo, 'calc.js'), 'utf8'), calcCopy('loan.js'));
    assert.ok(calcCopy('loan.js').startsWith(calcHeader('loan.js')));
    r = run('--check', repo);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    writeFileSync(join(repo, 'calc.js'), calcCopy('loan.js').replace('var CAP = 1.25;', 'var CAP = 1.3;'));
    r = run('--check', repo);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /違う .*calc\.js（計算の写しが正本 tools\/common\/calc\/loan\.js と違う/);
    r = run('--calc', repo);
    assert.equal(r.status, 0);
    assert.equal(run('--check', repo).status, 0);
    // repo の最上位でないフォルダには置かない
    mkdirSync(join(repo, 'sub'));
    assert.equal(run('--calc', join(repo, 'sub')).status, 1);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
