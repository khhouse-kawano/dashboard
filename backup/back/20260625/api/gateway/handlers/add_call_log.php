<?php
// JSON形式でレスポンスを返すためのヘッダーを指定
header('Content-Type: application/json; charset=utf-8');

// ==========================================
// 1. JSONデータの受け取り
// ==========================================
// axiosから application/json で送られたデータは php://input から取得します
$rawInput = file_get_contents('php://input');
$postData = json_decode($rawInput, true);

// データが正しくパースできなかった場合の処理
if (!$postData || !isset($postData['data'])) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'データが正しく送信されていません。'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Node.jsから送られた 'data' オブジェクトを変数に格納
$data = $postData['data'];

// ※ $pdo には既にPDOインスタンスが格納されている前提です。
// require_once 'db_connect.php'; // など、必要に応じて接続ファイルを読み込んでください

try {
    // ① master_data_resale から該当のレコードを取得
    $stmtMaster = $pdo->prepare("
        SELECT id, in_charge_store 
        FROM master_data_resale 
        WHERE customer_contacts_name = :name
    ");
    $stmtMaster->execute([':name' => $data['name']]);
    $masterData = $stmtMaster->fetch(PDO::FETCH_ASSOC);

    // IDがなければ、スキップした理由を返す
    if (!$masterData) {
        echo json_encode([
            'status'  => 'skipped',
            'message' => 'マスターデータに名前が存在しないためスキップしました。',
            'name'    => $data['name']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $targetId = $masterData['id'];
    $targetShop = $masterData['in_charge_store'];

    // 今回追加するログの配列データ
    $newLog = [
        'day'    => $data['date'] ?? '',
        'action' => $data['action'] ?? '',
        'staff'  => $data['staff'] ?? '',
        'note'   => $data['note'] ?? ''
    ];

    // ② call_sheet にそのIDが存在するか確認
    $stmtCheck = $pdo->prepare("
        SELECT call_log 
        FROM call_sheet 
        WHERE id = :id
    ");
    $stmtCheck->execute([':id' => $targetId]);
    $callSheetData = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if (!$callSheetData) {
        // --- レコードが存在しない場合（INSERT） ---
        $callLogJson = json_encode([$newLog], JSON_UNESCAPED_UNICODE);

        $stmtInsert = $pdo->prepare("
            INSERT INTO call_sheet (id, shop, name, status, call_log) 
            VALUES (:id, :shop, :name, :status, :call_log)
        ");
        $stmtInsert->execute([
            ':id'       => $targetId,
            ':shop'     => $targetShop,
            ':name'     => $data['name'],
            ':status'   => "", // とりあえず空文字
            ':call_log' => $callLogJson
        ]);

        // 成功（新規追加）のレスポンス
        echo json_encode([
            'status'  => 'success',
            'action'  => 'inserted',
            'message' => '新規レコードとして追加しました。',
            'id'      => $targetId
        ], JSON_UNESCAPED_UNICODE);

    } else {
        // --- レコードが存在する場合（UPDATE） ---
        $existingLogs = json_decode($callSheetData['call_log'], true);
        
        if (!is_array($existingLogs)) {
            $existingLogs = [];
        }

        $existingLogs[] = $newLog;
        $updatedCallLogJson = json_encode($existingLogs, JSON_UNESCAPED_UNICODE);

        $stmtUpdate = $pdo->prepare("
            UPDATE call_sheet 
            SET call_log = :call_log 
            WHERE id = :id
        ");
        $stmtUpdate->execute([
            ':call_log' => $updatedCallLogJson,
            ':id'       => $targetId
        ]);

        // 成功（更新）のレスポンス
        echo json_encode([
            'status'  => 'success',
            'action'  => 'updated',
            'message' => '既存レコードを更新しました。',
            'id'      => $targetId
        ], JSON_UNESCAPED_UNICODE);
    }

} catch (PDOException $e) {
    // データベースエラー時のレスポンス
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>