# yorozu-craft

https://yorozu-craft.com/ のトップページ（GitHub のユーザーサイト用リポジトリ）です。

## 仕組み

このリポジトリに独自ドメイン `yorozu-craft.com` を設定しています（`CNAME` ファイル）。
GitHub Pages の仕様により、Pages を有効にしたほかのリポジトリは、自動で
`https://yorozu-craft.com/<リポジトリ名>/` で配信されます。

| URL | リポジトリ |
|-----|-----------|
| https://yorozu-craft.com/ | このリポジトリ |
| https://yorozu-craft.com/web-roulette/ | [web-roulette](https://github.com/YouheiOonuki/web-roulette) |
| https://yorozu-craft.com/easy-split/ | [easy-split](https://github.com/YouheiOonuki/easy-split) |
| https://yorozu-craft.com/tabi-shiori/ | [tabi-shiori](https://github.com/YouheiOonuki/tabi-shiori) |
| https://yorozu-craft.com/gakushu-print/ | [gakushu-print](https://github.com/YouheiOonuki/gakushu-print) |
| https://yorozu-craft.com/bingo/ | [bingo](https://github.com/YouheiOonuki/bingo) |
| https://yorozu-craft.com/sekigae/ | [sekigae](https://github.com/YouheiOonuki/sekigae) |
| https://yorozu-craft.com/filetime/ | [filetime](https://github.com/YouheiOonuki/filetime)（日英） |
| https://yorozu-craft.com/gengo/ | [gengo](https://github.com/YouheiOonuki/gengo)（日英） |
| https://yorozu-craft.com/web-metronome/ | [web-metronome](https://github.com/YouheiOonuki/web-metronome) |
| https://yorozu-craft.com/hoshizora-sanpo/ | [hoshizora-sanpo](https://github.com/YouheiOonuki/hoshizora-sanpo) |
| https://yorozu-craft.com/shaho-check/ | [shaho-check](https://github.com/YouheiOonuki/shaho-check) |
| https://yorozu-craft.com/loan-sim/ | [loan-sim](https://github.com/YouheiOonuki/loan-sim) |
| https://yorozu-craft.com/nittei-kouho/ | [nittei-kouho](https://github.com/YouheiOonuki/nittei-kouho) |
| https://yorozu-craft.com/denki-dai/ | [denki-dai](https://github.com/YouheiOonuki/denki-dai) |
| https://yorozu-craft.com/todofuken-quiz/ | [todofuken-quiz](https://github.com/YouheiOonuki/todofuken-quiz) |
| https://yorozu-craft.com/md-viewer/ | [md-viewer](https://github.com/YouheiOonuki/md-viewer) |
| https://yorozu-craft.com/pac-tester/ | [pac-tester](https://github.com/YouheiOonuki/pac-tester) |
| https://yorozu-craft.com/seido-keisan/ | [seido-keisan](https://github.com/YouheiOonuki/seido-keisan)（制度の計算機。`/nenmatsu/` 年末調整、`/juminzei/` 住民税、`/ikukyu/` 育休・産休、`/iryohi/` 医療費控除。今後ページを足す） |
| https://yorozu-craft.com/ADSearch/ | [ADSearch](https://github.com/YouheiOonuki/ADSearch)（PowerShell ライブラリ。紹介ページは `docs/` から公開） |

## ファイル

