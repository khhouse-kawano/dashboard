<?php
$id     = $data['id'] ?? '';

$updateColumn = null;
$updateValue  = null;

foreach ($data as $k => $v) {
    if (!in_array($k, ['id'])) {
        $updateColumn = $k;
        $updateValue  = $v;
        break;
    }
}

if (!$updateColumn) {
    echo json_encode(["status" => "error", "message" => "更新対象のキーが見つかりません。"]);
    exit;
}


$allowedColumns = ['status', 'section', 'shop', 'category', 'rank', 'report', 'estate', 'multi', 'period', 'position'];

if (!in_array($updateColumn, $allowedColumns)) {
    echo json_encode(["status" => "error", "message" => "許可されていないカラム名です: " . $updateColumn]);
    exit;
}

try {
    $sql = "
        UPDATE `staff_list` 
        SET `{$updateColumn}` = :value 
        WHERE `id` = :id
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':value'  => $updateValue,
        ':id'     => $id,
    ]);

    echo json_encode([
        "status"  => "success",
        "message" => "アップデートに成功しました。",
    ]);
    exit;

} catch (PDOException $e) {
    echo json_encode([
        "status"  => "error",
        "message" => "データベースエラーが発生しました。",
        "debug"   => $e->getMessage() // 本番環境では非表示を推奨
    ]);
    exit;
}