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

## ファイル

| ファイル | 役割 |
|---------|------|
| `index.html` | ツール一覧のトップページ |
| `404.html` | 存在しない URL を開いたときのページ（全ツール共通） |
| `CNAME` | 独自ドメインの設定。消すとドメインが外れるので注意 |
| `robots.txt` | 検索エンジン向けの指示。**ドメイン直下のものしか読まれない**ので、全ツールのサイトマップをここに並べる |
| `sitemap.xml` | トップページのサイトマップ |
| `favicon.svg` | ファビコン |
| `ads.txt` | AdSense の販売者情報。ドメイン直下に1つだけ置く（全ツール共通） |

## ツールを追加するとき

1. ツール用のリポジトリを作り、Settings → Pages で `main` / `(root)` を公開する
2. `index.html` の `<ul class="tools">` にある `<li>` を複製し、リンク先・アイコン・説明を書き換える
3. `robots.txt` に `Sitemap: https://yorozu-craft.com/<リポジトリ名>/sitemap.xml` を追加する
4. ツール側の canonical / OGP の URL は `https://yorozu-craft.com/<リポジトリ名>/` にする
5. ツールの**全ページの `<head>` に AdSense のタグを入れる**（審査とドメインの確認は済んでいるので、ツールごとの申請は不要）

   ```html
   <meta name="google-adsense-account" content="ca-pub-5375267956079717">
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5375267956079717"
        crossorigin="anonymous"></script>
   ```
6. ツールの**全ページの `</body>` 直前に Cloudflare Web Analytics のビーコンを入れる**（トークンはドメイン共通なので、そのまま同じものを使う）。あわせて、ツールのプライバシーポリシーに Cloudflare Web Analytics を使っていることを書く

   ```html
   <!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "b79bf821e1fd4b6683866d493b1de426"}'></script><!-- End Cloudflare Web Analytics -->
   ```

## AdSense

- publisher ID: `ca-pub-5375267956079717`
- `ads.txt` はドメイン直下にしか置けないため、全ツール分をこのリポジトリの1ファイルで兼ねる
- 各ページの `<head>` にタグが必要（トップページと各ツールの全ページ。上の「ツールを追加するとき」の 5 を参照）

## アクセス解析

- Cloudflare Web Analytics（Cookie 不使用）。Cloudflare ダッシュボード → Analytics & Logs → Web Analytics → `yorozu-craft.com` で閲覧
- DNS は DNS only（Cloudflare のプロキシを通さない）なので、自動挿入は効かない。各ページに手動でビーコンを入れる（上の「ツールを追加するとき」の 6）
- `404.html` にも入れているので、存在しない URL へのアクセス（リンク切れ）も集計される
