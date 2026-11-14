<?php
ini_set('memory_limit', '256M');

// 担当営業
$sql_staff = "SELECT *
        FROM staff_list WHERE rank = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT * FROM medium_resale";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 架電情報
// ⚠️ v2.2.269: 以前は call_sheet の全件（全事業 約19,000行・約43MB）を送っており、
//   ⚠️ json_encode の途中で memory_limit（256M）を超えて「Allowed memory size … exhausted」で落ちていた。
//   ⚠️ 画面（DatabaseResale.tsx）が使うのは、中古の顧客の call_log のうち「通電」「架電」「次回架電日」の day だけ。
//   ⚠️ 中古の顧客の行だけにし、call_log もその3つの { day, action } だけに絞る（返す形 { id, call_log: JSON文字列 } は変えない）。
$CALL_ACTIONS = ['通電', '架電', '次回架電日'];
$sql_call = "SELECT c.id, c.call_log
        FROM call_sheet c
        JOIN master_data_resale m ON m.id = c.id
        WHERE COALESCE(m.delete_dashboard, 0) = 0";
$stmt_call = $pdo->prepare($sql_call);
$stmt_call->execute();
$response_call = [];
while ($row = $stmt_call->fetch(PDO::FETCH_ASSOC)) {
    $log = json_decode((string) ($row['call_log'] ?? ''), true);
    $kept = [];
    if (is_array($log)) {
        foreach ($log as $entry) {
            if (is_array($entry) && in_array($entry['action'] ?? '', $CALL_ACTIONS, true)) {
                $kept[] = ['day' => $entry['day'] ?? '', 'action' => $entry['action']];
            }
        }
    }
    $response_call[] = [
        'id' => $row['id'],
        'call_log' => json_encode($kept, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ];
}


// 顧客一覧
$sql_customer = "SELECT
  id,
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(customer_contacts_name_2, '') AS customer_2,
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
  COALESCE(rank_period, '') AS rank_period,
  COALESCE(call_status, '') AS call_status,
  COALESCE(category, '') AS category,
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(show_dashboard, 0) AS trash,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(property_name, '') AS property_name,
  COALESCE(property_tour_name, '') AS property_tour_name,
  COALESCE(introduction_person_category, '') AS introduction_person_category,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number_2,
  COALESCE(customer_contacts_phone_number, '') AS phone_number,
  COALESCE(customer_contacts_email, '') AS mail,
  COALESCE(extra_address_info, '') AS mail_2,
  COALESCE(integration, '') AS integration,
  COALESCE(call_log, '') AS call_log
  FROM master_data_resale
  WHERE COALESCE(delete_dashboard, 0) = 0; -- v2.2.229: 個人情報削除で削除済みの顧客は返さない
";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);


// 家族情報
// ⚠️ v2.2.269: 画面は id しか使わない（「家族情報あり」の絞り込み）。本文（family_info）は送らない
$sql_family = "SELECT id FROM family_info";
$stmt_family = $pdo->prepare($sql_family);
$stmt_family->execute();
$response_family = $stmt_family->fetchAll(PDO::FETCH_ASSOC);


// 媒介取得
// ⚠️ v2.2.269: 画面と同じ条件（媒介台帳・表示中・顧客IDあり）で絞る。以前は全種類（反響・ログ・通知など）を送っていた
$sql_broker = "SELECT * FROM brokerage_listings
        WHERE kind = 'ledger' AND show_dashboard = 1 AND COALESCE(master_data_id, '') <> ''";
$stmt_broker = $pdo->prepare($sql_broker);
$stmt_broker->execute();
$response_broker = $stmt_broker->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "staff" => $response_staff,
    "medium" => $response_medium,
    "customer" => $response_customer,
    "call" => $response_call,
    "family" => $response_family,
    "broker" => $response_broker
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
