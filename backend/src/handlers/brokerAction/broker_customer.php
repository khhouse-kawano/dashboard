<?php
// 最新のデータを取得して返す (既存コードのまま)
// v2.2.229: 個人情報削除で削除済みの顧客（delete_dashboard = 1）は出さない
$sql_customer = "SELECT * FROM master_data_resale WHERE show_dashboard = 1 AND COALESCE(delete_dashboard, 0) = 0";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

// 物件連携用のデータ
$sql_property = "SELECT * FROM property_db";
$stmt_property = $pdo->prepare($sql_property);
$stmt_property->execute();
$response_property = $stmt_property->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "customer" => $response_customer,
    "property" => $response_property
];



echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);