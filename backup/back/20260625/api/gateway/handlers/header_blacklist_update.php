<?php
// ※ $data にはReactから送られたJSONが連想配列として入っている前提です

// 💡 基準となるキーを 'no' に変更
$no = $data['no'] ?? '';
$request = $data['request'] ?? '';

// no と request 以外のキーを取得
unset($data['no'], $data['request']);
$update_column = array_key_first($data);
$update_value = $data[$update_column];

$allowed_columns = ['name', 'brand', 'mail', 'mobile', 'zip', 'full_address', 'note', 'show_key'];

if ($no && in_array($update_column, $allowed_columns)) {
    // 💡 no を WHERE 句に指定
    $sql_update = "UPDATE black_list SET {$update_column} = ? WHERE no = ?";
    $stmt_update = $pdo->prepare($sql_update);
    $success = $stmt_update->execute([$update_value, $no]);

    $response_status = $success ? 'success' : 'error';
} else {
    $response_status = 'invalid_request';
}

echo json_encode(["status" => $response_status], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);