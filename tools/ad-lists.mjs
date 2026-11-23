// 広告の script を置かない集合の正本はここ 1 か所で、check-site.mjs と yorozu-plans の tools/content/classes.mjs（content-classes.csv の「広告」列、D459）が import する。
// check-site.mjs から切り出した（2026-11-03。check-site は読み込むだけで本番の巡回が走るため、ほかから import できない）
// 集合は 2 つで、意味が違う（yorozu-plans D898）。どちらのページも広告スクリプトを入れず所有確認の meta だけ（README「ツールを追加するとき」5）
//   META_ONLY_PAGES・META_ONLY_PREFIXES … 約束。広告を置かないと決めている画面（全画面の本体・子ども・高齢者・親と家族向け・ド派手版）。ページが「広告なし」と名乗れる。承認の後も変わらない
//   REVIEW_HOLD_PAGES                    … 待ち。今は script を外しているだけ（道具の画面・文の薄いページ・審査員の目で外したページ・入口と案内）。「広告なし」と名乗れない（check-site が止める）。
//                                          承認の後に戻すかは、その時に決める。入口・案内・/print/ は戻さない
const NO_AD_SCREENS = [
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
  '/line/',                // LINE 版の案内（節「このサイト」。元は「親・家族のために」。/for/kaigo/ と同じ扱い: yorozu-plans 企画書 76）
  '/post/',                // 要望の投書箱（yorozu-plans 企画書 77）
  '/updates/',             // 更新情報（案内のページ。about と同じ扱いで道具の 4 つは求めない: yorozu-plans D411）
];
// 約束の集合（D898）。広告を置かないと決めている画面で、ページが「広告なし」と名乗れる
export const META_ONLY_PAGES = new Set(NO_AD_SCREENS);
// 子どもが使う画面（遊ぶ画面）。check-site の「外部リンク〈GitHub・X・note〉を置かない」（REVIEW C7 R7）はこの集合に掛ける。
// 上の一覧の使い方ページ以外（D882・Q-1119）
export const CHILD_SCREEN_PAGES = new Set(NO_AD_SCREENS.filter((p) => !p.endsWith('guide.html')));
// 配下のページをすべて meta だけにするパス（高齢者・親向けは広告なし: yorozu-plans D118）
export const META_ONLY_PREFIXES = ['/otasuke/', '/hoshizora-night/', '/hade/']; // hoshizora-night はフル版で全ページ広告なし（7.15 の 2）。hade はド派手版で、偽の警告の演出は AdSense の規約に触れるので全ページ広告なし（D303）
export const isMetaOnly = (p) => META_ONLY_PAGES.has(p) || META_ONLY_PREFIXES.some((x) => p.startsWith(x));

