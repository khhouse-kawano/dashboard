<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// 本番サーバーデータベース接続 (PDO)
$dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
$db_user = 'xs200571_kawano';
$db_password = '4081kawano';

$pdo = new PDO($dsn, $db_user, $db_password);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$sql = 'SELECT staff, shop, id_related, name, kana, `case`, medium, status, zip, address, phone, registered FROM khf_customers ORDER BY registered DESC';
$stmt = $pdo->prepare($sql);
$stmt->execute();
$result = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