| ファイル | 役割 |
|---------|------|
| `index.html` | ツール一覧のトップページ |
| `404.html` | 存在しない URL を開いたときのページ。ドメイン直下のみ有効。ツール配下は各ツールの 404.html（「ツールを追加するとき」の 10） |
| `CNAME` | 独自ドメインの設定。消すとドメインが外れるので注意 |
| `robots.txt` | 検索エンジン向けの指示。**ドメイン直下のものしか読まれない**ので、全ツールのサイトマップをここに並べる |
| `sitemap.xml` | トップページのサイトマップ |
| `favicon.svg` / `favicon-32.png` / `apple-touch-icon.png` | yorozu-craft のマーク「万」。トップページ・共通ページ・404 のタブのアイコン（PNG は SVG 非対応のブラウザ用と、iPhone のホーム画面用）。各ツールのアイコンはツールごとに持つ |
| `og-image.png` | トップページの SNS 共有用画像（1200×630、「万」のマークと yorozu-craft）。`index.html` の `og:image` から参照。各ツールの共有用画像はツールごとに持つ |
| `about.html` / `privacy-policy.html` | **全ツール共通**の運営者情報・免責事項 / プライバシーポリシー。ツール名を出さない書き方にしてあり、ツールを追加しても直さない（これまでに無い種類の機能を持つツールを作るときだけ追記。「ツールを追加するとき」の 8） |
| `en/index.html` | 英語のトップ `https://yorozu-craft.com/en/`（2026-09-24）。**英語版のあるツールだけ**を載せ、全部の一覧は日本語のトップへ案内する。日本語のトップと `hreflang` で結んである。英語のツールページのフッターのホーム（`../../en/`）はここに向ける |
| `en/about.html` / `en/privacy-policy.html` | 上の2ページの英語版（2026-09-24。英語のツールページのフッターはこちらに向ける。「ツールを追加するとき」の 23）。日本語版と食い違ったら日本語版が優先と明記してある。**日本語版を直したら英語版も同じ日に直す** |
| `legal.css` | 上の4ページのスタイル（日英の切り替えリンク・翻訳の注記を含む。ダークモードは無い） |
| `ads.txt` | AdSense の販売者情報。ドメイン直下に1つだけ置く（全ツール共通） |
| `tools/check-site.mjs` / `.github/workflows/check-site.yml` | サイト横断チェックと、その週1回の自動実行（下の「共通の確認テスト」） |
| `LICENSE` | MIT License（著作権者 Youhei Oonuki） |

## ツールを追加するとき

1. `yorozu-template` の「Use this template」でツール用のリポジトリを作り（名前は URL になるので、短いローマ字＋種類。例: `loan-sim`、`nittei-kouho`。2026-09-23 決定 D9）、クローンして `node tools/init.mjs <リポジトリ名> "<ツール名>" "<説明文>" [--pwa]` を 1 回だけ実行する（名前・説明・日付を置き換え、`--pwa` なしならオフライン対応の部分を消す。詳しくは yorozu-template の README）。Settings → Pages で `main` / `(root)` を公開する。証明書が発行されたら **Enforce HTTPS にチェック**（2026-09-23 に 6 リポジトリすべて on にした。それまで http のまま 200 を返していた。API なら `gh api -X PUT repos/YouheiOonuki/<リポジトリ名>/pages -F https_enforced=true`）
2. `index.html` の、合うカテゴリの `<ul class="tools">` にある `<li>` を複製し、リンク先・アイコン・説明を書き換える。カテゴリは「くらし・お金」（家計・制度の計算）／「しごと・べんり」（集まりの準備・作業の道具）／「まなび・あそび」（こどもと使う・音や星や地図）の 3 つ（2026-09-23 に分けた）。あわせて上の「新しいツール」の先頭に 1 行足し、4 件目を消す
3. `robots.txt` に `Sitemap: https://yorozu-craft.com/<リポジトリ名>/sitemap.xml` を追加する
4. ツール側の canonical / OGP の URL は `https://yorozu-craft.com/<リポジトリ名>/` にする
5. ツールの**全ページの `<head>` に AdSense のタグを入れる**（審査とドメインの確認は済んでいるので、ツールごとの申請は不要）。
   ただし、全画面で操作するツール本体（例: hoshizora-sanpo のプラネタリウム画面）は、自動広告が操作ボタンを隠さないよう `<meta name="google-adsense-account">` だけにして、広告は図鑑・使い方などの読みものページで出す。こどもが遊ぶ画面（todofuken-quiz の本体）も同じく meta だけにし、広告は保護者向けページだけに出す（決定 D18）

   ```html
   <meta name="google-adsense-account" content="ca-pub-5375267956079717">
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5375267956079717"
        crossorigin="anonymous"></script>
   ```
