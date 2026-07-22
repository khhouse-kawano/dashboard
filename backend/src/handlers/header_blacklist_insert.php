<?php
// ※ $data にはReactから送られたJSONが連想配列として入っている前提です

// 空文字が多いとのことで、idも一応ダミー生成して入れつつ、主キーである no はAUTO INCREMENTに任せる
$new_id = $data['id'] ?? uniqid('bl_'); 
$date = $data['date'] ?? date('Y/m/d');

// 💡 no はDB側でAUTO INCREMENTされるのでINSERT文には含めない
$sql_insert = 'INSERT INTO black_list (id, name, brand, date, mail, mobile, zip, full_address, note, show_key)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
$stmt_insert = $pdo->prepare($sql_insert);

$success = $stmt_insert->execute([
    $new_id,
    $data['name'] ?? '',
    $data['brand'] ?? '全社',
    $date,
    $data['mail'] ?? '',
    $data['mobile'] ?? '',
    $data['zip'] ?? '',
    $data['full_address'] ?? '',
    $data['note'] ?? '',
    $data['show_key'] ?? 1       
]);

if ($success) {
    // 💡 INSERTによって自動採番された `no` を取得
    $new_no = $pdo->lastInsertId();
    
    // React側がすぐ更新できるように `no` を一緒に返す
    echo json_encode(["status" => "success", "no" => $new_no], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    echo json_encode(["status" => "error", "message" => "データベースへの登録に失敗しました"], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}