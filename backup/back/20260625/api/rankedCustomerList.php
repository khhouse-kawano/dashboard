<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$staff = isset($data['staff']) ? $data['staff'] : "";
$section = isset($data['section']) ? $data['section'] : "";
$shop = isset($data['shop']) ? $data['shop'] : "";
$register = isset($data['register']) ? $data['register'] : "";
$rank = isset($data['rank']) ? $data['rank'] : "";

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

    // SQLクエリを構築
    $sql = "SELECT id, section, shop, staff, name, register, reserve, medium, rank
    FROM customers WHERE status <> '契約済み'";
    if ($shop != null) {
        $sql .= " AND shop LIKE '%{$shop}%'";
    }
    if ($rank != null) {
        $sql .= " AND rank LIKE '%{$rank}%'";
    }
    if ($staff != null) {
        $sql .= " AND staff LIKE '%{$staff}%'";
    }
    if ($section != null) {
        $sql .= " AND section LIKE '%{$section}%'";
    }
    // if ($register != null) {
    //     $sql .= " AND register LIKE '%{$register}%'";
    // }
    // プレースホルダーを使ってステートメントを実行
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($customers, JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
?>
