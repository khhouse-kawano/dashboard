<?php

$id = $data['id'] ?? null;
$inquiry_id = $data['inquiry_id'] ?? null;

if (!$id) {
    echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません。']);
    exit;
}

$allowedColumns = require __DIR__ . '/../../core/allowed_columns.php';

$tableMap = [
    'order' => 'master_data',
    'spec'  => 'master_data_kaeru',
    'used'  => 'master_data_resale'
];

$tableMapInquiry = [
    'order' => 'inquiry_customer',
    'spec'  => 'inquiry_customer_kaeru',
    'used'  => 'inquiry_customer_resale'
];

$category = $data['category'] ?? '';

if (!array_key_exists($category, $tableMap)) {
    echo json_encode([
        'status' => 'error',
        'message' => '不正なカテゴリーが指定されました。'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$tableName = $tableMap[$category];
$tableNameInquiry = $tableMapInquiry[$category];

$queryParams = ['id' => $id];
$setClauses = [];
$insertCols = [];
$insertVals = [];

foreach ($allowedColumns as $col) {
    if ($col === 'id') {
        continue;
    }

    if (array_key_exists($col, $data)) {
        $val = $data[$col];
        $queryParams[$col] = ($val === '') ? null : $val;

        $setClauses[] = "{$col} = :{$col}";
        $insertCols[] = $col;
        $insertVals[] = ":{$col}";
    }
}

array_unshift($insertCols, 'id');
array_unshift($insertVals, ':id');

if (!isset($queryParams['first_interviewed_date'])) {
    $queryParams['first_interviewed_date'] = date('Y/m/d');
    $setClauses[] = "first_interviewed_date = :first_interviewed_date";
    $insertCols[] = "first_interviewed_date";
    $insertVals[] = ":first_interviewed_date";
}

$checkMasterStmt = $pdo->prepare("SELECT id FROM {$tableName} WHERE id = :id");
$checkMasterStmt->execute(['id' => $id]);
$isExists = $checkMasterStmt->fetch();

$result = false;

try {
    // 1. メインテーブル (master_data 等) の Upsert (更新 or 挿入)
    if ($isExists) {
        if (!empty($setClauses)) {
            $sql = "UPDATE {$tableName} SET " . implode(', ', $setClauses) . " WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute($queryParams);

            if (!$result) {
                $errorInfo = $stmt->errorInfo();
                throw new Exception("UPDATEエラー: " . ($errorInfo[2] ?? '不明なDBエラー'));
            }
        } else {
            $result = true;
        }
    } else {
        $sql = "INSERT INTO {$tableName} (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $insertVals) . ")";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute($queryParams);

        if (!$result) {
            $errorInfo = $stmt->errorInfo();
            throw new Exception("INSERTエラー: " . ($errorInfo[2] ?? '不明なDBエラー'));
        }
    }

    // 2. 関連テーブル (inquiry_customer 等) の更新処理（INSERT/UPDATE共通）
    // $result が成功しており、かつ連携用の $inquiry_id が存在する場合のみ実行
    if ($result && $inquiry_id) {
        $updateSql = "UPDATE {$tableNameInquiry} SET pg_id = ?, sync = 1 WHERE inquiry_id = ?";
        
        // ⚠️ 元のコードで $dbh と $pdo が混在していましたが、別々のDB接続でない限り $pdo に統一するのが安全です。
        // ここではフォールバックとして $dbh があれば使い、なければ $pdo を使います。
        $dbConn = isset($dbh) ? $dbh : $pdo; 
        $updateStmt = $dbConn->prepare($updateSql);
        
        if (!$updateStmt->execute([$id, $inquiry_id])) {
            throw new Exception("{$tableNameInquiry} の連携更新に失敗しました。");
        }
    }

    // 3. トランザクションのコミット
    if ($pdo->inTransaction()) {
        $pdo->commit();
    }

    // 4. フロントエンド（React）へのレスポンスは必ず最後に「1回だけ」行う
    if ($result) {
        $customerName = $data['customer_contacts_name'] ?? 'お客様';
        echo json_encode([
            'status' => 'success',
            'message' => "{$customerName}様の情報を保存し、連携データを更新しました。"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

} catch (Exception $e) {
    // 💡 エラーが起きたら必ずロールバックして中途半端なデータを防ぐ
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    echo json_encode([
        'status' => 'error',
        'message' => 'データベースエラー詳細: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}