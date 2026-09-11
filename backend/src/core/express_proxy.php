<?php

/**
 * 移植済みリクエストを ② VPS の Express へ転送する。
 *
 * ─────────────────────────────────────────────
 * なぜ ① から ② へ転送するのか（フロントを ② に向けないのか）
 *
 *   フロントを直接 ② に向けると、② が落ちた瞬間にダッシュボード全体が
 *   止まる。移植済みが1件で185件が転送という比率でも、通り道が ② なので
 *   全部が止まる。単一障害点が増える。
 *
 *   ① を入口のままにすれば
 *     ・切り戻しはこのファイルの許可リストを空にするだけ（数秒）
 *     ・CORS の設定変更が不要（ブラウザから見た通信先は今と同じ）
 *     ・② が落ちても、下のフォールバックで ① 自身の処理に切り替わる
 *
 *   移植が大半終わった段階で、フロントを ② に向ける方式へ移ればよい。
 *   その時点なら余分な1往復も解消できる。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 転送に失敗したら ① 自身のPHPで処理する（自動フォールバック）。
 *   そのため「同じ処理が2回実行されうる」。
 *   **書き込みを行うリクエストを許可リストに入れてはならない。**
 *   ② が処理を完了した直後に応答が失われると、① でも実行されて
 *   二重登録・二重更新になる。
 */

// ---------------------------------------------------------------------------
// 転送先
//
// ⚠️ ② VPS のゲートウェイURL。① 自身のURLを書くと無限ループになる。
//   .htaccess の SetEnv で上書きできる（環境ごとに変えたい場合）。
// ---------------------------------------------------------------------------
const EXPRESS_API_URL_DEFAULT = 'https://api.khg-marketing.info/api/gateway';

/**
 * ② へ転送する許可リスト。
 *
 * 書き方は3通り。用途に応じて使い分ける。
 *
 *   'menu'                   … request だけで判定する（roll / category を問わない）
 *   'property:suumo'         … request と roll が一致したときだけ
 *   'database:gift:order'    … request / roll / category がすべて一致したときだけ
 *
 * ⚠️ **roll で分岐するハンドラは、移植した roll だけを書くこと。**
 *   request だけで書くと、未移植の roll も ② へ送られる。
 *   ② は未登録として 502 を返し、① が自動フォールバックするので動きはするが、
 *   **リクエストのたびに無駄な往復とエラーログが発生する**。
 *
 * ⚠️ **参照のみのリクエストだけを書くこと。** 上記の二重実行の理由による。
 *
 * ⚠️ ここを空配列にすれば全リクエストが ① 自身の処理に戻る。
 *   移植で問題が起きたときの切り戻しは、該当行をコメントアウトするだけ。
 *
 * @return string[]
 */
