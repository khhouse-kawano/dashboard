<?php
$sql = "SELECT * FROM staff_list";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$staff = $stmt->fetchAll(PDO::FETCH_ASSOC);

$sql_section = "SELECT * FROM section_list";
$stmt_section = $pdo->prepare($sql_section);
$stmt_section->execute();
$section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);

$sql_shop = "SELECT * FROM shop_list";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "staff" => $staff,
    "section" => $section,
    "shop" => $shop
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
