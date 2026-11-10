// JSON-LD と画面の突き合わせ（yorozu-plans ROADMAP 7.181・QUEUE Q-074）。check-site.mjs と tests/jsonld.test.mjs が使う。
// 決まり（README「OGP / JSON-LD」）:
//   - WebApplication・WebPage の name ＝ そのページの h1 の文（title はサイト名と検索語を含むので比べない）
//   - FAQPage の mainEntity の問いの集合 ＝ 画面の「よくある質問」の節の問いの集合

/** タグを外し、文字参照を戻し、空白を 1 つにまとめた文 */
export function plain(s) {
  return String(s)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

/** <script type="application/ld+json"> を全部読む。読めないものは { error } */
export function ldBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { out.push({ data: JSON.parse(m[1]) }); } catch (e) { out.push({ error: String(e.message || e) }); }
  }
  return out;
}

/** JSON-LD の中の @type を持つオブジェクトを全部（配列・@graph をたどる） */
function ldNodes(html) {
  const nodes = [];
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    if (v['@type']) nodes.push(v);
    if (v['@graph']) walk(v['@graph']);
  };
  for (const b of ldBlocks(html)) if (b.data) walk(b.data);
  return nodes;
}

const typesOf = (n) => [].concat(n['@type']);

/** h1 の文（1 つ目） */
export function h1Text(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? plain(m[1]) : null;
}

/** WebApplication・WebPage の name と h1 の食い違い: [{ type, name, h1 }] */
export function nameMismatches(html) {
  const h1 = h1Text(html);
  const out = [];
  for (const n of ldNodes(html)) {
    const t = typesOf(n).find((x) => x === 'WebApplication' || x === 'WebPage');
    if (!t) continue;
    const name = plain(n.name ?? '');
    if (name !== h1) out.push({ type: t, name, h1 });
  }
  return out;
}

/** FAQPage の問いの文（FAQPage が無ければ null） */
function faqLd(html) {
  let found = false;
  const qs = [];
  for (const n of ldNodes(html)) {
    if (!typesOf(n).includes('FAQPage')) continue;
    found = true;
    for (const q of [].concat(n.mainEntity || [])) qs.push(plain(q.name ?? ''));
  }
  return found ? qs : null;
}

// 「よくある質問」の節の見出し（日本語・英語）
const FAQ_HEADING = /よくある質問|よくあるご質問|^FAQ|Frequently asked|Common questions/i;

/** 画面の「よくある質問」の節の問い（節が無ければ null）。節は見出し h2 から次の h2 まで、問いは dt か、dt が無ければ h3 */
function faqScreen(html) {
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const heads = [...body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  const i = heads.findIndex((m) => FAQ_HEADING.test(plain(m[1])));
  if (i < 0) return null;
  const from = heads[i].index + heads[i][0].length;
  const to = i + 1 < heads.length ? heads[i + 1].index : body.length;
  const sec = body.slice(from, to);
  const dts = [...sec.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/gi)].map((m) => plain(m[1]));
  if (dts.length) return dts;
  return [...sec.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => plain(m[1]));
}

/** 画面の FAQ と FAQPage の集合の差: null（どちらも無い）か { onlyScreen, onlyLd } */
export function faqDiff(html) {
  const ld = faqLd(html), screen = faqScreen(html);
  if (ld === null && (screen === null || screen.length === 0)) return null;
  const a = new Set(screen || []), b = new Set(ld || []);
  return { onlyScreen: [...a].filter((q) => !b.has(q)), onlyLd: [...b].filter((q) => !a.has(q)) };
}
