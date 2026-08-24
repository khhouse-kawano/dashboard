<?php

// リード情報
$sql_lead = "SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads');";
$stmt_lead = $pdo->prepare($sql_lead);
$stmt_lead->execute();
$response_lead = $stmt_lead->fetchAll(PDO::FETCH_ASSOC);


// スタッフ情報
$sql_staff = "SELECT * FROM staff_list WHERE shop = '不動産企画係';";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "lead" => $response_lead,
    "staff" => $response_staff
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
