<?php
// JSON形式でレスポンスを返すためのヘッダーを指定
header('Content-Type: application/json; charset=utf-8');

// ==========================================
// 1. JSONデータの受け取り
// ==========================================
$rawInput = file_get_contents('php://input');
$postData = json_decode($rawInput, true);

if (!$postData || !isset($postData['data'])) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'データが正しく送信されていません。'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$data = $postData['data'];

// ==========================================
// ★ ここでアクションの判定と書き換えを実行 ★
// ==========================================
$rawAction = $data['action'] ?? '';
$mappedAction = '';

if ($rawAction === '来店・来場') {
    $mappedAction = '初回面談';
} elseif ($rawAction === '内見') {
    $mappedAction = '物件案内';
} elseif ($rawAction === 'ご契約') {
    $mappedAction = '契約';
} else {
    // 指定の3つ以外のアクションが飛んできた場合は、DBを更新せずにスキップ！
    echo json_encode([
        'status'  => 'skipped',
        'message' => "アクション「{$rawAction}」は面談ログの対象外のためスキップしました。",
        'name'    => $data['name'] ?? ''
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ※ $pdo には既にPDOインスタンスが格納されている前提です。
// require_once 'db_connect.php'; 

try {
    // ① master_data_kaeru から該当のレコードを取得（7452以降のみ）
    $stmtMaster = $pdo->prepare("
        SELECT id
        FROM master_data_kaeru 
        WHERE customer_contacts_name = :name
    ");
    $stmtMaster->execute([':name' => $data['name']]);
    $masterData = $stmtMaster->fetch(PDO::FETCH_ASSOC);

    // IDがなければスキップ
    if (!$masterData) {
        echo json_encode([
            'status'  => 'skipped',
            'message' => 'マスターデータに名前が存在しないためスキップしました。',
            'name'    => $data['name']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $targetId = $masterData['id'];

    // 今回追加するログの配列データ（キー名 'day' に対応）
    $newLog = [
        'day'    => $data['day'] ?? '',
        'action' => $mappedAction, // ★ 書き換え後のアクション名をセット！
        'staff'  => $data['staff'] ?? '',
        'note'   => $data['note'] ?? ''
    ];

    // ② interview_sheet にそのIDが存在するか確認
    $stmtCheck = $pdo->prepare("
        SELECT interview_log 
        FROM interview_sheet 
        WHERE id = :id
    ");
    $stmtCheck->execute([':id' => $targetId]);
    $interviewSheetData = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if (!$interviewSheetData) {
        // --- レコードが存在しない場合（INSERT） ---
        $interviewLogJson = json_encode([$newLog], JSON_UNESCAPED_UNICODE);

        // ※ご要望通り id, name, interview_log のみを挿入
        $stmtInsert = $pdo->prepare("
            INSERT INTO interview_sheet (id, name, interview_log) 
            VALUES (:id, :name, :interview_log)
        ");
        $stmtInsert->execute([
            ':id'            => $targetId,
            ':name'          => $data['name'],
            ':interview_log' => $interviewLogJson
        ]);

        echo json_encode([
            'status'  => 'success',
            'action'  => 'inserted',
            'message' => '面談ログを新規レコードとして追加しました。',
            'id'      => $targetId
        ], JSON_UNESCAPED_UNICODE);

    } else {
        // --- レコードが存在する場合（UPDATE） ---
        $existingLogs = json_decode($interviewSheetData['interview_log'], true);
        
        if (!is_array($existingLogs)) {
            $existingLogs = [];
        }

        // 既存のログの最後に新しい面談ログを追加
        $existingLogs[] = $newLog;
        $updatedInterviewLogJson = json_encode($existingLogs, JSON_UNESCAPED_UNICODE);

        $stmtUpdate = $pdo->prepare("
            UPDATE interview_sheet 
            SET interview_log = :interview_log 
            WHERE id = :id
        ");
        $stmtUpdate->execute([
            ':interview_log' => $updatedInterviewLogJson,
            ':id'            => $targetId
        ]);

        echo json_encode([
            'status'  => 'success',
            'action'  => 'updated',
            'message' => '既存の面談ログに追加更新しました。',
            'id'      => $targetId
        ], JSON_UNESCAPED_UNICODE);
    }

} catch (PDOException $e) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'データベースエラー: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>