function expressProxyRequests(): array
{
    return [
        // 2026-09-02 移植。いずれも ② のコンテナ内で差分比較を行い、
        // バイト単位で一致することを確認済み
        'menu',
        'header',
        'update_log',
        'callStatusList',

        // 2026-09-02 移植。KPI分析の参照系のみ。
        //
        // ⚠️ kpi_analyze（Claude API呼び出し＋INSERT）と
        //   kpi_analysis_delete（DELETE）は**絶対に追加しないこと。**
        //   自動フォールバックにより二重課金・履歴の二重INSERTが起きる。
        //
        // ⚠️ これらは ② 側で auth: 'master' を宣言しているため、
        //   Token ヘッダの引き継ぎ（下の forwardToExpress）が必須。
        'kpi_filter_master',
        'kpi_analysis_list',
        'kpi_analysis_get',

        // 2026-09-03 移植。roll = 'suumo' のみ。
        // ⚠️ 'property' と書かないこと。list / detail は未移植。
        'property:suumo',

        // 2026-09-03 移植。K-SNAP の参照系のみ。
        //
        // ⚠️ 'k-snap' は公開ギャラリー向け（owner を暗号化）。
        //   ② に KSNAP_OWNER_KEY / KSNAP_OWNER_IV が設定されていないと
        //   owner が空文字になり、顧客側の絞り込みが壊れる。
        //   鍵を消す・変える場合はこの行も外すこと。
        //
        // ⚠️ 以下は**絶対に追加しないこと。** 書き込み系のため、
        //   自動フォールバックで二重実行される。
        //     k-snap_update          … 画像アップロード（そもそも ② では動かない）
        //     k-snap_show            … UPDATE
        //     k-snap_customer_update … INSERT / UPDATE
        'k-snap',
        'k-snap_edit',
        'k-snap_load',
        'k-snap_customer',
        'kSnap',

        // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
        // request 形式へ移したもの。
        //
        // ⚠️ 公開ギャラリー（顧客向け）も使っている。
        //   認証を要求すると顧客側が止まる。
        'shop_list',

        // -----------------------------------------------------------------
        // 2026-09-03 新規。Instagram 公式アンバサダー管理。
        //
        // ⚠️⚠️ **移植ではなく、最初から Express のみで実装した機能である。**
        //   PHPハンドラが存在しないため、上記の「書き込み系を入れてはいけない」
        //   という制約が**当てはまらない。**
        //
        //   ① が自動フォールバックしても実行するPHPが無く、404 になるだけで
        //   二重実行にならない。そのため insert / update / sync も含めて
        //   request 名だけで許可してよい。
        //
        // ⚠️ 逆に、この機能に**PHPハンドラを作ってはいけない。**
        //   作った瞬間に二重実行の危険が生まれる。
        //
        // ⚠️ ② が落ちるとこの画面だけ動かなくなる（フォールバック先が無い）。
        //   他の画面には影響しない。
        // -----------------------------------------------------------------
        'ambassador_list',
        'inquiry_ambassador',
        'ambassador_master',

        // ⚠️ ambassador_inquiry（公開フォームからの反響受付）は**入れない。**
        //   フォームは ② を直接叩くため、① を経由しない。
        //   ここに入れても使われず、① 経由で叩ける口を増やすだけになる。

        // -----------------------------------------------------------------
        // 2026-09-06 新規。お友達紹介キャンペーンの反響管理。
        //
        // 上のアンバサダーと同じ理由で、書き込み系（update / sync）を
        // 含めて許可してよい。PHPハンドラが存在しないため、
        // 自動フォールバックしても 404 になるだけで二重実行にならない。
        //
        // ⚠️⚠️ **`introductory`（GAS からの反響受付）は入れないこと。**
        //   こちらは ① に **PHPハンドラが実在する**
        //   （backend/src/handlers/introductory.php）。② 側に同名の実装は
        //   無いため、入れても転送されず意味が無い。
        //   仮に ② 側にも実装した場合は、自動フォールバックで二重実行の
        //   経路ができる（今は dedupKey の UNIQUE キーが効くので重複行には
        //   ならないが、その防御に頼る構成にしてはいけない）。
        //   名前が似ているだけの別物である。
        //     introductory         … ① の PHP が処理する（受付）  ← 入れない
        //     inquiry_introductory … ② の Express が処理する（画面）← 入れる
        // -----------------------------------------------------------------
        'inquiry_introductory',

        // -----------------------------------------------------------------
        // 2026-09-07 移植。顧客詳細モーダルの初期データ（参照のみ）。
        //
        // ⚠️⚠️ **category を明示した3件だけを書くこと。**
        //   `'information'` と request だけで書いてはいけない。
        //   この request は roll で書き込み系に分岐するため、
        //   request だけで許可すると以下がすべて ② へ送られる。
        //
        //     customer_info        … master_data の upsert
        //     update_call_log      … call_sheet の upsert
        //     update_interview_log … interview_sheet の upsert
        //     log                  … master_data_log への INSERT
        //
        //   これらは ① にPHPハンドラが実在するため、② が処理を完了した
        //   直後に応答が失われると ① でも実行され**二重登録**になる。
        //
        // ⚠️ customer_info は multipart/form-data で送られてくるため、
        //   そもそも上の shouldProxyToExpress() が転送を拒否する。
        //   ただし「拒否されるから安全」に頼らず、許可リストにも入れない。
        //
        // 書き方は 'request:roll:category'。roll 無しは空にする
        'information::order',
        'information::spec',
        'information::used',

        // -----------------------------------------------------------------
        // 2026-09-07 移植。家族情報（FamilyInfo.tsx）。
        //
        // 旧API（dashboard/api/ の demand 形式）から request 形式へ移したもの。
        //
        // ⚠️⚠️ 現行 backend/ に **PHPハンドラが存在しない**（旧APIの実体は
        //   リポジトリ管理外。backup/back/20260625/ にバックアップのみ）。
        //   そのためアンバサダー／紹介キャンペーンと同じ扱いになり、
        //   書き込み（roll = 'update'）を含めて request 名だけで許可してよい。
        //   ① が自動フォールバックしても実行するPHPが無く、404 になるだけで
        //   二重実行にならない。
        //
        // ⚠️ 逆に、`backend/src/handlers/family_info.php` を
        //   **作ってはいけない。** 作った瞬間に二重実行の危険が生まれる。
        //
        // ⚠️ ② が落ちると家族情報モーダルだけが動かなくなる。
        //   顧客詳細の他の項目には影響しない。
        // -----------------------------------------------------------------
        'family_info',

        // -----------------------------------------------------------------
        // 2026-09-08 新規。AIデジタル資金計画書。
        //
        // 家族情報と同じく ① に **PHPハンドラが存在しない**ため、
        // 書き込み（roll = 'save'）を含めて request 名だけで許可してよい。
        //
        // ⚠️ `backend/src/handlers/funding_plan.php` を**作ってはいけない。**
        //
        // ⚠️⚠️ save は **master_data も更新する**（年収・自己資金・家賃・
        //   光熱費・月々支払・土地予算・希望坪数の7項目）。
        //   ② が処理を完了した直後に応答が失われても、① には実行するPHPが
        //   無いため二重実行にはならない。
        //   ⚠️ ただし将来 ① 側に同名のハンドラを作ると、
        //     **顧客台帳が二重に書き換わる**経路ができる。
        // -----------------------------------------------------------------
        'funding_plan',

        // -----------------------------------------------------------------
        // 2026-09-09 新規。集客サマリー（header/EventSummary.tsx）。
        //
        // ⚠️ 参照のみ（event_calendar / event_db / master_data / budget）。
        // ⚠️ ① に PHPハンドラが存在しないため、転送に失敗すると 404 になる。
        //   `backend/src/handlers/event_summary.php` を**作ってはいけない。**
        // -----------------------------------------------------------------
        'event_summary',

        // -----------------------------------------------------------------
        // 2026-09-09 移植。反響一覧の初期データ（ListOrder / ListKaeru / ListResale）。
        //
        // ⚠️ 参照のみ。転送に失敗したら ① で処理してよい。
        //
        // ⚠️ `list` は roll でも分岐する。**すべて ② に登録済み**
        //   （参照 / insert / black / tag / shop_change / staff_change / event）。
        //
        // ⚠️⚠️ **roll を1つでも登録し忘れると ② が「ループ検知」で 502 を返す。**
        //   2026-09-10 に `roll = 'event'` の登録漏れで実際に起きた。
        //   ① がフォールバックするので画面は動くが、
        //   往復が無駄になり ① と ② の両方のログが汚れる。
        //   ⚠️ 症状: ② のログに
        //     「ループ検知: ① から転送された "list" が ② に未登録です」
        //   ⚠️ roll を追加するときは ② の registry.ts への登録を先に済ませること。
        //
        // ⚠️ 書き込み系の roll は expressProxyExclusive() にも入れている。
        //   ⚠️ ただし `event` は入れていない（update が冪等なため）。
        //     理由は backend-express/src/features/list/event.ts のコメント参照。
        // -----------------------------------------------------------------
        'list',

        // -----------------------------------------------------------------
        // 2026-09-09 移植。店舗別動向（ShopTrendOrder / ShopTrendKaeru /
        // ShopTrendResale）。
        //
        // ⚠️ 参照のみ。roll で分岐しないので request 名だけで書いてよい。
        // -----------------------------------------------------------------
        'shopTrend',

        // -----------------------------------------------------------------
        // 2026-09-09 新規。集客イベントの広告費入力（header/EventBudget.tsx）。
        //
        // ⚠️ ① に PHP ハンドラが存在しない。書き込み（roll = 'save'）も
        //   request 名だけで許可してよい（転送失敗時は 404 になるだけ）。
        // ⚠️ `backend/src/handlers/event_budget.php` を**作ってはいけない。**
        //   budget には UNIQUE キーが無く、二重実行で同じ行が2組できる。
        // -----------------------------------------------------------------
        'event_budget',

        // -----------------------------------------------------------------
        // 2026-09-09 移植。ランク管理（RankOrder / RankKaeru / RankResale）と
        // 商談ステップ（InterviewLog）。
        //
        // ⚠️⚠️ いずれも ① に PHP ハンドラが**実在する**（消していない）。
        //   この配列から外せば即座に ① の処理へ戻る。
        //
        // ⚠️⚠️ `rank` は**1つの request で参照と書き込みを兼ねる**。
        //   書き込みのときだけフォールバックを禁止する仕組みを
        //   isExclusiveToExpress() に入れている（rankRequestIsWrite）。
        //   参照は ① にフォールバックしてよい。
        // -----------------------------------------------------------------
        'rank',
        'interviewLog',
        'interviewLog_update_interview',
        'contract_ex_update',

        // -----------------------------------------------------------------
        // 2026-09-10 移植。会社実績（company/Company.tsx）。
        //
        // ⚠️⚠️ どちらも ① に PHP ハンドラが**実在する**（消していない）。
        //   この配列から外せば即座に ① の処理へ戻る。
        //
        // ⚠️ `company` は参照のみ。転送に失敗したら ① で処理してよい。
        // ⚠️⚠️ `change_company_achievement` は**書き込み**なので、
        //   expressProxyExclusive() にも入れている。
        //   入れないと転送失敗時に ① でも実行され、
        //   company_achievement の upsert が二重に走る。
        //
        // ⚠️ `company` の SELECT は shop_list.parent_shop を参照する。
        //   backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql を
        //   **先に実行しておくこと。** 列が無いと ② 側のクエリが落ち、
        //   フォールバックで ① に戻る（画面は動くが Express を経由しない）。
        // -----------------------------------------------------------------
        'company',
        'change_company_achievement',

        // -----------------------------------------------------------------
        // 2026-09-11 移植。販促媒体別動向（customerTrend/CustomerTrendOrder.tsx /
        // CustomerTrendKaeru.tsx）。
        //
        // ⚠️ 参照のみ。① に PHP ハンドラが実在するのでフォールバックしてよい。
        //
        // ⚠️⚠️ **`customerTrend` と request 名だけで書いてはいけない。**
        //   この request は category で分岐し、`used`（中古）が
        //   ② に**登録されていない**（① にも customerTrend_used.php が無く、
        //   そもそも動いていない経路のため意図的に登録していない）。
        //   request 名だけで書くと used も ② へ送られ、
        //   ② が「ループ検知」で 502 を返し、無駄な往復とログ汚れが起きる。
        //   ⚠️ 2026-09-10 に `list:event` の登録漏れで同じことが起きている。
        //
        // ⚠️ roll は使わないので中央は空にする（'request::category' の形）。
        // ⚠️ `customerTrend::` は category を送らない呼び出し用。
        //   ② 側は PHP と同じく既定値 'order' として扱う。
        // -----------------------------------------------------------------
        'customerTrend::',
        'customerTrend::order',
        'customerTrend::spec',

        // -----------------------------------------------------------------
        // 2026-09-11 移植。店舗ランキング（shop/ShopOrder.tsx / ShopKaeru.tsx）。
        //
        // ⚠️ 参照のみ。
        //
        // ⚠️⚠️ **order と spec で ① の状況が違う。**
        //     order … ① に shopAction/shop_order.php が実在する
        //             → 転送に失敗しても ① で処理できる
        //     spec  … ① に shopAction/shop_spec.php は**無い**
        //             → 転送に失敗すると 500（require 失敗）になる。
        //               ⚠️ ② が落ちると建売の店舗ランキングは見られない。
        //               利用者と相談のうえ ① には作らない方針（2026-09-11）。
        //
        // ⚠️⚠️ **request 名だけで書いてはいけない。** `used` が
        //   ② に登録されていない（画面も ① の PHP も無い）。
        //   request 名だけで書くと used も ② へ送られ、
        //   ② が「ループ検知」で 502 を返して無駄な往復が起きる。
        // -----------------------------------------------------------------
        'shop::',
        'shop::order',
        'shop::spec',
    ];
}

