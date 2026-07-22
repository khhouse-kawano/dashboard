<?php
$id = $data['id'] ?? '';

if ($id === '') {
    echo json_encode(["status" => "error", "message" => "店舗ID（id）が不足しています。"]);
    exit;
}


$updateColumn = null;
$updateValue  = null;

foreach ($data as $k => $v) {
    if (!in_array($k, ['id', 'request'])) {
        $updateColumn = $k;
        $updateValue  = $v;
        break; // 1つ見つかれば確定してループを抜ける
    }
}

if (!$updateColumn) {
    echo json_encode(["status" => "error", "message" => "更新対象のキーが見つかりません。"]);
    exit;
}

$allowedColumns = [
    'brand', 
    'shop', 
    'division', 
    'section', 
    'area', 
    'show_flag', 
    'event_modal', 
    'ma_flag', 
    'report_flag', 
    'multi'
];

if (!in_array($updateColumn, $allowedColumns)) {
    echo json_encode(["status" => "error", "message" => "許可されていないカラム名です: " . $updateColumn]);
    exit;
}

try {
    $sql = "
        UPDATE `shop_list` 
        SET `{$updateColumn}` = :value 
        WHERE `id` = :id
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':value' => $updateValue, // フロントから届く文字列、または "0" / "1"
        ':id'    => $id
    ]);

    // 5. フロント（React）側へ成功の返事を送る（console.logにstatusが出ます）
    echo json_encode([
        "status"  => "success",
        "message" => "店舗情報を更新しました。"
    ]);
    exit;

} catch (PDOException $e) {
    echo json_encode([
        "status"  => "error",
        "message" => "データベースの更新に失敗しました。",
        "debug"   => $e->getMessage()
    ]);
    exit;
}