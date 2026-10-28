// 404.html を v2 の皮の値で生成して各リポジトリに配る・確かめる（yorozu-plans ROADMAP 7.134 (2)、K192 段 3）
// 使い方:
//   node tools/build-404.mjs --write <リポジトリのフォルダ ...>   … 各フォルダの 404.html を生成物で置き換える
//   node tools/build-404.mjs --check <リポジトリのフォルダ ...>   … 生成物と同じかを確かめる（違えば終了コード 1）
// 404 は存在しない URL で開くので、リポジトリの CSS を読めない前提で色を inline に持つ。値の正本は tools/common/v2/skin.css と base.css で、
// ここは読んで写すだけ（値を書かない）。文は見出し 1 行とトップへのリンク 1 つ（説明文なし: WRITING 2.1）。
// リポジトリごとの違いは manifest だけ: 直下に manifest.webmanifest があれば /<リポジトリ>/manifest.webmanifest、無ければ本体の /manifest.webmanifest
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = join(dirname(fileURLToPath(import.meta.url)), 'common', 'v2');
const ROOT_REPO = 'youheioonuki.github.io';
const BEACON = `<!-- Cloudflare Web Analytics（Cookie を使わないアクセス解析） --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "b79bf821e1fd4b6683866d493b1de426"}'></script><!-- End Cloudflare Web Analytics -->`;

// `--名前: 値;` を拾う
const vars = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));

// 皮の明るい表示（最初の :where(html:not(…)) { … }）と暗い表示（@media (prefers-color-scheme: dark) の中）のトークン、土台の :root の字の大きさ
export function tokens(skin = readFileSync(join(V2, 'skin.css'), 'utf8'), base = readFileSync(join(V2, 'base.css'), 'utf8')) {
  const light = skin.match(/:where\(html:not\(\[data-skin="base"\]\)\)\s*\{([^}]*)\}/);
  const dark = skin.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:where\(html:not\(\[data-skin="base"\]\)\)\s*\{([^}]*)\}/);
  const root = base.match(/:root\s*\{([^}]*)\}/);
  if (!light || !dark || !root) throw new Error('skin.css か base.css の形が変わった（トークンの塊が見つからない）');
  return { light: vars(light[1]), dark: vars(dark[1]), base: vars(root[1]) };
}

const COLORS = ['--bg', '--text', '--accent', '--on-accent', '--focus', '--focus-ring'];

export function manifestHref(repoDir) {
  const name = basename(resolve(repoDir));
  return name !== ROOT_REPO && existsSync(join(repoDir, 'manifest.webmanifest')) ? `/${name}/manifest.webmanifest` : '/manifest.webmanifest';
}

export function render({ manifest = '/manifest.webmanifest', t = tokens() } = {}) {
  const pick = (m) => COLORS.map(k => { if (!m[k]) throw new Error(`皮に ${k} が無い`); return `${k}: ${m[k]};`; }).join(' ');
  const font = t.light['--font-ui'], radius = t.light['--radius'], tap = t.base['--tap'], fsXl = t.base['--fs-xl'], sp4 = t.base['--sp-4'], sp6 = t.base['--sp-6'];
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ページが見つかりません｜yorozu-craft</title>
  <meta name="robots" content="noindex">
  <!-- 生成物（youheioonuki.github.io の tools/build-404.mjs）。手で直さない。色と字の値は tools/common/v2/skin.css・base.css から -->
  <meta name="theme-color" content="${t.light['--bg']}" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="${t.dark['--bg']}" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="${manifest}">
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <style>
    :root { color-scheme: light dark; ${pick(t.light)} }
    @media (prefers-color-scheme: dark) { :root { ${pick(t.dark)} } }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${font};
      background: var(--bg); color: var(--text); line-height: 1.4;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      text-align: center; padding: ${sp4};
    }
    h1 { font-size: ${fsXl}; font-weight: 800; margin-bottom: ${sp6}; }
    a {
      display: inline-flex; align-items: center; min-height: ${tap}; padding: 0 ${sp4}; border-radius: ${radius};
      background: var(--accent); color: var(--on-accent); text-decoration: none; font-weight: 700;
    }
    a:focus-visible { outline: 4px solid var(--focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--focus); }
  </style>
</head>
<body>
  <main>
    <h1>ページが見つかりません</h1>
    <!-- 404 はどの階層でも表示されるので、トップへのリンクは絶対パスにする -->
    <a href="/">yorozu-craft トップへ</a>
  </main>
  ${BEACON}
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, ...dirs] = process.argv.slice(2);
  if (!['--check', '--write'].includes(mode) || !dirs.length) {
    console.error('使い方: node tools/build-404.mjs --check|--write <リポジトリのフォルダ ...>'); process.exit(2);
  }
  const t = tokens();
  let bad = 0;
  for (const d of dirs) {
    const file = join(d, '404.html');
    const want = render({ manifest: manifestHref(d), t });
    const have = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
    if (mode === '--write') { if (have !== want) writeFileSync(file, want); console.log(`${have === want ? '同じ' : '書いた'} ${file}`); }
    else if (have !== want) { bad++; console.log(`違う ${file}`); }
    else console.log(`同じ ${file}`);
  }
  process.exit(bad ? 1 : 0);
}
