// 道具が使われた回数（yorozu-plans ROADMAP 7.178 D468・企画書 99。K171 の 2 枝目）の門:
// (1) tools/common/used.js は、人が操作した後に結果が初めて出たときだけ 1 回、{ page, event: 'used' } を送る（入力は送らない）
// (2) 送る画面の集合 ＝ yorozu-plans docs/content-classes.csv の種類「計算・制度」「道具」の画面（面が「画面」）の集合 − EXCLUDED
//     各リポジトリの作業コピーを読む。場所は環境変数 YOROZU_PROJECTS か、このリポジトリの git の本体（worktree でも同じ）の 1 つ上
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import vm from 'node:vm';

const ROOT = new URL('..', import.meta.url);
const USED = readFileSync(new URL('../tools/common/used.js', import.meta.url), 'utf8');
const lf = (t) => t.replace(/\r\n/g, '\n');

// --- (1) used.js のふるまい ---
function page({ host = 'yorozu-craft.com', path = '/seido-keisan/juminzei/', beacon = true } = {}) {
  const listeners = {}, sent = [];
  const window = { addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); } };
  const navigator = beacon ? { sendBeacon: (url, blob) => { sent.push({ url, blob }); return true; } } : {};
  class Blob { constructor(parts, opt) { this.text = parts.join(''); this.type = opt && opt.type; } }
  vm.runInNewContext(USED, { window, navigator, location: { hostname: host, pathname: path }, Blob });
  const fire = (t) => (listeners[t] || []).forEach((f) => f({}));
  return { window, sent, fire, listeners };
}

test('used.js: 開いただけ（操作の前）に結果が出ても送らない。操作の後の最初の 1 回だけ送り、2 回目からは送らない', () => {
  const p = page();
  p.window.yzUsed();                       // 開いたときの既定の結果・保存から戻した結果
  assert.equal(p.sent.length, 0);
  p.fire('input');
  p.window.yzUsed(); p.window.yzUsed(); p.fire('change'); p.window.yzUsed();
  assert.equal(p.sent.length, 1);
  assert.equal(p.sent[0].url, 'https://yorozu-ai.oonuki-youhei.workers.dev/v1/ping');
  assert.equal(p.sent[0].blob.type, 'text/plain');
  assert.deepEqual(JSON.parse(p.sent[0].blob.text), { page: '/seido-keisan/juminzei/', event: 'used' });
});

test('used.js: 押す・入れる・選ぶ・落とす・キーのどれでも「操作した」になる（捕まえる側で聞く）', () => {
  for (const t of ['pointerdown', 'keydown', 'input', 'change', 'submit', 'drop']) {
    const p = page();
    p.fire(t); p.window.yzUsed();
    assert.equal(p.sent.length, 1, t);
  }
});

test('used.js: 本番の外（localhost・file）と sendBeacon の無いブラウザでは送らない', () => {
  for (const o of [{ host: 'localhost' }, { host: '' }, { beacon: false }]) {
    const p = page(o);
    p.fire('input'); p.window.yzUsed();
    assert.equal(p.sent.length, 0, JSON.stringify(o));
  }
});

test('used.js: 送るのは page と event だけ。入力・結果・Cookie・端末の情報を読む口が無い', () => {
  const code = USED.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(code, /JSON\.stringify\(\{ page: location\.pathname, event: 'used' \}\)/);
  assert.doesNotMatch(code, /\.value|cookie|localStorage|userAgent|innerText|textContent|querySelector|getElementById|location\.(search|hash|href)/i);
});

