<?php
// CORS設定
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$id = isset($data['id']) ? $data['id'] : "";
$shop = isset($data['shop']) ? $data['shop'] : "";
$name = isset($data['name']) ? $data['name'] : "";
$staff = isset($data['staff']) ? $data['staff'] : "";
$register = isset($data['register']) ? $data['register'] : "";
$reserve = isset($data['reserve']) ? $data['reserve'] : "";
$rank = isset($data['rank']) ? $data['rank'] : "";
$medium = isset($data['medium']) ? $data['medium'] : "";
$appointment = isset($data['appointment']) ? $data['appointment'] : "";
$line_group = isset($data['line_group']) ? $data['line_group'] : "";
$screening = isset($data['screening']) ? $data['screening'] : "";
$period = isset($data['period']) ? $data['period'] : "";
$rival = isset($data['rival']) ? $data['rival'] : "";
$estate = isset($data['estate']) ? $data['estate'] : "";
$budget = isset($data['budget']) ? $data['budget'] : "";
$importance = isset($data['importance']) ? $data['importance'] : "";
$survey = isset($data['survey']) ? $data['survey'] : "";
$note = isset($data['note']) ? $data['note'] : "";
$demand = isset($data['demand']) ? $data['demand'] : "";

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

    date_default_timezone_set('Asia/Tokyo');
    //date('Y/m/d H:i:s');
    $stmt = $dbh->prepare("SELECT * FROM customers WHERE id LIKE ?");
    $idString = "%".$id."%";
    $stmt->execute([$idString]);

    if ( $demand === 'changeByDashboard' && $stmt->rowCount() > 0) {
        $sql = "UPDATE customers 
        SET date = :date, 
        register = :register, 
        reserve = :reserve, 
        staff = :staff, 
        rank = :rank, 
        estate = :estate, 
        budget = :budget, 
        medium = :medium, 
        survey = :survey,
        importance = :importance,
        period = :period,
        note = :note,
        rival = :rival,
        appointment = :appointment,
        line_group = :line_group,
        screening = :screening WHERE id LIKE :id";
        $stm = $dbh->prepare($sql);
        $stm->bindValue(':date', date('Y/m/d H:i:s'), PDO::PARAM_STR);
        $stm->bindValue(':register', $register, PDO::PARAM_STR);
        $stm->bindValue(':reserve', $reserve, PDO::PARAM_STR);
        $stm->bindValue(':rank', $rank, PDO::PARAM_STR);
        $stm->bindValue(':staff', $staff, PDO::PARAM_STR);
        $stm->bindValue(':estate', $estate, PDO::PARAM_STR);
        $stm->bindValue(':budget', $budget, PDO::PARAM_STR);
        $stm->bindValue(':medium', $medium, PDO::PARAM_STR);
        $stm->bindValue(':survey', $survey, PDO::PARAM_STR);
        $stm->bindValue(':importance', $importance, PDO::PARAM_STR);
        $stm->bindValue(':period', $period, PDO::PARAM_STR);
        $stm->bindValue(':note', $note, PDO::PARAM_STR);
        $stm->bindValue(':rival', $rival, PDO::PARAM_STR);
        $stm->bindValue(':line_group', $line_group, PDO::PARAM_STR);
        $stm->bindValue(':appointment', $appointment, PDO::PARAM_STR);
        $stm->bindValue(':screening', $screening, PDO::PARAM_STR);
        $stm->bindValue(':id', "%{$id}%", PDO::PARAM_STR);
        if ($stm->execute()) {
            echo json_encode(['status' => 'success', 'message' => $name.'のデータが正常に更新されました。']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'データの更新に失敗しました。']);
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

    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
