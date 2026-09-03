<?php
// 1. テーブル名 k-snap_customer をバッククォートで囲む
$sql = "SELECT * FROM `k-snap_customer` WHERE id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$data['id']]);
$result = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode( 
    [ 
        'status' => 'success',
        'customer' => $result  // 2. 'cusotmer' のタイポを修正
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
); 