test('sync-common.mjs --check はフォルダの下の used.js も正本と比べる（改行の形は問わない）。--used で置く', () => {
  const d = mkdtempSync(join(tmpdir(), 'yz-used-'));
  try {
    const tool = new URL('../tools/sync-common.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const run = (...a) => spawnSync(process.execPath, [tool, ...a], { encoding: 'utf8' });
    assert.equal(run('--used', d).status, 0);
    assert.equal(readFileSync(join(d, 'used.js'), 'utf8'), USED);
    // 印のある css が無いと --check は「なし」で落ちる（今までどおり）ので、正本の begin〜end を 1 つ置く
    const css = run('--insert', d);   // style.css が無いので「なし」
    assert.notEqual(css.status, 0);
    writeFileSync(join(d, 'style.css'), '/* t */\n');
    assert.equal(run('--insert', d).status, 0);
    writeFileSync(join(d, 'used.js'), USED.replace(/\n/g, '\r\n'));
    assert.equal(run('--check', d).status, 0, 'CRLF でも同じ中身なら通る');
    writeFileSync(join(d, 'used.js'), USED.replace("event: 'used'", "event: 'x'"));
    const bad = run('--check', d);
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /used\.js が正本と違う/);
    assert.equal(run('--write', d).status, 0);
    assert.equal(readFileSync(join(d, 'used.js'), 'utf8'), USED);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// --- (2) 送る画面の集合 ---
// csv の 2 種類の画面のうち、送らないもの。理由ごとに書く（足すときは企画書 99 の「送らない画面」にも）
const NO_AD = '広告なしの画面（D468 は広告なしの画面を対象とするかを書いていない。Fable の判断待ち）';
const NOT_ONE = '結果を出す関数が 1 つに決まらない（Fable の判断待ち）';
export const EXCLUDED = {
  '/easy-split/quick/': NO_AD,
  '/gakko-keisan/atonannichi/': NO_AD,
  '/gakko-keisan/timer/': NO_AD,
  '/gakushu-print/anki/': NO_AD,
  '/gakushu-print/tokei/': NO_AD,
  '/gengo/kaiki/': NO_AD,
  '/lifeplan/': NO_AD,
  '/otasuke/daicho/': NO_AD,
  '/otasuke/honmono/': NO_AD,
  '/otasuke/kenshin/': NO_AD,
  '/otasuke/kigo/': NO_AD,
  '/otasuke/notore/': NO_AD,
  '/otasuke/reizoko/': NO_AD,
  '/otasuke/shakyo/': NO_AD,
  '/otasuke/tejun/': NO_AD,
  '/otasuke/tokei/': NO_AD,
  '/otasuke/yasashii/': NO_AD,
  '/post/': NO_AD,
  '/seido-keisan/en/high-cost-medical/': NO_AD,
  '/seido-keisan/kogaku-ryoyohi/': NO_AD,
  '/seido-keisan/nenkin-kuriage/': NO_AD,
  '/tameshite/roogan/': NO_AD,
  '/filetime/': NOT_ONE + '。変換・逆引き・まとめての 3 つの欄がそれぞれ別の関数で結果を出す',
  '/filetime/en/': NOT_ONE + '。日本語版と同じ main.js',
  '/gengo/': NOT_ONE + '。和暦の変換・年齢・早見表の 3 つが別の関数',
  '/gengo/en/': NOT_ONE + '。日本語版と同じ main.js',
  '/tabi-shiori/': NOT_ONE + '。しおりの編集の画面で、結果（冊子）は見本の表示と印刷の 2 つの道から出る',
};

function projectsDir() {
  if (process.env.YOROZU_PROJECTS) return resolve(process.env.YOROZU_PROJECTS);
  const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' }).trim();
  return dirname(dirname(common));   // <Projects>/youheioonuki.github.io/.git → <Projects>
}
const P = projectsDir();
const isRepo = (name) => !!name && existsSync(join(P, name, '.git'));
// csv の「ファイル」（root からの道）→ [リポジトリのフォルダ, リポジトリの中の道]。最初の段がリポジトリでなければ root
function locate(file) {
  const [first, ...rest] = file.split('/');
  return isRepo(first) && first !== 'youheioonuki.github.io' ? [join(P, first), rest.join('/')] : [join(P, 'youheioonuki.github.io'), file];
}
function readCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const CSV = join(P, 'yorozu-plans', 'docs', 'content-classes.csv');
const scripts = (html) => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^(https?:)?\/\//.test(s));
const inline = (html) => [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const usedSrc = (html) => scripts(html).find((s) => /(^|\/)used\.js$/.test(s));

test('送る画面の集合 ＝ content-classes.csv の「計算・制度」「道具」の画面 − 除いた一覧。どれも used.js を読み、結果を出す関数で yzUsed を呼ぶ', { skip: !existsSync(CSV) && `content-classes.csv が無い（${CSV}）` }, () => {
  const rows = readCsv(readFileSync(CSV, 'utf8'));
  const target = rows.filter((r) => ['計算・制度', '道具'].includes(r['種類']) && r['面'] === '画面');
  assert.ok(target.length > 50, `母数 ${target.length}`);
  const urls = new Set(target.map((r) => r.URL));
  for (const u of Object.keys(EXCLUDED)) assert.ok(urls.has(u), `除いた一覧の ${u} は csv の 2 種類の画面に無い（古い行は消す）`);
  const want = target.filter((r) => !EXCLUDED[r.URL]);
  const problems = [];
  for (const r of want) {
    const [repo, rel] = locate(r['ファイル']);
    const f = join(repo, rel);
    if (!existsSync(f)) { problems.push(`${r.URL}: ${f} が無い`); continue; }
    const html = readFileSync(f, 'utf8');
    const src = usedSrc(html);
    if (!src) { problems.push(`${r.URL}: used.js を読んでいない`); continue; }
    const usedFile = resolve(dirname(f), src);
    if (usedFile !== join(repo, 'used.js')) problems.push(`${r.URL}: used.js がリポジトリの最上位を指していない（${src}）`);
    else if (!existsSync(usedFile) || lf(readFileSync(usedFile, 'utf8')) !== lf(USED)) problems.push(`${r.URL}: ${usedFile} が正本と違う（node tools/sync-common.mjs --used <repo>）`);
    const code = scripts(html).map((s) => resolve(dirname(f), s.replace(/[?#].*$/, ''))).filter((p) => existsSync(p)).map((p) => readFileSync(p, 'utf8')).join('\n') + inline(html);
    if (!code.includes('window.yzUsed?.()')) problems.push(`${r.URL}: 読んでいる script のどれも window.yzUsed?.() を呼ばない`);
  }
  assert.deepEqual(problems, []);
});

test('逆向き: used.js を読むページは、送る画面の集合の中だけ（除いた画面・見せる・遊ぶ・読み物・案内・lab は送らない）', { skip: !existsSync(CSV) && 'content-classes.csv が無い' }, () => {
  const rows = readCsv(readFileSync(CSV, 'utf8'));
  const allowed = new Set(rows.filter((r) => ['計算・制度', '道具'].includes(r['種類']) && r['面'] === '画面' && !EXCLUDED[r.URL]).map((r) => r['ファイル']));
  const repos = new Set(rows.map((r) => locate(r['ファイル'])[0]));
  if (isRepo('lab')) repos.add(join(P, 'lab'));
  const extra = [];
  const walk = (d, out = []) => {
    for (const n of readdirSync(d)) {
      if (n.startsWith('.') || ['node_modules', 'tests', 'test', 'tools'].includes(n)) continue;
      const q = join(d, n);
      if (statSync(q).isDirectory()) walk(q, out); else if (n.endsWith('.html')) out.push(q);
    }
    return out;
  };
  for (const repo of repos) {
    const name = relative(P, repo);
    for (const f of walk(repo)) {
      if (!usedSrc(readFileSync(f, 'utf8'))) continue;
      const rel = relative(repo, f).split(sep).join('/');
      const file = name === 'youheioonuki.github.io' ? rel : name + '/' + rel;
      if (!allowed.has(file)) extra.push(file);
    }
  }
  assert.deepEqual(extra, []);
});