/**
 * ⚠️⚠️ **フォールバック禁止リスト（書き込み専用の経路）**
 *
 * ここに書いた request は
 *
 *   ・② へ転送する（expressProxyRequests() と同じ扱い）
 *   ・**転送に失敗しても ① 自身の処理を実行しない。** 502 を返して終わる
 *
 * ─────────────────────────────────────────────
 * なぜ必要か
 *
 *   通常の許可リストは「転送に失敗したら ① で処理する」自動フォールバックを
 *   持つ。参照系なら2回実行されても害はないが、**書き込み系では
 *   二重登録・二重更新になる**（② が処理を完了した直後に応答が失われた場合）。
 *
 *   そのため今までは「書き込み系は許可リストに入れない」という運用で
 *   避けていた。しかしそれでは書き込みを Express へ移植できない。
 *   移植するには「失敗しても ① では実行しない」保証が要る。
 *
 * ⚠️ 代償: ② が落ちている間、これらの request は **502 で失敗する**。
 *   参照系は動き続けるので画面は開けるが、保存ができなくなる。
 *   ② の死活監視が前提の仕組みである。
 *
 * ⚠️ 障害時の切り戻しは、この配列から該当行を消すだけでよい。
 *   消せば ① 自身の PHP が処理する（PHPハンドラは削除していない）。
 *
 * ⚠️ 書き方は expressProxyRequests() と同じ 'request:roll:category'。
 *   **roll / category まで必ず指定すること。** request だけで書くと
 *   未移植の roll も 502 になり、その機能が丸ごと止まる。
 *
 * @return string[]
 */
