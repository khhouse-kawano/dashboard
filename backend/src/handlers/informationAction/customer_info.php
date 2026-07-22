<?php
$id = $data['id'] ?? null;

if (!$id) {
    echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません。']);
    exit;
}

// =========================================================
// 【追加機能】 PDFファイルのアップロードと competitor_pdf テーブルへの保存（完全上書き版）
// ※この部分は元のコードのまま変更していません
// =========================================================
$new_uploaded_pdfs = [];
if (isset($_FILES['competitor_pdf_files']) && is_array($_FILES['competitor_pdf_files']['name'])) {
    $uploadDir = __DIR__ . '/../uploads/competitors/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    $fileCount = count($_FILES['competitor_pdf_files']['name']);
    for ($i = 0; $i < $fileCount; $i++) {
        if ($_FILES['competitor_pdf_files']['error'][$i] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['competitor_pdf_files']['tmp_name'][$i];
            $originalFileName = basename($_FILES['competitor_pdf_files']['name'][$i]);
            $fileExt = strtolower(pathinfo($originalFileName, PATHINFO_EXTENSION));

            $customName = $_POST['competitor_pdf_names'][$i] ?? $originalFileName;
            $staffName = $_POST['competitor_pdf_staff'][$i] ?? '';

            if ($fileExt === 'pdf' && mime_content_type($tmpName) === 'application/pdf') {
                $newFileName = uniqid('pdf_') . '_' . time() . '_' . $i . '.pdf';
                $destination = $uploadDir . $newFileName;

                if (move_uploaded_file($tmpName, $destination)) {
                    $new_uploaded_pdfs[] = [
                        'name' => $customName,
                        'path' => '/uploads/competitors/' . $newFileName,
                        'staff' => $staffName
                    ];
                }
            }
        }
    }
}

$existing_pdfs = [];
if (isset($_POST['existing_pdfs'])) {
    $decoded = json_decode($_POST['existing_pdfs'], true);
    if (is_array($decoded)) {
        $existing_pdfs = $decoded;
    }
}

$final_pdfs = array_merge($existing_pdfs, $new_uploaded_pdfs);

if ($id && isset($_POST['existing_pdfs'])) {
    $newPdfPathJson = json_encode($final_pdfs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $checkStmt = $pdo->prepare('SELECT id FROM competitor_pdf WHERE id = :id');
    $checkStmt->execute(['id' => $id]); // 配列で渡すモダンな書き方

    if ($checkStmt->fetch()) {
        $updatePdfStmt = $pdo->prepare('UPDATE competitor_pdf SET pdf_path = :pdf_path WHERE id = :id');
        $updatePdfStmt->execute(['pdf_path' => $newPdfPathJson, 'id' => $id]);
    } else {
        $insertPdfStmt = $pdo->prepare('INSERT INTO competitor_pdf (id, pdf_path) VALUES (:id, :pdf_path)');
        $insertPdfStmt->execute(['id' => $id, 'pdf_path' => $newPdfPathJson]);
    }
}
// =========================================================


$tableMap = [
    'order' => 'master_data',
    'spec'  => 'master_data_kaeru',
    'used'  => 'master_data_resale'
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

// 1. 別ファイルからホワイトリストを読み込む
$allowedColumns = require __DIR__ . '/allowed_columns.php';

$queryParams = ['id' => $id];
$setClauses = [];

// ▼ 【重要】 'id' を最初から手動で含めず、後から安全に1つだけ確定させる
$insertCols = [];
$insertVals = [];

// 2. ホワイトリストをループし、動的にSQLパーツとパラメータを構築
foreach ($allowedColumns as $col) {
    // 万が一 allowed_columns.php に 'id' が書かれていても、ここでスキップして重複を防ぐ
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

// 3. INSERT用の配列の先頭に、確実に「id」を1つだけ差し込む（TSの unshift() や配列結合と同じ発想）
array_unshift($insertCols, 'id');
array_unshift($insertVals, ':id');

// 挿入時に今日を入れる場合（フロントから未送信の場合のみ補完）
if (!isset($queryParams['first_interviewed_date'])) {
    $queryParams['first_interviewed_date'] = date('Y/m/d');
    $setClauses[] = "first_interviewed_date = :first_interviewed_date";
    $insertCols[] = "first_interviewed_date";
    $insertVals[] = ":first_interviewed_date";
}

// 4. レコードの存在確認（UPSERT判定）
$checkMasterStmt = $pdo->prepare("SELECT id FROM {$tableName} WHERE id = :id");
$checkMasterStmt->execute(['id' => $id]);
$isExists = $checkMasterStmt->fetch();

$result = false;

try {
    if ($isExists) {
        // --- UPDATE ---
        if (!empty($setClauses)) {
            $sql = "UPDATE {$tableName} SET " . implode(', ', $setClauses) . " WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute($queryParams);
        } else {
            $result = true;
        }
    } else {
        // --- INSERT ---
        // ここで実行されるSQLの形: INSERT INTO <table> (id, col1, col2) VALUES (:id, :col1, :col2)
        $sql = "INSERT INTO {$tableName} (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $insertVals) . ")";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute($queryParams);
    }
    
    // 5. レスポンス返却
    if ($result) {
        $customerName = $data['customer_contacts_name'] ?? 'お客様';
        echo json_encode([
            'status' => 'success',
            'message' => "{$customerName}様の情報を保存しました。"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        throw new Exception("保存に失敗しました。");
    }

} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => '顧客情報の登録に失敗しました。: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}