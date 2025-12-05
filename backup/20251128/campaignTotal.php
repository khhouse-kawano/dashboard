<?php
header("Content-Type: application/json");
$data = json_decode(file_get_contents("php://input"), true);


    // // ローカルデータベース接続 (PDO)
    // $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
    // $db_user = 'root';
    // $db_password = '';

    // 本番サーバーデータベース接続 (PDO)
    $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
    $db_user = 'xs200571_kawano';
    $db_password = '4081kawano';
    $selectedMonth = isset($data['selectedStartMonth']) ? $data['selectedStartMonth'] : null;
try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// 初期SQLを作成
    $sql = "SELECT キャンペーン名,
            ブランド,
            COUNT(*) AS total
            FROM pgcloud";

    $params = [];

    // $selectedMonthが存在するときのみWHERE句を追加
    if ($selectedMonth) {
        $sql .= " WHERE タイムスタンプ LIKE :selectedMonth ";
        $params[':selectedMonth'] = "%$selectedMonth%";
    }

    error_log("実行するSQL: " . $sql);

    // GROUP BY と ORDER BY を追加
    $sql .= " GROUP BY キャンペーン名
              ORDER BY total DESC";

    // PDOを使った場合の例
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll();

    echo json_encode($customers);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
?>
