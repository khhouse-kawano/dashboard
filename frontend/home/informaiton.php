<?php
header("Content-Type: application/json");
$data = json_decode(file_get_contents("php://input"), true);

// ローカルデータベース接続 (PDO)
$dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
$db_user = 'root';
$db_password = '';

// エックスサーバー接続 (PDO)
// $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
// $db_user = 'root';
// $db_password = '';

try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->prepare("SELECT * FROM information");
    $stmt->execute();
    $information = $stmt->fetchALL(PDO::FETCH_ASSOC);

    if ($information) {
        echo json_encode($information);
    } else {
        echo json_encode(["message" => "error", "details" => "情報が取得できませんでした"]);
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "情報が取得できませんでした"]);
}

?>