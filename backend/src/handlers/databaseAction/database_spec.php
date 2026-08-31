<?php

// 担当営業
$sql_staff = "SELECT *
        FROM staff_list WHERE rank = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 店舗
$sql_shop = "SELECT shop, section
        FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT * FROM medium_kaeru";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 架電情報・面談情報はここでは返さない。
//
// 以前は call_sheet と interview_sheet を丸ごと返していたが、
// 画面側での用途は「過去に担当した営業名で顧客を絞り込む」ための部分一致だけだった。
// ログ本文だけで約30MB（架電23.9MB / 面談6.3MB）あり、これを載せるだけで
// PHP の memory_limit を超え、このハンドラが Fatal error で応答できなくなっていた。
//
// 検索は handlers/past_staff_search.php に移し、該当する顧客のIDだけを返すようにした。


// 顧客一覧
//
// gift（ギフト進呈可否）の判定は core/gift.php に集約している。
// 注文事業（database_order.php）と同じ判定を使うため、条件はそちらを直すこと。
// ここで取るのは条件①②だけ（gift_base）。残りの条件は
// giftApplyToCustomers() が突き合わせて gift を確定させる。
require_once __DIR__ . '/../../core/gift.php';

$sql_customer = "SELECT
  id,
  " . giftBaseSelectSql() . ",
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(REPLACE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '/', '-'), '') AS tour,
  COALESCE(
  DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
  DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
  ''
  ) AS register,
  COALESCE(sales_promotion_name, '') AS medium,
  COALESCE(status, '') AS status,
  COALESCE(rank_period, '') AS rank_period,
  COALESCE(call_status, '') AS call_status,
  COALESCE(show_dashboard, 0) AS trash,
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
  FROM master_data_kaeru;
";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

// ギフト進呈可否を確定させる（条件③④の突き合わせ）
giftApplyToCustomers($pdo, $response_customer);


// 家族情報
$sql_family = "SELECT * FROM family_info";
$stmt_family = $pdo->prepare($sql_family);
$stmt_family->execute();
$response_family = $stmt_family->fetchAll(PDO::FETCH_ASSOC);


$result = [
        "staff" => $response_staff,
        "shop" => $response_shop,
        "medium" => $response_medium,
        "customer" => $response_customer,
        "family" => $response_family
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
