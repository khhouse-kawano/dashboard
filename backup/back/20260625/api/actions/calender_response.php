<?php
$shop = isset($data['shop']) ? $data['shop'] : "";
$event = isset($data['event']) ? $data['event'] : "";
$date = isset($data['date']) ? $data['date'] : "";
$count = isset($data['count']) ? $data['count'] : "";
$category = isset($data['category']) ? $data['category'] : "";
$id = isset($data['id']) ? $data['id'] : "";
try {
    $sqlCheck = "SELECT count FROM reserved_calendar WHERE shop = ? AND event = ? AND date = ? AND category = ?";
    $stmtCheck = $pdo->prepare($sqlCheck);
    $stmtCheck->execute([$shop, $event, $date, $category]);
    $customersUpdate = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if ($customersUpdate) {
        $sqlUpdate = "UPDATE reserved_calendar 
                  SET count = ? 
                  WHERE id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$count, $id]);
    } else {
        $sqlInsert = "INSERT INTO reserved_calendar (shop, event, date, category, count) 
                  VALUES (?, ?, ?, ?, ?)";
        $stmtInsert = $pdo->prepare($sqlInsert);
        $stmtInsert->execute([$shop, $event, $date, $category, $count]);
    }
    $newSql = "SELECT *
        FROM reserved_calendar";

    $stmt = $pdo->prepare($newSql);
    $stmt->execute();
    $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($newCustomers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
