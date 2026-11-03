// 広告なしの画面の一覧（META_ONLY）。正本はここ 1 か所で、check-site.mjs と yorozu-plans の tools/content/classes.mjs（content-classes.csv の「広告」列、D459）が import する。
// check-site.mjs から切り出した（2026-11-03。check-site は読み込むだけで本番の巡回が走るため、ほかから import できない）
// 全画面で操作するツール本体は、広告スクリプトを入れず所有確認の meta だけ（README「ツールを追加するとき」5）
export const META_ONLY_PAGES = new Set([
  '/hoshizora-sanpo/',     // プラネタリウムの全画面の本体
  '/todofuken-quiz/',      // こどもが遊ぶ画面（決定 D18: 広告は保護者向けの guide.html だけ）
  '/bingo/',               // 会場で大画面に映す抽選画面（広告はカード印刷・使い方のページ）
  '/easy-split/quick/',    // 割り勘のスマホ版（K176）。縦 1 画面（390×844）に収める画面なので広告を置かない。広告はいつもの版・使い方のページ
  '/gakushu-print/anki/',  // 暗記カード（作る・めくるが同じ画面。D201。広告は使い方ページ）
  '/gakushu-print/tokei/', // 時計の読み方（こどもが遊ぶ画面）
  '/seido-keisan/en/high-cost-medical/', '/seido-keisan/en/high-cost-medical/guide.html', // 高額療養費の英語版（日本語版に合わせて広告なし）
  '/lifeplan/',             // ライフプランの画面（D258。使い方ページは広告あり）
  '/web-metronome/drum/',  // ドラムマシン（ピアノと同じ扱い。D233）
  '/quiz-hiroba/mainichi/', // 毎日 1 問（こどもも遊ぶ画面。D246）
  '/bingo/en/',            // 同上の英語版
  '/hoshizora-sanpo/en/',  // プラネタリウムの全画面の本体（英語版）
  '/gengo/kaiki/',         // 回忌の計算（遺族が使う。広告なし: D118・D119）
  '/gengo/kaiki/guide.html',
  '/quiz-hiroba/',         // クイズ広場の入口と遊ぶ画面（D122: 広告は使い方ページだけ）
  '/quiz-hiroba/genso/',
  '/quiz-hiroba/nengo/',
  '/quiz-hiroba/hyakunin/', // 百人一首の読み上げ画面（D131）
  '/quiz-hiroba/hyakunin/guide.html', // 介護向けの入口に載せる道具なので使い方ページも広告なし（D191）
  '/quiz-hiroba/kimariji/', // 決まり字クイズ（遊ぶ画面。D191 で確認: 専用の使い方ページは無く、使い方は /quiz-hiroba/guide.html）
  '/quiz-hiroba/shuto/',
  '/quiz-hiroba/kokki/',   // 国旗クイズ（遊ぶ画面）
  '/quiz-hiroba/hayaoshi/', // 早押しボタン（D157: 広告は使い方ページだけ）
  '/quiz-hiroba/showa/',   // 昭和クイズ・回想法カード（高齢者向け D118・D155: 使い方ページも広告なし）
  '/quiz-hiroba/showa/guide.html',
  '/tameshite/mimi/',       // ためして: 測る画面（D158: 広告は使い方ページと一覧だけ）
  '/tameshite/hansha/',
  '/tameshite/doutai/',
  '/tameshite/kioku/',
  '/tameshite/roogan/',     // 老眼チェック（高齢者向け D118・D159: 使い方ページも広告なし）
  '/tameshite/roogan/guide.html',
  '/unplugged/try.html',    // 子どもがロボットを動かす画面（D164）
  '/gakko-keisan/timer/',  // 子どもが使う画面（D138: 広告は使い方ページだけ）
  '/gakko-keisan/atonannichi/',
  '/web-metronome/piano/', // 全画面の鍵盤（弾く画面。広告は使い方ページだけ）
  '/gakushu-print/kuku/',  // 子どもが遊ぶ画面（D140: 広告は使い方ページだけ）
  '/gakushu-print/romaji/',
  '/seido-keisan/nenkin-kuriage/', // 高齢者向け（D118・D146: 広告なし）
  '/seido-keisan/nenkin-kuriage/guide.html',
  '/seido-keisan/kogaku-ryoyohi/',
  '/seido-keisan/kogaku-ryoyohi/guide.html',
  '/for/kaigo/',           // 介護・デイサービス向けの入口（高齢者向け D118・GROWTH 10 章: 広告なし）
  '/line/',                // LINE 版の案内（節「親・家族のために」。/for/kaigo/ と同じ扱い: yorozu-plans 企画書 76）
  '/post/',                // 要望の投書箱（yorozu-plans 企画書 77）
  '/updates/',             // 更新情報（案内のページ。about と同じ扱いで道具の 4 つは求めない: yorozu-plans D411）
]);
// 配下のページをすべて meta だけにするパス（高齢者・親向けは広告なし: yorozu-plans D118）
// 日本語版の無い英語だけのページ（hreflang は en と x-default の自己参照だけ。D248）
const EN_ONLY_PAGES = new Set([
  '/seido-keisan/en/moving-checklist/', '/seido-keisan/en/moving-checklist/guide.html',
  '/tameshite/en/sleep-calculator/', '/tameshite/en/sleep-calculator/guide.html',
]);
export const META_ONLY_PREFIXES = ['/otasuke/', '/hoshizora-night/', '/hade/']; // hoshizora-night はフル版で全ページ広告なし（7.15 の 2）。hade はド派手版で、偽の警告の演出は AdSense の規約に触れるので全ページ広告なし（D303）
export const isMetaOnly = (p) => META_ONLY_PAGES.has(p) || META_ONLY_PREFIXES.some((x) => p.startsWith(x));
