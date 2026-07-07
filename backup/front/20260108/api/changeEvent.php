<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$id = isset($data['id']) ? $data['id'] : "";
$demand = isset($data['demand']) ? $data['demand'] : "";
$shop = isset($data['shop']) ? $data['shop'] : "";
$category = isset($data['category']) ? $data['category'] : "";
$startDate = isset($data['startDate']) ? $data['startDate'] : "";
$endDate = isset($data['endDate']) ? $data['endDate'] : "";
$title = isset($data['title']) ? $data['title'] : "";

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

    if ($demand === 'delete') {
        $sqlUpdate = "UPDATE event_calendar 
                SET flag = 0 
                WHERE id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$id]);
    } elseif ($demand === 'change' && $id ) {
        $sqlUpdate = "UPDATE event_calendar 
                SET startDate = ?, endDate = ?, category = ?, title = ?, flag = 1
                WHERE id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$startDate, $endDate, $category, $title, $id]);
    } elseif ($demand === 'add' && $id === '' ) {
        $sqlUpdate = "INSERT INTO event_calendar 
                (startDate, endDate, category, title, shop, flag)
                VALUES (?, ?, ?, ?, ?, 1)";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$startDate, $endDate, $category, $title, $shop]);
    } elseif ( $demand === 'delete' && $id ) {
        $sqlUpdate = "UPDATE event_calendar 
                SET flag = 0
                WHERE id = ? AND shop = ? AND title = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$id, $shop, $title]);
    } elseif ( $demand === 'change' && $id ) {
        $sqlUpdate = "UPDATE event_calendar 
                SET shop = ? AND title = ? AND category = ? AND startDate = ? AND endDate = ? flag = 1
                WHERE id = ? ";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$shop, $title, $category, $startDate, $endDate, $id]);
    }
    $newSql = "SELECT *
        FROM event_calendar WHERE flag = 1";

    $stmt = $pdo->prepare($newSql);
    $stmt->execute();
    $newEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($newEvents);
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
