<?php

// show_databaseの処理
$sql_trash = "UPDATE master_data_kaeru SET show_dashboard = ? WHERE id = ?";
$stmt_trash = $pdo->prepare($sql_trash);
if ($stmt_trash->execute([$data['show_dashboard'], $data['id']])) {
    $response_trash = 'success';
} else {
    $response_trash = 'error';
}

// 顧客一覧
$sql_customer = "SELECT
  id,
  COALESCE(customer_contacts_name, '') AS customer,
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
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(show_dashboard, 0) AS trash,
  COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(property_name, '') AS property_name,
  COALESCE(property_tour_name, '') AS property_tour_name,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number
 FROM master_data_kaeru;
";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "customer" => $response_customer,
    "status" => $response_trash
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