// 下は check-site.mjs から移した（Q-1118。yorozu-plans の content-classes.csv の「広告」列が、check-site と同じ集合の全部を読むため。D882）。
// 前の名前は REVIEW_NO_AD_PAGES（check-site の中だけの名前）
// 待ちの集合（D898）。AdSense 審査が通るまで本文の薄いページは広告 script を外す（2026-10-04）。通ったら本文を足したページから戻す
// 広告 script の数（下の「script が 0 か 1 か」）だけでこの集合を「script 0」とみなす。「広告なし」の定型文・高齢者・子どもの外部リンクの判定には混ぜない
export const REVIEW_HOLD_PAGES = new Set([
  '/for/teachers/', '/for/it/',
  '/web-roulette/', '/web-roulette/amida/', '/web-roulette/dice/',
  '/easy-split/', '/easy-split/kakeibo/',
  '/web-metronome/', '/web-metronome/capo/',
  '/hoshizora-sanpo/zukan/', '/hoshizora-sanpo/zukan/leo.html', '/hoshizora-sanpo/zukan/vir.html', '/hoshizora-sanpo/zukan/uma.html', '/hoshizora-sanpo/zukan/boo.html', '/hoshizora-sanpo/zukan/lib.html', '/hoshizora-sanpo/zukan/sco.html', '/hoshizora-sanpo/zukan/sgr.html', '/hoshizora-sanpo/zukan/cyg.html', '/hoshizora-sanpo/zukan/lyr.html', '/hoshizora-sanpo/zukan/aql.html', '/hoshizora-sanpo/zukan/oph.html', '/hoshizora-sanpo/zukan/crb.html', '/hoshizora-sanpo/zukan/her.html', '/hoshizora-sanpo/zukan/dra.html', '/hoshizora-sanpo/zukan/cap.html', '/hoshizora-sanpo/zukan/aqr.html', '/hoshizora-sanpo/zukan/psc.html', '/hoshizora-sanpo/zukan/ari.html', '/hoshizora-sanpo/zukan/peg.html', '/hoshizora-sanpo/zukan/and.html', '/hoshizora-sanpo/zukan/per.html', '/hoshizora-sanpo/zukan/ori.html', '/hoshizora-sanpo/zukan/tau.html', '/hoshizora-sanpo/zukan/gem.html', '/hoshizora-sanpo/zukan/cnc.html', '/hoshizora-sanpo/zukan/cma.html', '/hoshizora-sanpo/zukan/cmi.html', '/hoshizora-sanpo/zukan/aur.html', '/hoshizora-sanpo/zukan/umi.html', '/hoshizora-sanpo/zukan/cas.html', '/hoshizora-sanpo/zukan/cru.html', '/hoshizora-sanpo/zukan/cen.html', '/hoshizora-sanpo/shinwa/seiza/', '/hoshizora-sanpo/hayamiban/', '/hoshizora-sanpo/tsuki/', '/hoshizora-sanpo/en/planisphere/',
  '/loan-sim/', '/loan-sim/kinri/',
  '/nittei-kouho/',
  '/denki-dai/',
  '/seido-keisan/nenmatsu/', '/seido-keisan/nenmatsu/hoken/', '/seido-keisan/gensen/', '/seido-keisan/juminzei/', '/seido-keisan/ikukyu/', '/seido-keisan/shobyo/', '/seido-keisan/iryohi/', '/seido-keisan/iryohi/meisai/', '/seido-keisan/koko-mushoka/', '/seido-keisan/lifeplan/', '/seido-keisan/dattai-ichiji/', '/seido-keisan/en/', '/seido-keisan/invoice/', '/seido-keisan/shienkin/', '/seido-keisan/yobosesshu/', '/seido-keisan/hikkoshi/',
  '/tabi-shiori/',
  '/gakushu-print/en/', '/gakushu-print/booklet/', '/gakushu-print/angou/',
  '/bingo/cards.html', '/bingo/en/cards.html',
  '/filetime/', '/filetime/en/',
  '/gengo/', '/gengo/en/', '/gengo/gakunen/', '/gengo/gakunen/rireki.html', '/gengo/yakudoshi/', '/gengo/en/school-grades/', '/gengo/nenpyo/',
  '/furigana/', '/furigana/en/',
  '/toban/', '/toban/group/', '/toban/kondate/',
  '/gakko-keisan/', '/gakko-keisan/naishin/', '/gakko-keisan/hensachi/', '/gakko-keisan/shusseki/',
  '/quiz-hiroba/mainichi/guide.html',
  '/fitbit-export/', '/fitbit-export/en/',
  '/tameshite/',
  '/unplugged/', '/unplugged/en/',
  '/henkan/', '/henkan/diff/', '/henkan/json/', '/henkan/csv/', '/henkan/zenkaku/', '/henkan/pdf/',
  '/ai-log/', '/ai-log/en/',
  // AdSense の審査員の目でページごとに判定し、広告を外した 16 枚（yorozu-plans ROADMAP 7.269・D863・Q-1093）。子どもの画面ではない（D882）。
  // 約束（META_ONLY）の側に置いていたが、D863 は「承認の後に戻すかは、その時に決める」なので待ちの側（D898・Q-1137。どのページも「広告なし」と名乗っていない）。道具の画面 9 枚
  '/sekigae/', '/shaho-check/', '/gakushu-print/', '/toban/en/',
  '/seido-keisan/en/childcare-leave/', '/seido-keisan/en/moving-checklist/', '/seido-keisan/en/pension-refund/', '/seido-keisan/en/residence-tax/', '/seido-keisan/en/take-home-pay/',
  // 同じく読み物と使い方 7 枚
  '/hoshizora-sanpo/shinwa/', '/hoshizora-sanpo/shinwa/keizu.html', '/hoshizora-sanpo/shinwa/hyoki.html',
  '/hoshizora-sanpo/calendar/new-moon.html', '/hoshizora-sanpo/en/calendar/new-moon.html',
  '/web-roulette/odai/', '/tameshite/kioku/guide.html',
  '/print/',               // 無料の印刷物のセット（K173）。介護施設に配る案内のページで、広告を置かない
  // ナビゲーション・運営情報の画面（Google のポリシー「ナビゲーション・アラート目的の画面には広告を置かない」に合わせる。2026-10-04）
  '/', '/all/', '/en/', '/about.html', '/privacy-policy.html', '/en/about.html', '/en/privacy-policy.html',
]);
// 広告の script が在るページか。script を置かない集合の全部（META_ONLY・その配下・REVIEW_HOLD）の外なら在る。check-site の「script が 0 か 1 か」と同じ集合（Q-1118）
export const hasAdScript = (p) => !isMetaOnly(p) && !REVIEW_HOLD_PAGES.has(p);
