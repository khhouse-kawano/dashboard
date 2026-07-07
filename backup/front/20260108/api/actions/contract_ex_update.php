<?php
$searchSql = "SELECT * FROM contract_expected WHERE date = ? AND shop = ?";
$stmt = $pdo->prepare($searchSql);
$stmt->execute([$data['date'], $data['shop']]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
if ($rows) {
    $sql = "UPDATE contract_expected SET count = ? WHERE date = ? AND shop = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['count'], $data['date'], $data['shop']]);
    $response = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    $sql = "INSERT INTO contract_expected (`date`, `section`, `shop`, `count`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `count` = VALUES(`count`)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['date'], $data['section'], $data['shop'], $data['count']]);

    $selectSql = "SELECT * FROM contract_expected WHERE `date` = ? AND `shop` = ?";
    $responseStmt = $pdo->prepare($selectSql);
    $responseStmt->execute([$data['date'], $data['shop']]);
    $response = $responseStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