6. ツールの**全ページの `</body>` 直前に Cloudflare Web Analytics のビーコンを入れる**（トークンはドメイン共通なので、そのまま同じものを使う）。（共通のプライバシーポリシーに記載済み）

   ```html
   <!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "b79bf821e1fd4b6683866d493b1de426"}'></script><!-- End Cloudflare Web Analytics -->
   ```
7. PWA（Service Worker）にするツールは、**キャッシュ名を `<リポジトリ名>-` で始め（例: `web-metronome-v1`）、古いキャッシュを消すときもその名前で始まるものだけを消す**。全ツールが同じオリジン（`yorozu-craft.com`）でキャッシュ領域を共有しているため、ほかのツールのキャッシュを消すと、そのツールがオフラインで開けなくなる。`manifest.webmanifest` に `id` を書くなら `/<リポジトリ名>/` にする（`./` はドメイン直下と解釈され、ほかのツールと同じアプリ扱いになる）

   ```js
   // sw.js の activate（自分のキャッシュだけを掃除する）
   keys.filter(k => k.startsWith('<リポジトリ名>-') && k !== CACHE).map(k => caches.delete(k))
   ```

8. **運営者情報・プライバシーポリシーはツールごとに作らない。このリポジトリの共通ページにリンクするだけで、共通ページは直さない**
   - ツールのフッターに `../about.html`（運営者情報）と `../privacy-policy.html`（プライバシーポリシー）へのリンクを置く
   - ツール固有のこと（ブラウザに何を保存するか、利用上の注意、データの出典・ライセンスなど）は、**ツールの使い方ページ**に「ご利用上の注意・データの扱い」として書く
   - 同じ節に**ご要望・不具合の報告フォームへのリンク**を置く（全ツール共通の Google フォーム 1 つ。末尾の `entry.585564634=` にリポジトリ名を入れると、フォームの「対象ツール」欄が埋まった状態で開く。フォームは直さない。2026-09-23 決定 D13 の変更。yorozu-template の guide.html に入っている）

     ```html
     <p><a href="https://docs.google.com/forms/d/e/1FAIpQLSd8B90qh5lEIyr25iw1jOjdQjOyaPZ1_z2wMB4kH-EmEeJYWw/viewform?usp=pp_url&amp;entry.585564634=<リポジトリ名>" target="_blank" rel="noopener">ご要望・不具合の報告（Google フォーム）</a>：いただいた内容をもとに直します。お返事はしていません。</p>
     ```
   - 共通ページはツール名を出さない書き方にしてある（「一部のツールは〜」）。次のような**これまでに無い種類の機能**を持つツールを作るときだけ、共通ページに一般的な1文を足す：アカウント登録・ログイン、サーバーへのデータ送信やファイルのアップロード、マイク・カメラなど位置情報以外の端末機能、決済、外部サービスとの連携、Cookie を使う仕組み

9. **フォントは端末のフォントで、`font-family` の並びだけ全ツールで揃える。Web フォントは読まない**（2026-09-23 決定。実測は下の「フォント」の節）。**例外**: 学習プリントメーカー（gakushu-print）のなぞり書きのマス目だけ、端末に教科書体が無いときに Klee One（OFL）をリポジトリ内の `fonts/` から読む（字形が学習の中身そのもののため。かなと漢字に分けて最小限に絞る。2026-09-24 オーナー決定）

   ```css
   font-family: "Noto Sans JP", "Noto Sans CJK JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
   ```

   Android は Noto Sans CJK が標準搭載なので端末側のフォントで Noto Sans JP になり、iOS はヒラギノ、Windows はメイリオで出る。hoshizora-sanpo は `--sans` にこの並びを入れる（見出しの明朝 `--serif` はそのまま）

