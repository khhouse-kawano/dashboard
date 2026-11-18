<?php

// 担当営業
$sql_staff = "SELECT *
        FROM staff_list WHERE rank = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 店舗
$sql_shop = "SELECT shop, section
        FROM shop_list WHERE division = '注文事業'";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT medium, list_medium
        FROM medium_list WHERE response_medium = 0;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 紹介
$sql_introductory = "SELECT * FROM introductory";
$stmt_introductory = $pdo->prepare($sql_introductory);
$stmt_introductory->execute();
$response_introductory = $stmt_introductory->fetchAll(PDO::FETCH_ASSOC);


// 顧客一覧
//
// gift（ギフト進呈可否）の判定は core/gift.php に集約している。
// 建売分譲（database_spec.php）と同じ判定を使うため、条件はそちらを直すこと。
// ここで取るのは条件①②だけ（gift_base）。残りの条件は
// giftApplyToCustomers() が突き合わせて gift を確定させる。
require_once __DIR__ . '/../../core/gift.php';

$sql_customer = "SELECT
  id,
  " . giftBaseSelectSql() . ",
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(customer_contacts_name_2, '') AS customer_2,
  -- 2026-09-25 に追加。DatabaseOrder.tsx の Nexus アイコンの判定で使う。
  -- 返さないと画面側が undefined になり、アイコンが一切出なくなる。
  -- ② の backend-express/src/features/database/queries.ts にも同じ1行がある。
  COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(
  DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
  DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
  ''
  ) AS register,
  COALESCE(sales_promotion_name, '') AS medium,
  COALESCE(status, '') AS status,
  COALESCE(call_status, '') AS call_status,
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(show_dashboard, 0) AS trash,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(portal_site, '') AS portal_site,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  /*
    ⚠️ 2026-09-30 に追加（v2.2.154）。DatabaseOrder.tsx のメールアドレス検索で使う。
      ⚠️ ⚠️ **返さないと画面側が undefined になり、検索しても常に0件になる。**
      ⚠️ ② の features/database/queries.ts にも同じ1行を足してある。
  */
  COALESCE(customer_contacts_email, '') AS mail,
  COALESCE(introduction_person_category, '') AS introduction_person_category,
  COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
  COALESCE(competitor_name, '') AS competitor_name,
  COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
  COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
  COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
  -- ⚠️ v2.2.272: ② の v2.2.271 と同じく、画面で使わない列を外した
  --   （rank_period・competitors_text・competitor_price_gap・competitor_countermeasure）。
  --   ⚠️ ② の backend-express/src/features/database/queries.ts と**必ず揃えること**。
  COALESCE(call_log, '') AS call_log,
  COALESCE(hotlead_id, '') AS hotlead_id,
  COALESCE(k_snap, '') AS k_snap
 FROM master_data
 WHERE COALESCE(delete_dashboard, 0) = 0; -- v2.2.229: 個人情報削除で削除済みの顧客は返さない（② の database/queries.ts と同じ）
";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

// ギフト進呈可否を確定させる（条件③④の突き合わせ）
giftApplyToCustomers($pdo, $response_customer);

// ⚠️ v2.2.272: ② と同じく「列名1回＋値の並び」で返す（画面は databaseUtils.ts の decodeRows で戻す）。
//   ⚠️ 以前は行ごとに列名を繰り返した約28MB の文字列を作り、memory_limit（ローカル 128M）を超えて落ちていた。
//   ⚠️ 1行ずつ値の並びに移し、元の行はすぐ捨てる（同じ内容を2つ持たない）。
$customerCols = [];
foreach ($response_customer as $row) {
    foreach (array_keys($row) as $col) $customerCols[$col] = true;
}
$customerCols = array_keys($customerCols);
$customerRows = [];
foreach (array_keys($response_customer) as $i) {
    $row = $response_customer[$i];
    unset($response_customer[$i]);
    $values = [];
    foreach ($customerCols as $col) $values[] = $row[$col] ?? null;
    $customerRows[] = $values;
}
unset($response_customer);


// 家族情報
// ⚠️ v2.2.272: 画面は家族名の検索にしか使わないので、名前だけにする（② の features/database/index.ts の familyNamesOnly と同じ）
$sql_family = "SELECT id, family_info FROM family_info WHERE family_info IS NOT NULL";
$stmt_family = $pdo->prepare($sql_family);
$stmt_family->execute();
$response_family = [];
while ($row = $stmt_family->fetch(PDO::FETCH_ASSOC)) {
    $parsed = json_decode((string)$row['family_info'], true);
    $names = [];
    if (is_array($parsed) && array_values($parsed) === $parsed) {
        foreach ($parsed as $p) $names[] = ['name' => is_array($p) ? ($p['name'] ?? null) : null];
    }
    $response_family[] = ['id' => $row['id'], 'family_info' => json_encode($names, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)];
}


// イベント情報
$sql_event = "SELECT * FROM event_calendar WHERE shop = 'khg' AND flag = 1";
$stmt_event = $pdo->prepare($sql_event);
$stmt_event->execute();
$response_event = $stmt_event->fetchAll(PDO::FETCH_ASSOC);


// HOTLEAD
// ⚠️ v2.2.272: 行動履歴の全文は返さず、画面が出す件数だけ返す（② の features/database/queries.ts の HOTLEAD_SQL と同じ）
$countWord = fn(string $word): string =>
    "(CHAR_LENGTH(COALESCE(action_history, '')) - CHAR_LENGTH(REPLACE(COALESCE(action_history, ''), '{$word}', ''))) DIV CHAR_LENGTH('{$word}')";
$sql_hotlead = "SELECT id, status, hotlead_url, ticket_stop_reason_type,
  CASE WHEN COALESCE(action_history, '') <> '' THEN 1 ELSE 0 END AS has_action,
  {$countWord('架電')} AS action_calls,
  {$countWord('メール')} AS action_mails,
  {$countWord('SMS')} AS action_sms
  FROM hotlead_db";
$stmt_hotlead = $pdo->prepare($sql_hotlead);
$stmt_hotlead->execute();
$response_hotlead = $stmt_hotlead->fetchAll(PDO::FETCH_ASSOC);

$result = [
        "staff" => $response_staff,
        "shop" => $response_shop,
        "medium" => $response_medium,
        "customer" => ['cols' => $customerCols, 'rows' => $customerRows],
        "family" => $response_family,
        "introductory" => $response_introductory,
        "event" => $response_event,
        "hotlead" => $response_hotlead,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
