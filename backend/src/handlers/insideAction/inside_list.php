<?php

// 架電情報
$sql_call = "SELECT * FROM call_sheet WHERE shop IN ('KH熊本店', 'KH八代店', 'JH熊本店', 'JH八代店');";
$stmt_call = $pdo->prepare($sql_call);
$stmt_call->execute();
$response_call = $stmt_call->fetchAll(PDO::FETCH_ASSOC);


// スタッフ
$sql_staff = "SELECT name FROM staff WHERE brand ='insideSales';";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "call" => $response_call,
    "staff" => $response_staff,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
