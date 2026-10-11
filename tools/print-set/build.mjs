// 無料の印刷物のセット（yorozu-plans ROADMAP 7.46 の K173 と 7.47 の 2、企画書 91）を 1 冊の PDF にする。
// 既存の生成器（脳トレ・ビンゴカード・季語・冷蔵庫の紙）を Playwright で開いて画面の操作どおりに設定し、印刷の形のまま PDF にして、pdf-lib でつなぐ。
// 1 枚目はスマホでかざす QR の紙（冷蔵庫に貼る紙の生成器 /otasuke/reizoko/ の「QR の紙」）。脳トレの答えは末尾にまとめる。問題は毎回ちがうので、出来た PDF をそのままコミットする。
//
//   node tools/print-set/build.mjs [--out print/noutore-reku-2026-11.pdf]
//
// Playwright はこのリポジトリの依存に入れていない（公開物に入らない道具）。グローバルか、PLAYWRIGHT にパッケージの場所を渡す。
// 隣に otasuke・bingo・henkan の作業用クローンが要る（Claude\Projects の並び）。
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PROJECTS = path.resolve(ROOT, '..');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { PDFDocument } = require(path.join(PROJECTS, 'henkan/vendor/pdf-lib/pdf-lib.min.js'));

const out = path.join(ROOT, (process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'print/noutore-reku-2026-11.pdf'));
const PORT = 8790;

// /<リポジトリ>/… を Claude\Projects\<リポジトリ>\… に
const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split(/[?#]/)[0]);
  let f = path.join(PROJECTS, p);
  if (f.endsWith(path.sep) || p.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html; charset=utf-8' }); r.end(d); });
}).listen(PORT);
const BASE = `http://localhost:${PORT}`;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

/** ページを開き、setup で画面を操作し、印刷の形で PDF にする（外への通信は止める） */
async function pdfOf(url, setup) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1400 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith(BASE) ? r.continue() : r.abort()));
  await page.goto(BASE + url);
  if (setup) await setup(page);
  await page.waitForTimeout(600);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await ctx.close();
  if (errs.length) throw new Error(url + ': ' + errs.join(' | '));
  return PDFDocument.load(buf);
}
/** ラジオを選ぶ（折りたたみの中にあって見えなくても）。画面の change を起こす */
const radio = (p, name, value) => p.evaluate(([n, v]) => { const e = document.querySelector(`input[name="${n}"][value="${v}"]`); e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); }, [name, value]);
/** 欄に値を入れる（見えなくても）。input と change を起こす */
const setVal = (p, sel, value) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, value]);

// 脳トレ: 種類ごとに 2 枚、答えつき。答えのページ（3 枚目以降）は末尾へ。塗り絵カレンダーは 11 月から 2 か月
const NOTORE = [
  ['calc', null], ['kanji', null], ['machigai', null], ['cross', null], ['nurie', '2026-11'],
];
const parts = { qr: null, notore: [], answers: [], bingo: null, season: [], reizoko: [] };
parts.qr = await pdfOf('/otasuke/reizoko/', async (p) => { await radio(p, 'kind', 'qr'); await p.waitForSelector('.qr-code svg'); });
for (const [kind, month] of NOTORE) {
  const doc = await pdfOf('/otasuke/notore/', async (p) => {
    await radio(p, 'kind', kind);
    if (month) { await setVal(p, '#month', month); }
    await setVal(p, '#pages', '2');
    if (await p.isVisible('#answers')) await p.check('#answers');
  });
  parts.notore.push([doc, [0, 1]]);
  const rest = doc.getPageIndices().slice(2);
  if (rest.length) parts.answers.push([doc, rest]);
}
// ビンゴカード: 40 枚（1 枚の紙に 4 枚 → 10 ページ）
parts.bingo = await pdfOf('/bingo/cards.html', async (p) => { await setVal(p, '#c-count', '40'); await setVal(p, '#c-per', '4'); });
// 季節の紙: 冬の季語（説明つきの表 3 枚・季語だけ 2 枚。大きい字）。塗り絵カレンダーは脳トレの 2 枚（11・12 月）
parts.season.push(await pdfOf('/otasuke/kigo/', async (p) => { await radio(p, 'season', '冬'); await radio(p, 'form', 'table'); await radio(p, 'size', 'large'); }));
parts.season.push(await pdfOf('/otasuke/kigo/', async (p) => { await radio(p, 'season', '冬'); await radio(p, 'form', 'words'); await radio(p, 'size', 'large'); }));
// 冷蔵庫の紙: 救急情報（シートと「冷蔵庫にあります」の貼り紙で 2 枚）・服薬 1 週間・服薬 4 週間・血圧（空欄のまま）
// 使う紙は 30 枚（脳トレ 10・ビンゴ 10・季節 5・冷蔵庫 5）。その前に QR の紙、後ろに答え
for (const [kind, days] of [['kyukyu'], ['fukuyaku', '7'], ['fukuyaku', '28'], ['ketsuatsu']]) {
  parts.reizoko.push(await pdfOf('/otasuke/reizoko/', async (p) => { await radio(p, 'kind', kind); if (days) await radio(p, 'days', days); }));
}

// つなぐ: QR → 脳トレの問題 → ビンゴ → 季節 → 冷蔵庫 → 脳トレの答え
const book = await PDFDocument.create();
const counts = {};
async function add(label, doc, idx) {
  const pages = await book.copyPages(doc, idx || doc.getPageIndices());
  pages.forEach((pg) => book.addPage(pg));
  counts[label] = (counts[label] || 0) + pages.length;
}
await add('QR の紙', parts.qr);
for (const [d, i] of parts.notore) await add('脳トレ', d, i);
await add('ビンゴカード', parts.bingo);
for (const d of parts.season) await add('季節の紙', d);
for (const d of parts.reizoko) await add('冷蔵庫の紙', d);
for (const [d, i] of parts.answers) await add('脳トレの答え', d, i);
book.setTitle('脳トレ・レクの 1 か月セット 2026-11（yorozu-craft.com）');
book.setCreator('yorozu-craft.com');
book.setProducer('yorozu-craft.com');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, await book.save());
await browser.close();
server.close();
console.log(JSON.stringify(counts), '計', book.getPageCount(), 'ページ', '→', path.relative(ROOT, out), Math.round(fs.statSync(out).size / 1024) + ' KB');
