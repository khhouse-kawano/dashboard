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
// （これより上のPDF処理はそのまま）
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
$allowedColumns = require __DIR__ . '/../../core/allowed_columns.php';

// ---------------------------------------------------------
// 1. まず「INSERT(新規)」か「UPDATE(更新)」かを判定する
// ---------------------------------------------------------
$checkMasterStmt = $pdo->prepare("SELECT id FROM {$tableName} WHERE id = :id");
$checkMasterStmt->execute(['id' => $id]);
$isExists = (bool) $checkMasterStmt->fetch();

// ---------------------------------------------------------
// 2. 安全なSQL文（プレースホルダー）を構築する
// ---------------------------------------------------------
$queryParams = ['id' => $id];
$setClauses = [];
$insertCols = ['id'];
$insertVals = [':id'];

// PDOでハイフン入りのカラム名がエラーになるのを防ぐため、連番を使用
$pIndex = 1;

foreach ($allowedColumns as $col) {
    if ($col === 'id') continue;

    // フロントからデータが送信されてきているカラムだけを処理
    if (array_key_exists($col, $data)) {
        $val = $data[$col];
        $pName = 'p' . $pIndex++; // p1, p2, p3... と安全な名前を生成

        // 空文字はNULLに変換して保存（TypeScriptのオプション型のような扱い）
        $queryParams[$pName] = ($val === '') ? null : $val;
        
        // UPDATE用のパーツ
        $setClauses[] = "`{$col}` = :{$pName}";
        
        // INSERT用のパーツ
        $insertCols[] = "`{$col}`";
        $insertVals[] = ":{$pName}";
    }
}

// ---------------------------------------------------------
// 3. 【修正箇所】新規作成(INSERT)時のみ、初回訪問日を自動補完する
// ---------------------------------------------------------
if (!$isExists && !array_key_exists('first_interviewed_date', $data)) {
    $pName = 'p_first_date';
    $queryParams[$pName] = date('Y/m/d');
    
    // UPDATE句には追加せず、INSERT句にのみ追加する！
    $insertCols[] = "`first_interviewed_date`";
    $insertVals[] = ":{$pName}";
}

// ---------------------------------------------------------
// 4. クエリの実行
// ---------------------------------------------------------
$result = false;

try {
    if ($isExists) {
        // --- UPDATE ---
        if (!empty($setClauses)) {
            $sql = "UPDATE {$tableName} SET " . implode(', ', $setClauses) . " WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute($queryParams);
        } else {
            $result = true; // 更新対象がない場合は成功扱い
        }
    } else {
        // --- INSERT ---
        $sql = "INSERT INTO {$tableName} (" . implode(', ', $insertCols) . ") VALUES (" . implode(', ', $insertVals) . ")";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute($queryParams);
    }
    
    // ---------------------------------------------------------
    // 5. レスポンス返却
    // ---------------------------------------------------------
    if ($result) {
        $customerName = $data['customer_contacts_name'] ?? 'お客様';
        echo json_encode([
            'status' => 'success',
            'message' => "{$customerName}様の情報を保存しました。"
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        throw new Exception("データベースの保存処理に失敗しました。");
    }

} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => '顧客情報の登録に失敗しました。: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}