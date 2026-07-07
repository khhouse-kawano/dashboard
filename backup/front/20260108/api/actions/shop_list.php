<?php
$sql = "SELECT brand, shop, section, area, division
        FROM shop_list WHERE show_flag = 1";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