10. **ツールの直下に `404.html` を置く**（このリポジトリの `404.html` と同じもの。リンクは絶対パス `/`、`noindex`、Cloudflare ビーコンあり、AdSense なし）。GitHub Pages はツール配下の存在しない URL に、ドメイン直下の 404.html ではなく、そのリポジトリの 404.html（無ければ GitHub の既定ページ）を返すため
11. **入力内容を含む共有 URL は `#` 以降に入れる**（`?` クエリに入れない。共通プライバシーポリシー 5 節「入力内容は URL の『#』以降に入っているため、リンクを開いても当サイトのサーバーには送信されません」に合わせる。例: easy-split の `#s=`）。`?` は、入力内容を含まない目印（例: web-roulette の `?debug=1`）にだけ使う
12. **ブラウザに保存するときのキーは `<リポジトリ名>_` で始める**（例: `loan-sim_draft`。ハイフンは区切りに使わない）。全ツールが同じオリジンで localStorage を共有しているため、接頭辞の無いキーは読みも書きもしない。IndexedDB を使うなら DB 名にも同じ接頭辞を付ける。読み書きはすべて try/catch で囲む。容量はオリジン全体で約 5MB を共有するので、長い文書や大きなリストを保存するツールは容量に注意する（数値の上限は設けない。2026-09-23 決定 D12）
13. **Service Worker を使うときの追加の決まり**（7 に加えて）
   - 登録は `navigator.serviceWorker.register('./sw.js')` だけにする（`scope: '/'` を指定しない。ドメイン全体を横取りして、トップやほかのツールがそのツールのキャッシュに置き換わる）
   - fetch ハンドラは自分のパス配下だけを扱う（hoshizora-sanpo の `sw.js` の guard と同じ: `if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;`）
   - `manifest.webmanifest` の `id` は必ず `/<リポジトリ名>/` と書く
