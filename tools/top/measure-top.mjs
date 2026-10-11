// トップの第 2 版（yorozu-plans ROADMAP 7.55 D323・ACCEPTANCE「K168」）の測り方を Playwright で測る。
//   node tools/top/measure-top.mjs [https://yorozu-craft.com/]      本番（既定）か、手元のサーバーの URL
// 測るもの（目標は企画側の設計の数字。外部の基準ではない。公開 2 週後にトップの PV と移った先で見直す）:
//   PC（1280×800）: 折りたたみを開かずに見える道具の入口の数（目標 40 以上）
//   スマホ（390×844）: 1 画面目に見える入口の数（目標 10 以上）・ページの高さ（目標 2.5 画面以内）
// 入口: main の中の、サイトの中のページ（./ で始まる）へのリンク。閉じた details・hidden・見えない要素の中は数えない。同じ先は 1 つ
// Playwright はこのリポジトリの依存に入れていない。グローバルに入れたものか、PLAYWRIGHT にパッケージの場所を渡す
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const url = process.argv[2] || 'https://yorozu-craft.com/';
export const GOALS = { pcVisible: 40, mobileFirst: 10, mobileScreens: 2.5 };

const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const out = {};
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['pc', { width: 1280, height: 800 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage();
  await p.route(/cloudflareinsights|googlesyndication|yorozu-api/, (r) => r.abort());
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now());
  await p.waitForTimeout(800);
  out[name] = await p.evaluate((vh) => {
    const links = [...document.querySelectorAll('main a')].filter((a) => /^\.\/./.test(a.getAttribute('href') || '') && !a.closest('details:not([open])') && !a.closest('[hidden]') && a.offsetParent !== null && getComputedStyle(a).visibility !== 'hidden');
    const key = (a) => a.getAttribute('href').replace(/[?#].*$/, '');
    const first = links.filter((a) => a.getBoundingClientRect().top + scrollY < vh);
    return { height: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / vh).toFixed(2), visible: new Set(links.map(key)).size, first: new Set(first.map(key)).size };
  }, vp.height);
}
await b.close();
const res = {
  pcVisible: out.pc.visible, mobileFirst: out.mobile.first, mobileScreens: out.mobile.screens,
  ok: out.pc.visible >= GOALS.pcVisible && out.mobile.first >= GOALS.mobileFirst && out.mobile.screens <= GOALS.mobileScreens,
};
console.log(JSON.stringify({ url, goals: GOALS, ...res, detail: out }));
process.exit(res.ok ? 0 : 1);
