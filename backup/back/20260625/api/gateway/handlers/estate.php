<?php

// 不動産情報
$sql_estate = "SELECT
 property_id,
 property_name,
 address_pref,
 address_city,
 address_town,
 railway_line,
 land_area,
 price,
 zoning1,
 unit_price_tsubo,
 bcr1,
 far1,
 listing_company,
 info_source,
 registered_at,
 updated_at,
 best_use,
 note1,
 walk_time1
 FROM estate_info WHERE registered_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
$stmt_estate = $pdo->prepare($sql_estate);
$stmt_estate->execute();
$response_estate = $stmt_estate->fetchAll(PDO::FETCH_ASSOC);


// 希望エリア
$sql_area = "SELECT * FROM customers_estate WHERE id = ?";
$stmt_area = $pdo->prepare($sql_area);
$stmt_area->execute([$data['id']]);
$response_area = $stmt_area->fetch(PDO::FETCH_ASSOC);


$result = [
    "estate" => $response_estate,
    "area" => $response_area
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