14. **ページの名前**: 使い方・注意・根拠を書くページは `guide.html`。ツール側で `about.html` という名前は使わない（共通の運営者情報と紛れる）。ツール内の `about.html`・`privacy-policy.html`（共通ページへ移動するだけのページ）は、旧 URL があった既存ツールだけの経過措置なので、新しいツールには作らない
15. **共通ページへのリンクは相対パスで書く**（`../about.html`・`../privacy-policy.html`。下の階層のページは `../../about.html`）。ドメインが変わっても動くようにするため
16. **ライセンス**: リポジトリ直下に MIT の `LICENSE` を置く（著作権者 Youhei Oonuki）。第三者のデータやライブラリを使うときは、その出典とライセンスをツールのページと README に書く
17. **テスト**: 計算ロジックがあるツールは `tests/*.test.js` を `node --test` で動く形で書き、`.github/workflows/test.yml`（easy-split と同じもの）を置いて push・PR のたびに自動で走らせる。ロジックの薄いツールは不要
18. **公開前の仕上げ**: `sitemap.xml` の `lastmod` を公開日にする。SNS 共有用の `og-image.png`（1200×630）を用意する。公開したら Search Console にそのツールの `sitemap.xml` を送信する（2026-09-23 決定 D14）
19. **ダークモード**（新しいツール）: `prefers-color-scheme` で端末の設定に自動で合わせる。手動の切り替えは付けない（2026-09-23 決定 D8。既存ツールのテーマ切り替えはそのまま）
20. **ブラウザに保存するツールは、保存している内容を JSON ファイルに書き出し・読み込みできるようにする**（「ファイルに書き出す」「ファイルから読み込む」の 2 つのボタンを、保存・共有のボタンの近くに置く）。形式は `{ "tool": "<リポジトリ名>", "version": 1, "exportedAt": "<ISO 8601>", "data": { localStorage に保存しているものと同じ形 } }`、ファイル名は `<リポジトリ名>-backup-YYYYMMDD.json`。読み込むときは `tool` が自分のツールかを確かめ、中身はそのまま信じずにツールの既存の正規化（`normalize` など）を通し、上書きする前に確認を出す。ファイルは端末の中で作るだけで、どこにも送信しない。使い方ページの「ご利用上の注意・データの扱い」にも 1 行書く。理由: 需要調査（yorozu-plans の DEMAND.md 2 章）で、ストアの低評価レビューのうち「消えた・機種変更で引き継げない・バックアップ」が 750 件を超えていたため（2026-09-24 決定 D31）。書き出し・読み込みの関数とテストは yorozu-template の `calc.js`・`tests/backup.test.js` に入っている
21. **ほかのツールへの導線**（yorozu-plans の GROWTH.md）: 置くのは**結果が出た直後**だけで、1 画面に**最大 2 つ**。文言は「その結果を使って次にすること」（例:「日程が決まったら → 旅のしおりを作る」）。「関連ツール」「おすすめ」の枠は置かない。値を渡すときは `#` 以降で（11）、計算の前提が違う値（所得税と住民税の課税所得など）は渡さない。共有リンクで開いた画面には「自分のを新しく作る」を置く
22. **印刷物のクレジット**は `yorozu-craft.com/<リポジトリ名>/print/` の着地ページに向ける（紙から来た人を数えるため）。既定で表示し、設定で外せるようにする。着地ページは `noindex` にして sitemap に載せない
23. **英語版を持つときの決まり**（yorozu-plans の GLOBAL.md 3.2。2026-09-24 オーナー決定 D44・D46・D48〜D50）
   - 置き場は同じリポジトリの **`/<リポジトリ名>/en/`**（`en/index.html`、必要なら `en/guide.html`）。別ドメイン・`/en/<ツール>/` にはしない
   - `<html lang="en">`。**canonical は英語ページ自身**。`hreflang` で日英を**両方向**に結ぶ（日本語ページと英語ページの両方に同じ 3 行: `ja`・`en`・`x-default`＝日本語ページ）。対になるページどうしで、片方にだけ書かない

     ```html
     <link rel="alternate" hreflang="ja" href="https://yorozu-craft.com/<リポジトリ名>/">
     <link rel="alternate" hreflang="en" href="https://yorozu-craft.com/<リポジトリ名>/en/">
     <link rel="alternate" hreflang="x-default" href="https://yorozu-craft.com/<リポジトリ名>/">
     ```
   - 英語ページも sitemap.xml に載せる。画面の上の方に日英の切り替えリンク（`hreflang` と `lang` 付き）を置く
   - **英語版を足したら、英語のトップ `/en/index.html` の一覧に 1 行（`<li>`）足す**（リンクは `../<リポジトリ名>/en/`。説明は英語ページの冒頭の文から取る）。フッターのホームは英語のトップ（`../../en/`）に向ける
   - フッターの共通ページへのリンクは**英語の共通ページ**（`../../en/about.html`・`../../en/privacy-policy.html`）に向ける（15 と同じく相対パス）。日本語の共通ページには向けない
   - 制度の値・確認日など**日付のついた値は、日本語ページと同じ定数ファイル（`constants.js` など）から読む**。英語ページに値を書き写さない（値を 2 か所に持たない）
   - 名前は英語で検索される言い方にする（サジェストに出る語。例: "PAC file tester"）。romaji は本文で 1 回だけ併記する（"residence tax (juminzei)"）。学習者向けは日本語の語を見出しに残す
   - 英語は LLM で下書きし、オーナーが読んでから公開する（機械翻訳のまま出さない）。金額は円のまま（為替換算しない）
   - 要望フォームは同じ Google フォーム（8 の `entry.585564634=<リポジトリ名>`）。リンクに英語の注記を付ける（例: "Feedback form (Google Forms, in Japanese; you can write in English). We read every message but do not reply."）
   - AdSense（5）・Cloudflare ビーコン（6）の決まりは日本語ページと同じ（同じ自動広告、同じトークン）
   - 本体の UI が日本語のままなら、そのことを英語ページに明記し、画面の日本語ラベルと英語の意味の対応表を置く（例: pac-tester の `/en/`）
