<?php
$sql = "SELECT *
        FROM update_log ORDER BY no DESC LIMIT 1";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
