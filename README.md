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

## ファイル

| ファイル | 役割 |
|---------|------|
| `index.html` | ツール一覧のトップページ |
| `404.html` | 存在しない URL を開いたときのページ（全ツール共通） |
| `CNAME` | 独自ドメインの設定。消すとドメインが外れるので注意 |
| `robots.txt` | 検索エンジン向けの指示。**ドメイン直下のものしか読まれない**ので、全ツールのサイトマップをここに並べる |
| `sitemap.xml` | トップページのサイトマップ |
| `favicon.svg` | ファビコン |

## ツールを追加するとき

1. ツール用のリポジトリを作り、Settings → Pages で `main` / `(root)` を公開する
2. `index.html` の `<ul class="tools">` にある `<li>` を複製し、リンク先・アイコン・説明を書き換える
3. `robots.txt` に `Sitemap: https://yorozu-craft.com/<リポジトリ名>/sitemap.xml` を追加する
4. ツール側の canonical / OGP の URL は `https://yorozu-craft.com/<リポジトリ名>/` にする

## AdSense

審査に通ったら、発行される `ads.txt` をこのリポジトリの直下に置く（ドメイン直下にしか置けないため、全ツール共通でここに1つ）。
