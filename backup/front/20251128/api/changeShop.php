<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$shop = isset($data['shop']) ? $data['shop'] : "";
$staff = isset($data['staff']) ? $data['staff'] : "";
$demand = isset($data['demand']) ? $data['demand'] : "";
$inquiry_id = isset($data['inquiry_id']) ? $data['inquiry_id'] : "";
$pg_id = isset($data['pg_id']) ? $data['pg_id'] : "";
$mhl_id = isset($data['mhl_id']) ? $data['mhl_id'] : "";
$mhl_url = isset($data['mhl_url']) ? $data['mhl_url'] : "";
$black_list = isset($data['black_list']) ? $data['black_list'] : "";
$note = isset($data['note']) ? $data['note'] : "";

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

    if ($demand === 'shop' && $shop !== 'duplicate') {
        $brand = '';
        if (substr($shop, 0, 2) === 'JH') {
            $brand = 'JH';
        } elseif (strpos($shop, 'DJH') !== false) {
            $brand = 'DJH';
        } elseif (strpos($shop, 'KH') !== false) {
            $brand = 'KH';
        } elseif (strpos($shop, '2L') !== false) {
            $brand = '2L';
        } elseif (strpos($shop, 'なごみ') !== false) {
            $brand = 'Nagomi';
        } elseif (strpos($shop, 'PG') !== false) {
            $brand = 'PGH';
        } elseif (strpos($shop, 'ブランド・店舗未設定') !== false) {
            $brand = 'KHG';
        }

        $sqlUpdate = "UPDATE inquiry_customer 
                SET shop = ? , brand = ?
                WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$shop, $brand, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'shop' && $shop === 'duplicate') {
        $sqlUpdate = "UPDATE inquiry_customer 
            SET shop = CONCAT(shop, '重複名簿'), sync = 1 
            WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'sync') {
        $sqlUpdate = "UPDATE inquiry_customer 
            SET sync = 1, pg_id = ?
            WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$pg_id, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'staff') {
        $sqlUpdate = "UPDATE inquiry_customer 
            SET staff = ?
            WHERE inquiry_id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$staff, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'tag') {
        $sqlUpdate = "UPDATE inquiry_customer 
            SET black_list = CONCAT(black_list, ' ', ?)
            WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$black_list, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'sync_error') {
        $sqlUpdate = "UPDATE inquiry_customer 
            SET sync = 0
            WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'note') {
        $sqlUpdate = "UPDATE inquiry_customer 
            SET note = ?
            WHERE inquiry_id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$note, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'robo') {
        $sqlUpdate = "UPDATE inquiry_customer 
            SET mhl_id = ?, mhl_url = ?
            WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$mhl_id, $mhl_url, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'before_survey') {
        $data = json_decode(file_get_contents("php://input"), true);
        $sbid = isset($data['sbid']) ? $data['sbid'] : "";
        $sqlUpdate = "UPDATE before_survey 
            SET sync = 1
            WHERE id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$sbid]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM before_survey";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers);
    } elseif ($demand === 'new_customer') {
        $data = json_decode(file_get_contents("php://input"), true);
        $sql = 'SELECT * FROM customers WHERE id = ?';
        $stmtSql = $pdo->prepare(($sql));
        $stmtSql->execute([$data['id']]);
        $customers = $stmtSql->fetch(PDO::FETCH_ASSOC);

        if (!$customers) {
            $insertSql = 'INSERT INTO customers (id, register, shop, reserved_status, response_status)
            VALUES (:id, :register, :shop, :reserved_status, :response_status)';
            $stmtInsertSql = $pdo->prepare(($insertSql));
            $stmtInsertSql->bindValue(':id', $data['id'], PDO::PARAM_STR);
            $stmtInsertSql->bindValue(':register', $data['register'], PDO::PARAM_STR);
            $stmtInsertSql->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
            $stmtInsertSql->bindValue(':reserved_status', $data['reserved_status'], PDO::PARAM_STR);
            $stmtInsertSql->bindValue(':response_status', $data['response_status'], PDO::PARAM_STR);
            if ($stmtInsertSql->execute()) {
                echo json_encode(['status' => 'success']);
            } else {
                echo json_encode(['status' => 'error']);
            }
        }
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
