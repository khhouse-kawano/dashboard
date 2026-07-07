<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$shop = isset($data['shop']) ? $data['shop'] : "";
$event = isset($data['event']) ? $data['event'] : "";
$date = isset($data['date']) ? $data['date'] : "";
$count = isset($data['count']) ? $data['count'] : "";
$category = isset($data['category']) ? $data['category'] : "";

// // ローカルデータベース接続 (PDO)
// $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
// $db_user = 'root';
// $db_password = '';

// 本番サーバーデータベース接続 (PDO)
$dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
$db_user = 'xs200571_kawano';
$db_password = '4081kawano';


try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sqlCheck = "SELECT count FROM reserved_calendar WHERE shop = ? AND event = ? AND date = ? AND category = ?";
    $stmtCheck = $pdo->prepare($sqlCheck);
    $stmtCheck->execute([$shop, $event, $date, $category]);
    $customersUpdate = $stmtCheck->fetch(PDO::FETCH_ASSOC);

    if ($customersUpdate) {
        $sqlUpdate = "UPDATE reserved_calendar 
                  SET count = ? 
                  WHERE shop = ? AND event = ? AND date = ? AND category = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$count, $shop, $event, $date, $category]);
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

    echo json_encode($newCustomers,JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
