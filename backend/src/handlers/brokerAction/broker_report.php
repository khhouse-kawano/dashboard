<?php

// 仲介物件
$sql_brokerage = "SELECT *
        FROM brokerage_listings;";
$stmt_brokerage = $pdo->prepare($sql_brokerage);
$stmt_brokerage->execute();
$response_brokerage = $stmt_brokerage->fetchAll(PDO::FETCH_ASSOC);


// 担当営業
$sql_staff = "SELECT *
        FROM staff_list WHERE rank = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "brokerage" => $response_brokerage,
    "staff" => $response_staff
];



echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
