<?php
header("Content-Type: application/json");
$data = json_decode(file_get_contents("php://input"), true);
$demand = isset($data['demand']) ? $data['demand'] : "";

// // ローカルデータベース接続 (PDO)
// $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
// $db_user = 'root';
// $db_password = '';

// 本番サーバーデータベース接続 (PDO)
$dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
$db_user = 'xs200571_kawano';
$db_password = '4081kawano';

if ($demand === 'customer') {
    try {
        $pdo = new PDO($dsn, $db_user, $db_password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $sql = "SELECT status, medium, rank, register, reserve, shop, section, contract
    FROM customers;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (PDOException $e) {
        echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
    }
} else {
    try {
        $pdo = new PDO($dsn, $db_user, $db_password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $sql = "SELECT 
    c.id, 
    c.name, 
    c.status, 
    c.medium, 
    c.rank, 
    c.register, 
    c.reserve, 
    c.shop, 
    c.medium, 
    c.estate, 
    c.meeting, 
    c.appointment, 
    c.line_group, 
    c.screening, 
    c.rival, 
    c.period, 
    c.survey, 
    c.budget, 
    c.importance, 
    c.note, 
    c.staff, 
    c.section, 
    c.contract, 
    c.sales_meeting, 
    (SELECT date FROM customers ORDER BY STR_TO_DATE(date, '%Y/%c/%d %H:%i:%s') DESC LIMIT 1) AS latest_date,
    (SELECT sales_meeting FROM customers ORDER BY LENGTH(sales_meeting) DESC LIMIT 1) AS last_meeting
    FROM customers AS c
    ORDER BY STR_TO_DATE(c.register, '%Y/%m/%d') DESC;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (PDOException $e) {
        echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
    }
}
