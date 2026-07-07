<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$shop = isset($data['shop']) ? $data['shop'] : "";
$startMonth = isset($data['startMonth']) ? $data['startMonth'] : "";
$endMonth = isset($data['endMonth']) ? $data['endMonth'] : "";
$rank = isset($data['rank']) ? $data['rank'] : "";
$medium = isset($data['medium']) ? addslashes($data['medium']) : "";
$staff = isset($data['staff']) ? $data['staff'] : "";
$brand = isset($data['brand']) ? $data['brand'] : "";
$step = isset($data['step']) ? $data['step'] : "";
$page = isset($data['page']) ? $data['page'] : 1;
$register = isset($data['register']) ? $data['register'] : "";
$section = isset($data['section']) ? $data['section'] : "";
$status = isset($data['status']) ? $data['status'] : "";

    // ローカルデータベース接続 (PDO)
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

    // 数を取得するクエリ
    // SQLクエリを構築
    $sqlCount = "SELECT COUNT(*) AS totalCount FROM customers WHERE date LIKE '%202%' AND status <> '契約済み'";

    if ($medium != null) {
        $sqlCount .= " AND medium LIKE '%{$medium}%'";
    }
    if ($shop != null) {
        $shopSearch = $shop == "グループ全体" ? "" : $shop;
        $sqlCount .= " AND shop LIKE '%{$shopSearch}%'";
    }
    if ($staff != null) {
        $sqlCount .= " AND staff LIKE '%{$staff}%'";
    }
    if ($rank != null) {
        $sqlCount .= " AND rank LIKE '%{$rank}%'";
    }
    if ($section != null) {
        $sqlCount .= " AND section LIKE '%{$section}%'";
    }
    if ($register != null) {
        $sqlCount .= " AND register LIKE '%{$register}%'";
    }
    // if ($step == "reserve") {
    //     $sqlCount .= " AND reserve LIKE '%202%'";
    // }
    // if ($step == "contract") {
    //     $sqlCount .= " AND contract LIKE '%日%'";
    // }

    if ($startMonth != "" || $endMonth != "") {
        $startMonth = $startMonth =="" ? $endMonth : $startMonth;
        $endMonth = $endMonth == "" ? $startMonth : $endMonth;  
        $sqlCount .= " AND register BETWEEN '{$startMonth}/01' AND '{$endMonth}/31'";
    }

    // SQLクエリの準備と実行
    try {
        $stmtCount = $pdo->prepare($sqlCount);
        $stmtCount->execute();
        $rowCount = $stmtCount->fetch(PDO::FETCH_ASSOC);

        if ($rowCount) {
            $totalCount = $rowCount['totalCount'];
        } else {
            $totalCount = 0;
        }
    } catch (PDOException $e) {
        echo json_encode(array(
            'error' => 'クエリの実行中にエラーが発生しました: ' . $e->getMessage()
        ));
        exit;
    }


    // SQLクエリを構築
    $sql = "SELECT * FROM customers
    WHERE date LIKE '%202%' AND status <> '契約済み'";

    if ($medium != null) {
        $sql .= " AND medium LIKE '%{$medium}%'";
    }
    if ($shop != null) {
        $shopSearch = $shop == "グループ全体" ? "" : $shop;
        $sql .= " AND shop LIKE '%{$shopSearch}%'";
    }
    if ($staff != null) {
        $sql .= " AND staff LIKE '%{$staff}%'";
    }
    if ($rank != null) {
        $sql .= " AND rank LIKE '%{$rank}%'";
    }
    if ($section != null) {
        $sql .= " AND section LIKE '%{$section}%'";
    }
    if ($register != null) {
        $sql .= " AND register LIKE '%{$register}%'";
    }
    // if ($step == "reserve") {$
    //     $sql .= " AND reserve LIKE '%202%'";
    // }
    // if ($step == "contract") {
    //     $sql .= " AND contract LIKE '%日%'";
    // }
    
    if ($startMonth != "" || $endMonth != "") {
        $startMonth = $startMonth =="" ? $endMonth : $startMonth;
        $endMonth = $endMonth == "" ? $startMonth : $endMonth;  
        $sql .= " AND register BETWEEN '{$startMonth}/01' AND '{$endMonth}/31'";
    }
    $itemsPerPage = 10;
    $offset = ($page - 1) * $itemsPerPage;
    $sql .= " LIMIT " . $itemsPerPage . " OFFSET " . $offset;
    // SQLクエリの実行
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 結果をJSON形式で出力
    echo json_encode(array(
        'totalCount' => $totalCount,
        'customers' => $customers
    ));
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