function expressProxyExclusive(): array
{
    return [
        // -----------------------------------------------------------------
        // 2026-09-08 移植。顧客詳細モーダルの保存系。
        //
        // ⚠️ いずれも ① に PHP ハンドラが**実在する**（消していない）。
        //   この配列から外せば即座に ① の処理へ戻る。
        //
        // ⚠️ customer_info は multipart では来ない。
        //   競合PDFのアップロードだけ ① への別リクエストに分離したため、
        //   ここへ来るのは master_data の upsert（JSON）だけである。
        //   （multipart は shouldProxyToExpress() が転送自体を拒否する）
        // -----------------------------------------------------------------
        'information:customer_info:order',
        'information:customer_info:spec',
        'information:customer_info:used',
        'information:update_call_log:common',
        'information:update_interview_log:common',
        'information:log:common',

        // -----------------------------------------------------------------
        // 2026-09-09 移植。ランク管理と商談ステップの書き込み。
        //
        // ⚠️ いずれも ① に PHP ハンドラが**実在する**。
        //   転送に失敗したまま ① で実行されると
        //     interviewLog_update_interview … interview_sheet と
        //       master_data の KPI 列が二重に更新される
        //     contract_ex_update            … contract_expected に
        //       UNIQUE キーが無い場合、行が2つできる
        //   ため、フォールバックを禁止する。
        //
        // ⚠️ `rank` はここに書かない。参照と書き込みを兼ねているため、
        //   isExclusiveToExpress() の中で本文を見て判定している。
        // -----------------------------------------------------------------
        'interviewLog_update_interview',
        'contract_ex_update',

        // 2026-09-10 移植。会社実績の契約目標の書き込み。
        //
        // ⚠️⚠️ ① に PHP ハンドラが**実在する**（change_company_achievement.php）。
        //   転送に失敗したまま ① で実行されると、
        //   company_achievement の upsert が二重に走る。
        //   ⚠️ 一意キーがあるので値は壊れないが、
        //     ② が落ちていることに気づけなくなるため禁止しておく。
        //
        // ⚠️ この request は roll / category で分岐しないため、
        //   request 名だけで書いてよい。
        // -----------------------------------------------------------------
        'change_company_achievement',

        // -----------------------------------------------------------------
        // 2026-09-09 移植。反響一覧の書き込み。
        //
        // ⚠️ いずれも ① に PHP ハンドラが**実在する**。
        //   転送に失敗したまま ① で実行されると
        //     shop_change / staff_change / tag … 同じ値で2回 UPDATE（無害）
        //     black                            … ⚠️ **トグルなので2回で元に戻る**
        //     insert                           … ⚠️ **顧客台帳へ2回 upsert し、
        //                                          反響も2回 sync 済みにする**
        //   black と insert は実害があるため、まとめて禁止する。
        //
        // ⚠️ black も category ごとに書く。フロント（handleBlack）は
        //   category を送っており、① の list.php は roll で分岐する**前に**
        //   category を検証するため、category 無しでは 400 になる。
        // -----------------------------------------------------------------
        'list:shop_change:order',
        'list:shop_change:spec',
        'list:shop_change:used',
        'list:staff_change:order',
        'list:staff_change:spec',
        'list:staff_change:used',
        'list:tag:order',
        'list:tag:spec',
        'list:tag:used',
        'list:insert:order',
        'list:insert:spec',
        'list:insert:used',
        'list:black:order',
        'list:black:spec',
        'list:black:used',
    ];
}