24. 最後に、このファイル冒頭の **URL 表にもツールの行を足す**

## AdSense

- publisher ID: `ca-pub-5375267956079717`
- `ads.txt` はドメイン直下にしか置けないため、全ツール分をこのリポジトリの1ファイルで兼ねる
- 各ページの `<head>` にタグが必要（トップページと各ツールの全ページ。上の「ツールを追加するとき」の 5 を参照）

## アクセス解析

- Cloudflare Web Analytics（Cookie 不使用）。Cloudflare ダッシュボード → Analytics & Logs → Web Analytics → `yorozu-craft.com` で閲覧
- DNS は DNS only（Cloudflare のプロキシを通さない）なので、自動挿入は効かない。各ページに手動でビーコンを入れる（上の「ツールを追加するとき」の 6）
- DNS の構成（2026-09-23 確認）: ルート `yorozu-craft.com` は GitHub Pages の A 4 件・AAAA 4 件（GitHub Docs が案内している正規の値）、`www` は `youheioonuki.github.io` への CNAME。**どちらもプロキシ OFF（灰色・DNS only）にする**。プロキシ ON にすると GitHub が Let's Encrypt の証明書を発行・更新できず、Enforce HTTPS が使えなくなる（www が一時 ON になっていたのを OFF に戻した）
- `404.html` にも入れているので、存在しない URL へのアクセス（リンク切れ）も集計される

## 共通化の方針（2026-09-23 決定。経緯は yorozu-plans の ROADMAP 3 章・6 章）

| 対象 | 決定 |
|---|---|
| 新しいツールの作り方 | 非公開の雛形リポジトリ `yorozu-template`（GitHub の Template repository）から作る。`<head>` の雛形（OGP・JSON-LD・AdSense・ビーコン・アイコン）、`guide.html`、`404.html`、`LICENSE`、`.nojekyll`、`test.yml`、PWA 用の `sw.js`・manifest は雛形に入っているので、上の手順のコード片を毎回コピーしなくてよい |
| ビルドスクリプト | 共通のビルドは持たない。素の HTML・CSS・JS をリポジトリ直下から公開する（単一 HTML へのビルドは撤回）。同梱ライブラリがあるツールだけ、必要なら `build.mjs` を持つ |
| 共通 CSS | ドメイン直下の共通 CSS は読まない（Service Worker が他ツールのファイルを自分のキャッシュに入れてしまうのを避けるため）。配色と `font-family` は雛形の `style.css` にコピーして持つ |
| OGP / JSON-LD | 雛形の `index.html`（`WebApplication`）と `guide.html`（`FAQPage`）で固定。`meta keywords`・`meta author` は入れない |
| 共通の確認テスト | このリポジトリの `tools/check-site.mjs` を GitHub Actions で週 1 回実行し、全ツールの公開ページを機械的に確かめる（下の「共通の確認テスト」） |
| フォント | 端末のフォント（「ツールを追加するとき」の 9。経緯は下） |

## 共通の確認テスト

### サイト横断チェック（`tools/check-site.mjs`）

本番の公開ページを巡回して、全ツールに共通の決まりを機械的に確かめる。`.github/workflows/check-site.yml` で**毎週月曜 9:00（日本時間）**に自動で実行し、失敗すると GitHub から通知メールが届く。Actions タブの「Run workflow」で手動実行もできる。

```bash
node tools/check-site.mjs                           # 本番 https://yorozu-craft.com/ を確認
node tools/check-site.mjs http://127.0.0.1:8000/    # ローカル配信を確認（404 の確認は GitHub Pages でしか正しく出ない）
```

