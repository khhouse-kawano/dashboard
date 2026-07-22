<?php

$sql = "SELECT * FROM spreadSheet";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$sheet = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(
    ["sheet" => $sheet],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