/**
 * この request は「転送に失敗しても ① で実行してはいけない」ものか。
 */
/**
 * `rank` が書き込みの分岐に入るかどうか。
 *
 * ⚠️⚠️ **backend-express/src/features/rank/index.ts の rankIsWrite() と
 *   同じ条件にすること。** 片方だけ変えると
 *   ・② が書き込むのに ① がフォールバックを許す → **二重更新**
 *   ・② が参照なのに ① が 502 を返す → 画面が開かない
 *   のどちらかが起きる。
 *
 * ⚠️ `rank` は1つの request で3つの処理を兼ねている（rank.php の分岐）。
 *     memo あり          → 担当営業メモの保存   【書き込み】
 *     rank / rank_period → 顧客のランク更新     【書き込み】
 *     どちらも無し        → 画面の初期データ     【参照】
 *   参照はフォールバックしてよいので、request 名だけで
 *   フォールバック禁止にはできない。
 */
function rankRequestIsWrite(array $data): bool
{
    foreach (['memo', 'rank', 'rank_period'] as $key) {
        $value = $data[$key] ?? null;
        if (is_scalar($value) && (string)$value !== '') {
            return true;
        }
    }

    return false;
}

function isExclusiveToExpress(string $request, array $data): bool
{
    $roll = is_scalar($data['roll'] ?? null) ? (string)$data['roll'] : '';
    $category = is_scalar($data['category'] ?? null) ? (string)$data['category'] : '';

    // ⚠️ request 名だけでは判定できない特例（上のコメント参照）
    if ($request === 'rank') {
        return rankRequestIsWrite($data);
    }

    foreach (expressProxyExclusive() as $rule) {
        if (matchesProxyRule($rule, $request, $roll, $category)) {
            return true;
        }
    }

    return false;
}

