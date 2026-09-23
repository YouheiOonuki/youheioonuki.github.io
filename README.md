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
| https://yorozu-craft.com/web-metronome/ | [web-metronome](https://github.com/YouheiOonuki/web-metronome) |
| https://yorozu-craft.com/hoshizora-sanpo/ | [hoshizora-sanpo](https://github.com/YouheiOonuki/hoshizora-sanpo) |

## ファイル

| ファイル | 役割 |
|---------|------|
| `index.html` | ツール一覧のトップページ |
| `404.html` | 存在しない URL を開いたときのページ（全ツール共通） |
| `CNAME` | 独自ドメインの設定。消すとドメインが外れるので注意 |
| `robots.txt` | 検索エンジン向けの指示。**ドメイン直下のものしか読まれない**ので、全ツールのサイトマップをここに並べる |
| `sitemap.xml` | トップページのサイトマップ |
| `favicon.svg` / `favicon-32.png` / `apple-touch-icon.png` | yorozu-craft のマーク「万」。トップページ・共通ページ・404 のタブのアイコン（PNG は SVG 非対応のブラウザ用と、iPhone のホーム画面用）。各ツールのアイコンはツールごとに持つ |
| `about.html` / `privacy-policy.html` | **全ツール共通**の運営者情報・免責事項 / プライバシーポリシー。ツール名を出さない書き方にしてあり、ツールを追加しても直さない（これまでに無い種類の機能を持つツールを作るときだけ追記。「ツールを追加するとき」の 8） |
| `legal.css` | 上の2ページのスタイル |
| `ads.txt` | AdSense の販売者情報。ドメイン直下に1つだけ置く（全ツール共通） |

## ツールを追加するとき

1. ツール用のリポジトリを作り、Settings → Pages で `main` / `(root)` を公開する
2. `index.html` の `<ul class="tools">` にある `<li>` を複製し、リンク先・アイコン・説明を書き換える（便利ツールは「ツール一覧」、プラネタリウムのような学び・遊びは「まなび・あそび」の見出しに入れる）
3. `robots.txt` に `Sitemap: https://yorozu-craft.com/<リポジトリ名>/sitemap.xml` を追加する
4. ツール側の canonical / OGP の URL は `https://yorozu-craft.com/<リポジトリ名>/` にする
5. ツールの**全ページの `<head>` に AdSense のタグを入れる**（審査とドメインの確認は済んでいるので、ツールごとの申請は不要）。
   ただし、全画面で操作するツール本体（例: hoshizora-sanpo のプラネタリウム画面）は、自動広告が操作ボタンを隠さないよう `<meta name="google-adsense-account">` だけにして、広告は図鑑・使い方などの読みものページで出す

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
   - 共通ページはツール名を出さない書き方にしてある（「一部のツールは〜」）。次のような**これまでに無い種類の機能**を持つツールを作るときだけ、共通ページに一般的な1文を足す：アカウント登録・ログイン、サーバーへのデータ送信やファイルのアップロード、マイク・カメラなど位置情報以外の端末機能、決済、外部サービスとの連携、Cookie を使う仕組み

## AdSense

- publisher ID: `ca-pub-5375267956079717`
- `ads.txt` はドメイン直下にしか置けないため、全ツール分をこのリポジトリの1ファイルで兼ねる
- 各ページの `<head>` にタグが必要（トップページと各ツールの全ページ。上の「ツールを追加するとき」の 5 を参照）

## アクセス解析

- Cloudflare Web Analytics（Cookie 不使用）。Cloudflare ダッシュボード → Analytics & Logs → Web Analytics → `yorozu-craft.com` で閲覧
- DNS は DNS only（Cloudflare のプロキシを通さない）なので、自動挿入は効かない。各ページに手動でビーコンを入れる（上の「ツールを追加するとき」の 6）
- `404.html` にも入れているので、存在しない URL へのアクセス（リンク切れ）も集計される
