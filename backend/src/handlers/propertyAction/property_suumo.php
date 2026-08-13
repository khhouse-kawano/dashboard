<?php
ini_set('memory_limit', '256M');

// 担当営業
$sql_suumo = "SELECT *
        FROM suumo_property";
$stmt_suumo = $pdo->prepare($sql_suumo);
$stmt_suumo->execute();
$response_suumo = $stmt_suumo->fetchAll(PDO::FETCH_ASSOC);


$result = [
        "suumo" => $response_suumo,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
