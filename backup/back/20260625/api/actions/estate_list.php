<?php
$selectSql = "SELECT * FROM registered_estate";

$responseStmt = $pdo->prepare($selectSql);
$responseStmt->execute();

$response = $responseStmt->fetchALL(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
