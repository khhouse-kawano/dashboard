<?php
$sql = "SELECT *
        FROM medium_list
        WHERE response_medium = 0
        ORDER BY sort_key ASC";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
