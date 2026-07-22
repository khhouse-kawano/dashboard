<?php
$id = $data['id'] ?? '';

if ($id) {
    $bookmark = $data['bookmark'] ?? 0;

    if ($id !== null) {
        $updateSql = "UPDATE meta_ads SET bookmark = :bookmark WHERE id = :id";
        $updateStmt = $pdo->prepare($updateSql);

        $updateStmt->bindValue(':bookmark', (int)$bookmark, PDO::PARAM_STR);
        $updateStmt->bindValue(':id', $id, PDO::PARAM_STR);

        $updateStmt->execute();

        echo json_encode(["status" => "success", "message" => "ブックマークを更新しました"]);
        exit;
    }
}

$sql = "SELECT * FROM meta_ads";
$stmt = $pdo->prepare($sql);
$stmt->execute();
$response = $stmt->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "ads" => $response,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
