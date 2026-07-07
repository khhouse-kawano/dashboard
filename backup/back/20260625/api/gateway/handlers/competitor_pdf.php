<?php

//PDFファイル
$sql_pdf = "SELECT * FROM competitor_pdf";
$stmt_pdf = $pdo->prepare($sql_pdf);
$stmt_pdf->execute();
$response_pdf = $stmt_pdf->fetchAll(PDO::FETCH_ASSOC);


//店舗
$sql_shop = "SELECT * FROM `shop_list`";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


//顧客情報
$sql_customer = "SELECT 
    id,
    customer_contacts_name,
    in_charge_store,
    in_charge_user,
    status
    FROM `master_data`";
$stmt_customer = $pdo->prepare($sql_customer);
$stmt_customer->execute();
$response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);


$result = [
        "pdf" => $response_pdf,
        "shop" => $response_shop,
        "customer" => $response_customer,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
