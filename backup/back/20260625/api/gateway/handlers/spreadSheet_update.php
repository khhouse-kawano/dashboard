<?php
// ※ $pdo と $data は定義済みとする

$request     = isset($data['request']) ? $data['request'] : '';
$url         = isset($data['url']) ? $data['url'] : '';
$name        = isset($data['name']) ? $data['name'] : ''; 
$description = isset($data['description']) ? $data['description'] : '';
$category    = isset($data['category']) ? $data['category'] : '';
$tag         = isset($data['tag']) ? $data['tag'] : '';
$no          = isset($data['no']) ? $data['no'] : null; // 修正時にフロントから届く連番ID

if (empty($url) || empty($name)) {
    echo json_encode(['status' => 'error', 'message' => 'URLまたはシート名が不足しています']);
    exit;
}

try {
    // 現在時刻（更新日時用）
    $now = date('Y-m-d H:i:s');

    // 1. URLの重複チェック（DB内に同じURLがあるか確認）
    $checkStmt = $pdo->prepare("SELECT no FROM spreadSheet WHERE url = :url");
    $checkStmt->bindValue(':url', $url, PDO::PARAM_STR);
    $checkStmt->execute();
    $existingRecord = $checkStmt->fetch(PDO::FETCH_ASSOC);

    // URLの有無、またはリクエスト内容から「INSERT」か「UPDATE」かを自動判断
    if ($existingRecord && ( $existingRecord['no'] != $no)) {
        // 【パターンA】新規登録しようとしたが、すでに同じURLが別レコードで存在する場合
        // ※修正モードであっても、URLを「他人が登録済みの別シートのURL」に書き換えようとしたら弾く
        echo json_encode(['status' => 'error', 'message' => 'すでに登録済みのURLです']);
        exit;
    }

    if ($existingRecord) {
        // ==========================================
        // 処理①：UPDATE（修正）
        // ==========================================
        // 連番(no)が指定されている場合はそれをキーにし、なければURLをキーにして更新
        if (!empty($no)) {
            $updateStmt = $pdo->prepare("
                UPDATE spreadSheet 
                SET name = :name, url = :url, description = :description, category = :category, tag = :tag
                WHERE no = :no
            ");
            $updateStmt->bindValue(':no', $no, PDO::PARAM_INT);
        } else {
            $updateStmt = $pdo->prepare("
                UPDATE spreadSheet 
                SET name = :name, description = :description, category = :category, tag = :tag
                WHERE url = :url
            ");
        }

        $updateStmt->bindValue(':name', $name, PDO::PARAM_STR);
        $updateStmt->bindValue(':url', $url, PDO::PARAM_STR);
        $updateStmt->bindValue(':description', $description, PDO::PARAM_STR);
        $updateStmt->bindValue(':category', $category, PDO::PARAM_STR);
        $updateStmt->bindValue(':tag', $tag, PDO::PARAM_STR);

        $result = $updateStmt->execute();

    } else {
        // ==========================================
        // 処理②：INSERT（新規登録）
        // ==========================================
        $insertStmt = $pdo->prepare("
            INSERT INTO spreadSheet (name, url, description, category, tag) 
            VALUES (:name, :url, :description, :category, :tag)
        ");

        $insertStmt->bindValue(':name', $name, PDO::PARAM_STR);
        $insertStmt->bindValue(':url', $url, PDO::PARAM_STR);
        $insertStmt->bindValue(':description', $description, PDO::PARAM_STR);
        $insertStmt->bindValue(':category', $category, PDO::PARAM_STR);
        $insertStmt->bindValue(':tag', $tag, PDO::PARAM_STR);

        $result = $insertStmt->execute();
    }

    // 2. 結果をReactに返却
    if ($result) {
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'データベースへの保存・更新に失敗しました']);
    }
    exit;

} catch (PDOException $e) {
    echo json_encode(['status' => 'error', 'message' => 'システムエラー: ' . $e->getMessage()]);
    exit;
}