確かめること:
- `robots.txt` の各 sitemap と、sitemap に載っている全ページが 200
- トップのツール一覧と `robots.txt` の sitemap が一致している
- 各ページ: AdSense の meta が 1 個・スクリプトが 1 個（全画面の本体は meta だけ）、手動・空の広告枠が無い、Cloudflare ビーコンがフッターの後に 1 個、canonical が自分の公開 URL、ツールのページは共通の運営者情報・プライバシーポリシーへリンクしている（noindex のページは省略）
- 英語ページ（`<html lang="en">`）: 共通ページへのリンクは英語版（`/en/about.html`・`/en/privacy-policy.html`）であること（日本語の共通ページへのリンクは NG）。`hreflang="ja"` の対のページがあり（200）、そのページが `hreflang="en"` でこのページの URL を指し返していること。`hreflang="x-default"` があること。逆に、日本語ページに `hreflang="en"` があれば、その英語ページが 200 で `hreflang="ja"` で指し返していること
- 英語の共通ページ（`/en/about.html`・`/en/privacy-policy.html`）と英語のトップ（`/en/`）は、ルートの sitemap.xml に載っていれば巡回する（ツールの英語ページは各ツールの sitemap に載せる）
- 英語のトップ（`/en/`）の一覧と、sitemap に `/<リポジトリ名>/en/` を載せているツールが一致している（英語版を足したのに英語のトップに載せ忘れた、またはその逆）。ルートの sitemap.xml に `/en/` が無いときは省略
- サイト内リンクがすべて存在する（リンク切れ）
- 印刷物の着地ページ（`/<リポジトリ名>/print/`）があれば: `noindex`、Cloudflare ビーコン 1 個、AdSense の meta 1 個
- 各ツール: 存在しない URL がツールの `404.html`（ビーコンあり）になる、`manifest.webmanifest` の `id` が `/<リポジトリ名>/`、`sw.js` のキャッシュ名が `<リポジトリ名>-` で始まる

決まりの例外（全画面の本体など）は、スクリプト冒頭の `META_ONLY_PAGES`・`NO_COMMON_LINK_PAGES` に理由つきで書く。

### Lighthouse の測り方

企画の受け入れ条件（Performance・Accessibility・SEO が各 90 以上）は、**広告なしのローカル配信**で測る。本番は広告とアクセス解析の分だけ下がる（2026-09-23 の記録: web-roulette はローカル 90・本番 78、shaho-check はローカル 99・本番 90）。

- Lighthouse 12、モバイル（既定の端末・通信の模擬）
- `python3 -m http.server` でツールのフォルダを配信し、3 回測った中央値を記録する
- hoshizora-sanpo のプラネタリウム本体は、独自のピンチズームのために `user-scalable=no` を付けている。Accessibility の減点は意図したもの

## フォント

オーナーの希望は Noto Sans JP でのサイト全体の統一だったが、**Web フォント（Google Fonts）は 2026-09-23 に実測して取りやめた**。ローカル配信・Lighthouse 12・モバイル・Performance のみで、main と導入版を同条件で比較:

| ページ | 導入前 | Google Fonts 導入（400/700・`display=swap`・CSS 同期読み込み） |
|---|---|---|
| web-roulette | 90（LCP 2.9s・342KiB） | **59**（LCP 6.7s・779KiB。うちフォント 447KB） |
| shaho-check | 99（LCP 2.1s・320KiB） | **83**（LCP 3.7s・953KiB。うちフォント 648KB） |

日本語フォントは文字集合が大きく、Google Fonts の分割配信でもページに出る文字の分だけで 450〜650KB になる。企画の受け入れ条件（Performance 90 以上）を満たせないので、Web フォントは使わず `font-family` の並びだけ揃える。非同期読み込みと `display=optional` は測っていない（optional は初回訪問が端末フォントになり「統一」にならないので、測る前に取りやめた）。本番 URL での導入前の値は web-roulette 78・shaho-check 90（同日。ローカルより低いのは配信経路と広告の分）。
