
<?php
// CORS設定
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

$data = json_decode(file_get_contents("php://input"), true);

$id = isset($_POST['id']) ? $_POST['id'] : '';
$title = isset($_POST['title']) ? $_POST['title'] : '';
$forum = isset($_POST['forum']) ? $_POST['forum'] : '';
$poster = isset($_POST['poster']) ? $_POST['poster'] : '';

$uploadedFiles = [];

foreach ($_FILES as $key => $file){
    $uploadDir = "uploads/";
    $fileName = basename($file["name"]);
    $filePath = $uploadDir . $fileName;
    if (move_uploaded_file($file["tmp_name"], $filePath)) {
        $uploadedFiles[] = [
            "name" => $fileName,
            "url" => "/uploads/" . $fileName
        ];
    }
}

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

    $today = date('Y/m/d');

    $stmt = $dbh->prepare("SELECT * FROM information WHERE id = ?");
    $stmt->execute([$id]);
    $data = $stmt->fetch(PDO::FETCH_ASSOC);

    $img_1 = (count($uploadedFiles) > 0) ? $uploadedFiles[0]["url"] : "";
    $img_2 = (count($uploadedFiles) > 1) ? $uploadedFiles[1]["url"] : "";
    $img_3 = (count($uploadedFiles) > 2) ? $uploadedFiles[2]["url"] : "";
    $img_4 = (count($uploadedFiles) > 3) ? $uploadedFiles[3]["url"] : "";
    
    if ($data && $id !=="") {
        $sql = "UPDATE information SET title = :title, content = :forum, poster = :poster, img_1 = :img_1, img_2 = :img_2, img_3 = :img_3, img_4 = :img_4 WHERE id = :id";
        $stm = $dbh->prepare($sql);
        $stm->bindValue(':title', $title, PDO::PARAM_STR);
        $stm->bindValue(':forum', $forum, PDO::PARAM_STR);
        $stm->bindValue(':id', $id, PDO::PARAM_INT);
        $stm->bindValue(':poster', $poster, PDO::PARAM_STR);
        $stm->bindValue(':img_1', $img_1, PDO::PARAM_STR);
        $stm->bindValue(':img_2', $img_2, PDO::PARAM_STR);
        $stm->bindValue(':img_3', $img_3, PDO::PARAM_STR);
        $stm->bindValue(':img_4', $img_4, PDO::PARAM_STR);

        if ($stm->execute()) {
            $response_sql = "SELECT * FROM information ORDER BY id DESC";

            // プレースホルダーを使ってステートメントを実行
            $stmt = $dbh->prepare($response_sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode([
                'status' => 'success',
                'message' => $title . 'のデータが正常に追加されました。',
                'customers' => $customers
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'データの更新に失敗しました。'], JSON_UNESCAPED_UNICODE);
        }
    } else {
        $sql = "INSERT INTO information (title, content, poster, date, img_1, img_2, img_3, img_4, list) VALUES (:title, :forum, :poster, :date, :img_1, :img_2, :img_3, :img_4, 1)";
        $stm = $dbh->prepare($sql);
        $stm->bindValue(':title', $title, PDO::PARAM_STR);
        $stm->bindValue(':forum', $forum, PDO::PARAM_STR);
        $stm->bindValue(':poster', $poster, PDO::PARAM_STR);
        $stm->bindValue(':date', $today, PDO::PARAM_STR);
        $stm->bindValue(':img_1', $img_1, PDO::PARAM_STR);
        $stm->bindValue(':img_2', $img_2, PDO::PARAM_STR);
        $stm->bindValue(':img_3', $img_3, PDO::PARAM_STR);
        $stm->bindValue(':img_4', $img_4, PDO::PARAM_STR);
        if ($stm->execute()) {
            $response_sql = "SELECT * FROM information ORDER BY id DESC";

            // プレースホルダーを使ってステートメントを実行
            $stmt = $dbh->prepare($response_sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode([
                'status' => 'success',
                'message' => $title . 'のデータが正常に追加されました。',
                'customers' => $customers
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'データの追加に失敗しました。'], JSON_UNESCAPED_UNICODE);
        }
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
