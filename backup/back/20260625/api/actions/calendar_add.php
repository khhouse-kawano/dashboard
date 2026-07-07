<?php
$data = json_decode(file_get_contents("php://input"), true);
$id = isset($data['id']) ? $data['id'] : "";
$request = isset($data['request']) ? $data['request'] : "";
$shop = isset($data['shop']) ? $data['shop'] : "";
$category = isset($data['category']) ? $data['category'] : "";
$startDate = isset($data['startDate']) ? $data['startDate'] : "";
$endDate = isset($data['endDate']) ? $data['endDate'] : "";
$title = isset($data['title']) ? $data['title'] : "";
$reserved = isset($data['reserved']) ? $data['reserved'] : "";
$new = isset($data['new']) ? $data['new'] : "";
$next = isset($data['next']) ? $data['next'] : "";
$note = isset($data['note']) ? $data['note'] : "";
$url = isset($data['url']) ? $data['url'] : "";
$registered = isset($data['registered']) ? $data['registered'] : "";
$date = isset($data['date']) ? $data['date'] : "";
$requestArray = isset($data['requestArray']) ? $data['requestArray'] : [];
try {
    $sqlUpdate = "INSERT INTO event_calendar 
    (title, startDate, endDate, shop, flag, note, url) VALUES(?, ?, ?, ?, 1, ?, ?)";

    $stmtUpdate = $pdo->prepare($sqlUpdate);
    $stmtUpdate->execute([$title, $startDate, $endDate, $shop, $note, $url]);
    $newSql = "SELECT *
        FROM event_calendar WHERE flag = 1";

    $stmt = $pdo->prepare($newSql);
    $stmt->execute();
    $newEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($newEvents, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
