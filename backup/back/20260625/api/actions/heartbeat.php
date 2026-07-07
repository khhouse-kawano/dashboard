<?php
try {

    $sql = "SELECT * FROM staff WHERE api_token = ?";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['token']]);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

if ($result) {

    $currentLog = $result[0]['log'] ?? '[]';
    $logArray = json_decode($currentLog, true);

    if (!is_array($logArray)) {
        $logArray = [];
    }

    $newEntry = [
        'time' => date('Y-m-d H:i:s'),
        'url'  => $data['url'] ?? ''
    ];
    $logArray[] = $newEntry;

    $newLogJson = json_encode($logArray, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $updateSql = "UPDATE staff SET heartbeat = ?, log = ? WHERE api_token = ? AND api_token <> ''";
    $updateStmt = $pdo->prepare($updateSql);
    $updateStmt->execute([date('Y-m-d H:i:s'), $newLogJson, $data['token']]);
    http_response_code(204); // No Content

}
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
