<?php

$sql = "SELECT * FROM `black_list`";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$blacklist = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["blacklist" => $blacklist], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