/**
 * 許可リストの1件が、今回のリクエストに一致するか。
 *
 * ⚠️ 部分一致にしないこと。'property' が 'property_db_update' に
 *   一致してしまうと、更新系が ② へ送られる。必ず区切りごとに比較する。
 */
function matchesProxyRule(string $rule, string $request, string $roll, string $category): bool
{
    $parts = explode(':', $rule);

    if (($parts[0] ?? '') !== $request) {
        return false;
    }
    // request だけの指定 → roll / category を問わない
    if (count($parts) === 1) {
        return true;
    }
    if (($parts[1] ?? '') !== $roll) {
        return false;
    }
    if (count($parts) === 2) {
        return true;
    }

    return ($parts[2] ?? '') === $category;
}

/**
 * この request を ② へ転送すべきか。
 *
 * @param array $data リクエストボディ。roll / category の判定に使う
 */
function shouldProxyToExpress(string $request, array $data): bool
{
    // 明示的に無効化できる逃げ道。障害時に .htaccess へ1行足せば全停止できる
    if (getenv('EXPRESS_PROXY_DISABLED') === '1') {
        return false;
    }

    // ⚠️ ファイルアップロード（multipart/form-data）は転送しない。
    //   $_POST 経由で受けたデータにファイル本体が含まれず、
    //   転送先で処理できないため。
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'multipart/form-data') !== false) {
        return false;
    }

    // ⚠️ ② から ① へ転送されてきたリクエストを、再び ② へ返さない。
    //   ② のゲートウェイは未実装のリクエストを ① へ転送する仕組みを持つため、
    //   この判定が無いと ① ⇄ ② で無限ループになる。
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $forwardedBy = $headers['X-Forwarded-By'] ?? $headers['x-forwarded-by'] ?? '';
    if ($forwardedBy !== '') {
        return false;
    }

    // ⚠️ 数値や null が来ても落ちないよう文字列に寄せる。
    //   ② の gateway/index.ts の asString() と同じ考え方。
    $roll = is_scalar($data['roll'] ?? null) ? (string)$data['roll'] : '';
    $category = is_scalar($data['category'] ?? null) ? (string)$data['category'] : '';

    foreach (expressProxyRequests() as $rule) {
        if (matchesProxyRule($rule, $request, $roll, $category)) {
            return true;
        }
    }

    // ⚠️ フォールバック禁止リストのものも「転送する」対象である。
    //   違いは失敗したときの扱いだけ（index.php を参照）。
    foreach (expressProxyExclusive() as $rule) {
        if (matchesProxyRule($rule, $request, $roll, $category)) {
            return true;
        }
    }

    return false;
}

