<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);

$username = $data['mail'];
$password = $data['password'];

// 簡易的なバリデーション
if (empty($username) || empty($password)) {
    echo json_encode(["message" => "error", "details" => "メールアドレスまたはパスワードが未入力です"]);
    exit;
}

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

        // ユーザーをデータベースから取得
        $stmt = $pdo->prepare("SELECT mail, password, brand ,id ,name FROM staff WHERE mail = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            if ($password == $user['password']) {
                session_start();
                echo json_encode(["message" => "success", "brand" => $user['brand']]);
                $timestamp = date('Y/m/d H:i');
                $stmt = $pdo->prepare("INSERT INTO login_log (timestamp, staff) VALUES ( ?, ? )");
                $stmt->execute([$timestamp, $user['name']]);
                exit();
            } else {
                // 認証失敗時の対応
                echo json_encode(["message" => "error", "details" => "パスワードが間違っています"]);

            }
        } else {
            // 認証失敗時の対応
            echo json_encode(["message" => "error", "details" => "メールアドレスまたはパスワードが間違っています"]);
        }
    } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "メールアドレスまたはパスワードが間違っています"]);
    }

?>
