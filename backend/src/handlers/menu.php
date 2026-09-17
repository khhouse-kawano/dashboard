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


/**
 * 反響取得日を 'YYYY-MM-DD' に揃える式。
 *
 * ⚠️⚠️ **本番データに '/' 区切りと '-' 区切りが混在している。**
 *   ⚠️ 片方だけだと STR_TO_DATE が NULL を返し、**その行が黙って落ちる。**
 * ⚠️ ② の backend-express/src/features/menu.ts の REGISTER_DATE と同じもの。
 */
$register_date = "
      COALESCE(
        DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
        DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d')
      )";

/**
 * その列が未入力かを表す式。
 *
 * ⚠️⚠️ **'null' という文字列が実データに入っている。** 空文字と同じ扱いにする。
 *   ⚠️ IS NULL では拾えない。⚠️ ② の isBlankSql() と同じ考え方である。
 * ⚠️ 空白だけの入力も未入力として扱うため TRIM を通す。
 *
 * ⚠️ 列名は**この関数の呼び出し側で決め打ちしたものしか渡さない。**
 *   ⚠️ 外部からの値を渡さないこと（SQL に直接埋め込むため）。
 */
$is_blank_sql = function ($column) {
    return "TRIM(COALESCE($column, '')) IN ('', 'null')";
};

/**
 * 失注（競合負け）で埋めてほしい列。
 *
 * ⚠️⚠️ **② の LOST_REQUIRED_COLUMNS、フロントの LOST_FIELDS と
 *   同じ並び・同じ顔ぶれにすること。**
 *   ⚠️ 食い違うと、**メニューのバッジと失注一覧の件数が合わなくなる。**
 */
$lost_required_columns = [
    'competitor_name',
    'customized_input_01JRF9CZSW65A151WR30NA4PB3',
    'customized_input_01JSE7H4MQES619NBWX6PQDFRH',
    // ⚠️ 2026-09-17 に追加（価格差・今後の対策）
    'competitor_price_gap',
    'competitor_countermeasure',
];

$lost_blank_conditions = implode("\n             OR ", array_map($is_blank_sql, $lost_required_columns));

// 失注したが理由が埋まっていない顧客。
// ⚠️ 条件は次のどちらかに当たれば「未記入」。
//     ① 失注理由そのものが無い
//     ② 理由が「競合負け」なのに $lost_required_columns のどれかが空
// ⚠️ 期間は**反響取得日**が 2026-06-01 より後、かつ今日より前（失注日ではない）。
$sql_lost = "SELECT COUNT(*) AS c
        FROM master_data
       WHERE show_dashboard = 1
         AND COALESCE(status, '') = '失注'
         AND $register_date > '2026-06-01'
         AND $register_date < NOW()
         AND (
              " . $is_blank_sql('competitor_lost_contract_reason') . "
           OR (competitor_lost_contract_reason = '競合負け'
               AND ($lost_blank_conditions))
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
