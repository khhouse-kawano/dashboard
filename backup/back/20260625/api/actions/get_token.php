<?php
try {

    $sql = "SELECT name, brand, api_token, timestamp FROM staff WHERE api_token = ?";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['token']]);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($result) {
        $updateSql = "UPDATE staff SET timestamp = ?, url = ? WHERE api_token = ? AND api_token <> ''";
        $url = $data['url'] ?? '';
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute([date('Y-m-d H:i:s'), $url, $data['token']]);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