/**
 * ② へ転送する。
 *
 * 成功したらレスポンスをそのまま出力して true を返す。
 * 失敗したら何も出力せず false を返す（呼び出し側が ① の処理を続行する）。
 *
 * ⚠️ レスポンスは素通しする。JSONをパースして組み直すと、
 *   数値の型や日付の形式が変わってフロントが壊れる。
 */
function forwardToExpress(array $data): bool
{
    $url = getenv('EXPRESS_API_URL');
    if ($url === false || $url === '') {
        $url = EXPRESS_API_URL_DEFAULT;
    }

    $headers = ['Content-Type: application/json'];

    // 認証情報を引き継ぐ。
    //
    // ⚠️ これを落とすと、② 側で auth: 'staff' / 'master' を宣言している
    //   エンドポイントが必ず 401 になる。転送する側の必須処理。
    $incoming = function_exists('getallheaders') ? getallheaders() : [];

    $token = $incoming['Token'] ?? $incoming['token'] ?? '';
    if ($token !== '') {
        $headers[] = 'Token: ' . $token;
    }

    // ⚠️ フロント（utils/apiClient.ts）が送る Authorization は '4081Kokubu' という
    //   固定文字列で、認証情報ではない（① でも検証していない）。
    //   ② 側は 'Bearer xxx' の形のときだけ認証情報として扱うため、
    //   そのまま引き継いでも誤認証は起きない。
    //   将来 Bearer を使う経路（MCP など）を通すための備えとして渡しておく。
    $authorization = $incoming['Authorization'] ?? $incoming['authorization'] ?? '';
    if ($authorization !== '') {
        $headers[] = 'Authorization: ' . $authorization;
    }

    // ② 側でループ検知に使う。これが付いていると ② は ① へ転送し返さない
    $headers[] = 'X-Forwarded-By: xserver-php';

    $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        error_log('express_proxy: リクエストのJSON化に失敗しました');
        return false;
    }

    $ch = curl_init($url);
    if ($ch === false) {
        error_log('express_proxy: curl_init に失敗しました');
        return false;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        // ⚠️ 接続タイムアウトは短く、全体は長く。
        //   ② が落ちている場合は接続段階で失敗するため、3秒で見切れば
        //   フォールバックまでの待ち時間が最小になる。
        //   一方、正常に繋がった後の重い集計は待つ必要がある。
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 120,
        // ⚠️ 証明書の検証を無効化しないこと。中間者攻撃を検知できなくなる
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    // 接続できなかった／タイムアウトした
    if ($response === false) {
        error_log("express_proxy: 転送に失敗しました（{$error}）。① の処理に切り替えます");
        return false;
    }

    // ⚠️ 5xx はフォールバックする。② 側の障害（DB接続不能など）であり、
    //   ① なら処理できる可能性がある。
    //   4xx はフォールバックしない。リクエスト内容の誤りは ① でも同じ結果になり、
    //   隠すとバグの発見が遅れる。
    if ($status >= 500) {
        error_log("express_proxy: 転送先が {$status} を返しました。① の処理に切り替えます");
        return false;
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Handled-By: express');
    echo $response;

    return true;
}
