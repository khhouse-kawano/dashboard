<?php
try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $recently_review = is_array($data['recently_review'])
        ? json_encode($data['recently_review'], JSON_UNESCAPED_UNICODE)
        : $data['recently_review'];

    $review_history = is_array($data['review_history'])
        ? json_encode($data['review_history'], JSON_UNESCAPED_UNICODE)
        : $data['review_history'];

    $updateSql = "UPDATE google_review 
                SET average = ? , amount = ?, recently_review = ?, review_history = ?
                WHERE id = ?";
    $updateStmt = $pdo->prepare($updateSql);
    if ($updateStmt->execute([$data['average'], $data['amount'], $recently_review, $review_history, $data['id']])) {
        echo json_encode(["message" => "success", "details" => "レビューを更新しました"]);
    } else {
        echo json_encode(["message" => "error", "details" => "更新に失敗しました"]);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
