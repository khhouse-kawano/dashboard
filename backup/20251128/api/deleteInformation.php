
<?php
// CORS設定
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

$data = json_decode(file_get_contents("php://input"), true);

$id = isset($_POST['id']) ? $_POST['id'] : '';

try {
    $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
    $user = 'xs200571_kawano';
    $password = '4081kawano';
    try {
        $dbh = new PDO($dsn, $user, $password);
    } catch (PDOException $e) {
        echo json_encode(['status' => 'error', 'message' => '接続失敗: ' . $e->getMessage()]);
        exit();
    }

    $sql = "UPDATE information SET list = 0 WHERE id = :id";
    $stm = $dbh->prepare($sql);
    $stm->bindValue(':id', $id, PDO::PARAM_STR);
    if ($stm->execute()) {
        $response_sql = "SELECT * FROM information ORDER BY id DESC";

        // プレースホルダーを使ってステートメントを実行
        $stmt = $dbh->prepare($response_sql);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode([
            'status' => 'success',
            'message' => $id . 'のお知らせを非表示にしました。',
            'customers' => $customers
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'データの追加に失敗しました。'], JSON_UNESCAPED_UNICODE);
    }
    } catch (PDOException $e) {
    // $subject_fail = '顧客名: ' . $name . 'の登録に失敗';
    // $message_fail = '
    // <html>
    // <head>
    // <title style="font-size:1rem;color:#928178;">顧客名: ' . $name . 'の登録に失敗</title>
    // </head>
    // <body><div>
    // <br><br>顧客名: ' . $name . 'の登録に失敗しました。<br><br>以下エラー詳細<br>
    // ' . $e->getMessage() . '
    // </div>
    // </body>
    // </html>
    // ';
    // $headers_fail = 'From: 顧客名: ' . $name . 'の登録に失敗 <pgcloud@khg-marketing.info>' . "\r\n" .
    // 'Content-type: text/html; charset=UTF-8';

    // mail('shinji.kawano@kh-group.jp', $subject_fail, $message_fail, $headers_fail);

    echo json_encode(['status' => 'error', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
