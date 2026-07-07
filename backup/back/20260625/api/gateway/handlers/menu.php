<?php

// 反響一覧
$sql_inquiry = "SELECT inquiry_date, sync, black_list
        FROM inquiry_customer;";
$stmt_inquiry = $pdo->prepare($sql_inquiry);
$stmt_inquiry->execute();
$response_inquiry = $stmt_inquiry->fetchAll(PDO::FETCH_ASSOC);


// 顧客一覧
$sql_contract = "SELECT
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
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  COALESCE(introduction_person_category, '') AS introduction_person_category,
  COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
  COALESCE(competitors_text, '') AS competitors_text,
  COALESCE(competitor_name, '') AS competitor_name,
  COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
  COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
  COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
  COALESCE(k_snap, '') AS k_snap
FROM master_data
WHERE show_dashboard = 1";
$stmt_contract = $pdo->prepare($sql_contract);
$stmt_contract->execute();
$response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


// 新着物件
$sql_estate = 'SELECT registered_at FROM estate_info WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)';
$stmt_estate = $pdo->prepare($sql_estate);
$stmt_estate->execute();
$response_estate = $stmt_estate->fetchAll(PDO::FETCH_ASSOC);


$result = [
    "inquiry" => $response_inquiry,
    "customer" => $response_contract,
    "estate" => count($response_estate)

];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
