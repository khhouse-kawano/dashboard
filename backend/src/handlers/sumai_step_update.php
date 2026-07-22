<?php
declare(strict_types=1);

// ※ ここより上で $pdo（データベース接続）が定義されている前提とします

// 1. Node.jsからPOSTされたJSONデータを受け取る
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

// データが空、またはリクエスト名が一致しない場合は処理を弾く
if (!$data || !isset($data['request']) || $data['request'] !== 'sumai_step_update') {
    // 別のリクエスト処理へ流すか、エラーを返す
    // return; や exit; など、環境に合わせて調整してください
}

try {
    // 2. 保存するカラム名（キー）のリストを定義
    // ★ ここにNode.js側でマッピングした全カラムと、一番最後に 'remarks' を追加します！
    $columns = [
        'id',
        'date',
        'status',
        'shop',
        'estate',
        'category',
        'estate_pref',
        'estate_city',
        'estate_town',
        'estate_street',
        'estate_building',
        'estate_room',
        'estate_situation',
        'large_1',
        'large_2',
        'large_3',
        'large_4',
        'land_large_1',
        'land_large_2',
        'land_large_3',
        'plan',
        'situation',
        'relationship',
        'rent',
        'floor',
        'room',
        'reason',
        'reason_other',
        'method',
        'period',
        'opinion',
        'sei',
        'mei',
        'sei_kana',
        'mei_kana',
        'age',
        'phone',
        'mail',
        'zip',
        'address_1',
        'address_2',
        'address_3',
        'phone_call',
        'visit',
        'medium',
        'report',
        'remarks' // ← ★追加！
    ];

    // 3. INSERT文の自動生成
    $columnSql = implode(', ', $columns);
    $placeholderSql = ':' . implode(', :', $columns);

    $sql = "INSERT IGNORE INTO sumai_step_db ($columnSql) VALUES ($placeholderSql)";
    $stmt = $pdo->prepare($sql);

    // 4. バインドするパラメータを動的に生成
    $params = [];
    foreach ($columns as $col) {
        // Node.jsから送られてきたデータがあればそれを、無ければ NULL をセットする
        $params[":{$col}"] = $data[$col] ?? null;
    }

    // 5. まず sumai_step_db に実行（データを保存）
    if ($stmt->execute($params)) {
        
        // ★ データが保存された "後" にダッシュボード連携などの同期処理を呼び出す
        require_once __DIR__ . '/portal/sumai_step.php';
        
        // Node.js側に成功レスポンスを返す
        echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'insert_error',
        'message' => 'Database error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}