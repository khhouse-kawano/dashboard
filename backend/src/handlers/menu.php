<?php

/**
 * メニューの通知バッジ（frontend/src/components/Menu.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-14 に COUNT へ作り替えた。以前とは返す形が全く違う。**
 *   旧版は inquiry_customer（18,098件）と master_data（24,219件）を
 *   丸ごと返し、フロントが JavaScript で filter して件数を数えていた。
 *   応答は **18.2MB** で、これを**数字3つのために**転送していた。
 *
 *   ⚠️⚠️ しかも Menu は**全ページで走る**。顧客一覧（21.8MB）より重かった。
 *
 * ⚠️⚠️ **backend-express/src/features/menu.ts と同じ形にしておくこと。**
 *   こちらは ② への転送が失敗したときのフォールバックである。
 *   形が違うと、転送が失敗した瞬間にバッジが壊れる（しかも普段は
 *   動くので気づくのが遅れる）。
 *
 * ⚠️⚠️ **判定条件の置き場所がフロントからここへ移った。**
 *   `sync` の条件は frontend/src/components/list/listTags.ts の
 *   `isPendingSync()` と**同じもの**である。あちらは反響一覧が今も使っている。
 *   ⚠️ **片方だけ直すとメニューのバッジと一覧の件数が食い違う。**
 * ─────────────────────────────────────────────
 */

/**
 * 未同期を数え始める月。
 * ⚠️ Menu.tsx の `getYearMonthArray(2025, 1).slice(5)` の先頭と同じ。
 *   ⚠️ 片方だけ変えると件数がずれる。
 */
$sync_start_month = '2025/06';

// 未同期の反響。
// ⚠️ sync が 0 で、かつ 重複・業者・ブラックのいずれでもないもの。
// ⚠️ inquiry_date は 'YYYY/MM/DD' の文字列。末尾に空白が付いた値が1件
//   実在したが、SUBSTRING(...,1,7) なので影響しない。
$sql_sync = "SELECT COUNT(*) AS c
        FROM inquiry_customer
       WHERE COALESCE(sync, 0) = 0
         AND COALESCE(duplicate_flag, 0) <> 1
         AND COALESCE(support_flag, 0) <> 1
         AND COALESCE(black_flag, 0) <> 1
         AND SUBSTRING(inquiry_date, 1, 7) BETWEEN ? AND DATE_FORMAT(NOW(), '%Y/%m')";
$stmt_sync = $pdo->prepare($sql_sync);
$stmt_sync->execute([$sync_start_month]);
$response_sync = $stmt_sync->fetch(PDO::FETCH_ASSOC);


// 来場予定日を過ぎたのに結果が入っていない顧客（キャンセル確認待ち）。
// ⚠️ reserved_interview は 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在するため
//   REPLACE してから STR_TO_DATE する。解釈できない値は NULL になり比較が偽になる。
// ⚠️ 基準日 '2026-01-01' はフロントに直書きされていたものをそのまま移した。
$sql_cancel = "SELECT COUNT(*) AS c
        FROM master_data
       WHERE show_dashboard = 1
         AND COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') = ''
         AND COALESCE(cancel_status, '') = ''
         AND COALESCE(status, '') <> '重複'
         AND STR_TO_DATE(REPLACE(reserved_interview, '/', '-'), '%Y-%m-%d') > '2026-01-01'
         AND STR_TO_DATE(REPLACE(reserved_interview, '/', '-'), '%Y-%m-%d') < NOW()";
$stmt_cancel = $pdo->prepare($sql_cancel);
$stmt_cancel->execute();
$response_cancel = $stmt_cancel->fetch(PDO::FETCH_ASSOC);


// 失注したが理由が埋まっていない顧客。
// ⚠️⚠️ **'null' という文字列が実データに入っている。** 空文字と同じ扱いにする。
//   IS NULL では拾えない。
// ⚠️ register の正規化は2段構え。本番データに両方の形式が混在している。
$sql_lost = "SELECT COUNT(*) AS c
        FROM master_data
       WHERE show_dashboard = 1
         AND COALESCE(status, '') = '失注'
         AND COALESCE(
               DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
               DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d')
             ) > '2026-06-01'
         AND COALESCE(
               DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
               DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d')
             ) < NOW()
         AND (
              COALESCE(competitor_lost_contract_reason, '') IN ('', 'null')
           OR (competitor_lost_contract_reason = '競合負け'
               AND COALESCE(competitor_name, '') IN ('', 'null'))
           OR (competitor_lost_contract_reason = '競合負け'
               AND (COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') IN ('', 'null')
                 OR COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') IN ('', 'null')
                 OR TRIM(COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '')) = ''))
           -- ⚠️ 2026-09-17 に追加（価格差・今後の対策）。
           -- ⚠️ ② の backend-express/src/features/menu.ts と**必ず揃えること**。
           OR (competitor_lost_contract_reason = '競合負け'
               AND (COALESCE(competitor_price_gap, '') IN ('', 'null')
                 OR TRIM(COALESCE(competitor_price_gap, '')) = ''
                 OR COALESCE(competitor_countermeasure, '') IN ('', 'null')
                 OR TRIM(COALESCE(competitor_countermeasure, '')) = ''))
         )";
$stmt_lost = $pdo->prepare($sql_lost);
$stmt_lost->execute();
$response_lost = $stmt_lost->fetch(PDO::FETCH_ASSOC);


// 新着物件。
// ⚠️ 旧版は行を全部取ってから count() していた。
// ⚠️ 実は Menu.tsx はこの値を**使っていない**（estateId は別物）。
//   返すのをやめると ② との応答が食い違うため残してある。
$sql_estate = "SELECT COUNT(*) AS c
        FROM estate_info
       WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)";
$stmt_estate = $pdo->prepare($sql_estate);
$stmt_estate->execute();
$response_estate = $stmt_estate->fetch(PDO::FETCH_ASSOC);


// ⚠️ キーの順序も Express と揃えている
$result = [
    "sync" => (int) ($response_sync['c'] ?? 0),
    "cancel" => (int) ($response_cancel['c'] ?? 0),
    "lost" => (int) ($response_lost['c'] ?? 0),
    "estate" => (int) ($response_estate['c'] ?? 0),
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
