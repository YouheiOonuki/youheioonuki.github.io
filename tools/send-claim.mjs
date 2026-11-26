// 「送らない」と読める字と、送る口の食い違い（yorozu-plans WRITING 2.2 の守る線の 1・5、D1017、Q-1212）。check-site が読む。
// 落とす形: 画面の字が「送らない」と言い切り、そのページのコード（インラインと同じオリジンの <script src>）か <form> に
// 入力を外へ送る口が在るのに、「サーバーで処理する・サーバーへ送る」の断りがどこにも無いページ。
// 送る口に数える物:
//   - fetch・sendBeacon・XMLHttpRequest・WebSocket が在り、Worker の口（workers.dev・/v1/〈ping を除く〉）の字がコードに在る
//   - fetch( の後 400 字以内に method: POST/PUT/PATCH か body: が在る（自分の data/*.json・辞書を読むだけの GET は数えない）
//   - fetch・sendBeacon の第 1 引数、XMLHttpRequest の .open の第 2 引数が、自分のオリジンの外の http(s) の字（GET も）
//   - new WebSocket(
//   - <form> の method="post"、または action が http(s) の外の URL
// 数えない物: 計測の口（near.js・used.js・top-click.js の sendBeacon(PING) → /v1/ping）。method="dialog"・onsubmit="return false" の form。
// 「送らない」の字の後に「サーバー」の断りが在る頁（やさしい日本語・声の入力。yorozu-plans Q-1261 の 8 頁）は、断りを書いているので落とさない。

/** 「送らない」と読める字（Q-1261 の測りの語と、WRITING 2.2 の置かない断りの例） */
export const CLAIM_RE = /外に出ません|外に出しません|送信しません|送信されません|送りません|送られません|[Nn]ever leaves?\b/g;
/** 送ることの断り（サーバーで処理する・サーバーへ送る） */
export const DISCLOSE_RE = /サーバー|Cloudflare の AI|\bservers?\b/i;

/** 画面の字から「送らない」の語（重ねない） */
export const claimsOf = (text) => [...new Set(text.match(CLAIM_RE) || [])];
export const discloses = (text) => DISCLOSE_RE.test(text);

/** JS のコメントを除く（check-site の usesStorage と同じ: 行のコメントが先） */
export const stripComments = (code) => code.replace(/(^|[^:\\'"])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * 送る口の一覧（説明の字の配列。空なら口なし）
 * @param {string} code コメントを除いたコード（インラインと同じオリジンの script をつないだもの）
 * @param {string} html ページの HTML（<form> を見る）
 * @param {string} origin 自分のオリジン（https://yorozu-craft.com など）
 */
export function sendPorts(code, html, origin) {
  const out = [];
  const hasCall = /\bfetch\s*\(|sendBeacon\s*\(|XMLHttpRequest|new\s+WebSocket\s*\(/.test(code);
  // Worker の口の字: workers.dev の URL の道か、'/v1/…' の字。計測の /v1/ping と、道の無いホストだけの字（後で道をつなぐ）は数えない
  const worker = [...code.matchAll(/[\w.-]+\.workers\.dev(\/[^'"`\s]*)|['"`](\/v1\/[\w/-]*)/g)]
    .map((m) => m[0].replace(/^['"`]/, '')).find((u) => !/\/v1\/ping\b/.test(u) && /\/v1\/\w/.test(u));
  if (hasCall && worker) out.push(`Worker の口 ${worker}`);
  for (const m of code.matchAll(/\bfetch\s*\(/g)) {
    const after = code.slice(m.index, m.index + 400);
    if (/method\s*:\s*['"](POST|PUT|PATCH)['"]|\bbody\s*:/i.test(after)) { out.push('fetch で送る（method・body）'); break; }
  }
  // 自分のオリジンの外の http(s) へ: fetch・sendBeacon の第 1 引数、XMLHttpRequest の .open の第 2 引数が字で書かれた物（GET も数える）。
  // 自分のオリジン・計測の /v1/ping・cloudflareinsights.com の beacon は数えない
  const Q = `['"\`]`;
  const ext = new RegExp(`(?:\\bfetch|sendBeacon)\\s*\\(\\s*${Q}(https?:\\/\\/[^'"\`\\s]+)|\\.open\\s*\\(\\s*${Q}\\w+${Q}\\s*,\\s*${Q}(https?:\\/\\/[^'"\`\\s]+)`, 'g');
  for (const m of code.matchAll(ext)) {
    const u = m[1] || m[2];
    let host;
    try { const x = new URL(u); if (x.origin === origin) continue; host = x.host; } catch { continue; }
    if (/\/v1\/ping\b/.test(u) || /(^|\.)cloudflareinsights\.com$/.test(host)) continue;
    out.push(`外のホストへ ${host}`);
  }
  if (/new\s+WebSocket\s*\(/.test(code)) out.push('WebSocket');
  for (const m of html.matchAll(/<form\b[^>]*>/gi)) {
    const tag = m[0];
    const method = ((tag.match(/\smethod="([^"]*)"/i) || [])[1] || '').toLowerCase();
    const action = (tag.match(/\saction="([^"]*)"/i) || [])[1] || '';
    let external = false;
    if (/^https?:\/\//i.test(action)) { try { external = new URL(action).origin !== origin; } catch { external = true; } }
    if (method === 'post' || external) out.push(`form ${method || 'get'} ${action || '(自分)'}`);
  }
  return [...new Set(out)];
}

/** 1 ページの判定。claims が在り、ports が在り、断りが無い時に bad（ports は「送らない」の字が無くても出す: 群の入口の判定に使う） */
export function judge({ text, code, html, origin }) {
  const claims = claimsOf(text);
  const ports = sendPorts(stripComments(code), html, origin);
  const disclose = discloses(text);
  return { claims, ports, disclose, bad: claims.length > 0 && ports.length > 0 && !disclose };
}

/**
 * 群の入口（/<群>/）が「送らない」と書き、断りが無く、同じ群のほかのページが送る口を持つ時の一覧
 * @param {Map<string, {claims:string[], ports:string[], disclose:boolean}>} pages ページ → judge の結果
 * @returns {{ entry: string, claims: string[], senders: string[] }[]}
 */
export function groupEntries(pages) {
  const out = [];
  for (const [p, r] of pages) {
    const m = p.match(/^\/([^/]+)\/$/);
    if (!m || !r.claims.length || r.disclose) continue;
    const senders = [...pages].filter(([q, s]) => q !== p && q.startsWith(p) && s.ports.length).map(([q]) => q);
    if (senders.length) out.push({ entry: p, claims: r.claims, senders });
  }
  return out;
}
