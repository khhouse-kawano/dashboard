<?php
$list = isset($data['list']) ? $data['list'] : "";
$inquiry_id = isset($data['inquiry_id']) ? $data['inquiry_id'] : "";
$brand = '';
if (substr($list, 0, 2) === 'JH') {
    $brand = 'JH';
} elseif (strpos($list, 'DJH') !== false) {
    $brand = 'DJH';
} elseif (strpos($list, 'KH') !== false) {
    $brand = 'KH';
} elseif (strpos($list, '2L') !== false) {
    $brand = '2L';
} elseif (strpos($list, 'なごみ') !== false) {
    $brand = 'Nagomi';
} elseif (strpos($list, 'PG') !== false) {
    $brand = 'PGH';
} elseif (strpos($list, 'ブランド・店舗未設定') !== false) {
    $brand = 'KHG';
}

$sqlUpdate = "UPDATE inquiry_customer 
                SET shop = ? , brand = ?
                WHERE inquiry_id = ?";

$stmtUpdate = $pdo->prepare($sqlUpdate);
$stmtUpdate->execute([$list, $brand, $inquiry_id]);
$customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

$newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

$stmt = $pdo->prepare($newSql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
