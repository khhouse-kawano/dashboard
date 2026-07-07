<?php
// CORSヘッダー（共通）
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);
$demand = isset($data['demand']) ? $data['demand'] : "";
$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
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

    if ($demand === "contract_goal" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM contract_goal";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "customer_list" && $authHeader === '4081Kokubu') {
        $nowMonth = date('Y/m');
        $month = isset($data['month']) ? $data['month'] : $nowMonth;
        $sql = "SELECT name, medium, register, reserve, shop, contract, rank, section
        FROM customers ;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "customer_detail" && $authHeader === '4081Kokubu') {
        $sql = "SELECT 
    c.id, 
    c.name, 
    c.status, 
    c.medium, 
    c.rank, 
    c.register, 
    c.reserve, 
    c.shop, 
    c.medium, 
    c.estate, 
    c.meeting, 
    c.appointment, 
    c.line_group, 
    c.screening, 
    c.rival, 
    c.period, 
    c.survey, 
    c.budget, 
    c.importance, 
    c.note, 
    c.staff, 
    c.section, 
    c.contract, 
    c.sales_meeting, 
    (SELECT date FROM customers ORDER BY STR_TO_DATE(date, '%Y/%c/%d %H:%i:%s') DESC LIMIT 1) AS latest_date,
    (SELECT sales_meeting FROM customers ORDER BY LENGTH(sales_meeting) DESC LIMIT 1) AS last_meeting
    FROM customers AS c
    ORDER BY STR_TO_DATE(c.register, '%Y/%m/%d') DESC;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "all_customer" && $authHeader === '4081Kokubu') {
        $nowMonth = date('Y/m');
        $month = isset($data['month']) ? $data['month'] : $nowMonth;
        $sql = "SELECT *
        FROM customers ;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "customer_database" && $authHeader === '4081Kokubu') {
        $sql = "SELECT id, shop, name, staff, status, rank, medium, reserve, register, contract, before_survey, before_interview, after_interview, call_status, reserved_status, phone_number, full_address, response_status
        FROM customers ORDER BY register DESC;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "trend_customer" && $authHeader === '4081Kokubu') {
        $nowMonth = date('Y/m');
        $month = isset($data['month']) ? $data['month'] : $nowMonth;
        $sql = "SELECT register, reserve, contract, shop, reserved_status, appointment, second_reserve
        FROM customers ;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "shop_list" && $authHeader === '4081Kokubu') {
        $sql = "SELECT brand, shop, section, area
        FROM shop_list WHERE show_flag = 1";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "staff_list" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM staff_list";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "medium_list" && $authHeader === '4081Kokubu') {
        $sql = "SELECT *
        FROM medium_list
        WHERE response_medium = 0
        ORDER BY sort_key ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "inquiry_list" && $authHeader === '4081Kokubu') {
        $nowMonth = date('Y/m');
        $month = isset($data['month']) ? $data['month'] : $nowMonth;

        $sql = "SELECT id, inquiry_id, pg_id, mhl_id, mhl_url, mhl_mail, inquiry_date, medium, response_medium, first_name, last_name,
        first_name_kana, last_name_kana, mobile, landline, mail, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
        reserved_date, black_list, hp_campaign, duplicate, hotlead_url  FROM inquiry_customer ORDER By inquiry_date DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "achievement_list" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM achievement";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "shop_change" && $authHeader === '4081Kokubu') {
        $list = isset($data['list']) ? $data['list'] : "";
        $inquiry_id = isset($data['inquiry_id']) ? $data['inquiry_id'] : "";
        $brand = '';
        if (substr($list, 0, 2) === 'JH') {
            $brand = 'JH';
        } elseif (strpos($list, 'DJH') !== false) {
            $brand = 'DJH';
        } elseif (strpos($list, 'KH') !== false) {
            $brand = 'KH';
        } elseif (strpos($list, '2L') !== false) {
            $brand = '2L';
        } elseif (strpos($list, 'なごみ') !== false) {
            $brand = 'Nagomi';
        } elseif (strpos($list, 'PG') !== false) {
            $brand = 'PGH';
        } elseif (strpos($list, 'ブランド・店舗未設定') !== false) {
            $brand = 'KHG';
        }

        $sqlUpdate = "UPDATE inquiry_customer 
                SET shop = ? , brand = ?
                WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$list, $brand, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "tag" && $authHeader === '4081Kokubu') {
        $list = isset($data['list']) ? $data['list'] : "";
        $inquiry_id = isset($data['inquiry_id']) ? $data['inquiry_id'] : "";

        $sqlUpdate = "UPDATE inquiry_customer 
            SET black_list = CONCAT(black_list, ' ', ?)
            WHERE inquiry_id = ?";

        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$list, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "staff_change" && $authHeader === '4081Kokubu') {
        $list = isset($data['list']) ? $data['list'] : "";
        $inquiry_id = isset($data['inquiry_id']) ? $data['inquiry_id'] : "";

        $sqlUpdate = "UPDATE inquiry_customer 
            SET staff = ?
            WHERE inquiry_id = ?";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute([$list, $inquiry_id]);
        $customersUpdate = $stmtUpdate->fetchAll(PDO::FETCH_ASSOC);

        $newSql = "SELECT *
        FROM inquiry_customer ORDER BY inquiry_date DESC";

        $stmt = $pdo->prepare($newSql);
        $stmt->execute();
        $newCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($newCustomers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "reserve_goal" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM achievement";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "reserve_calendar" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM reserved_calendar";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "form_set" && $authHeader === '4081Kokubu') {
        $brand = isset($data['brand']) ? $data['brand'] : "";
        $campaign = isset($data['campaign']) ? $data['campaign'] : "";
        $campaign_id = isset($data['campaign_id']) ? $data['campaign_id'] : "";
        $mail_to = isset($data['mail_to']) ? $data['mail_to'] : "";
        $mail_cc = isset($data['mail_cc']) ? $data['mail_cc'] : "";
        $redirect = isset($data['redirect']) ? $data['redirect'] : "";
        $notice = isset($data['notice']) ? $data['notice'] : "";
        $shop = isset($data['shop']) ? $data['shop'] : "";
        $date = isset($data['date']) ? $data['date'] : "";
        $name = isset($data['name']) ? $data['name'] : "";
        $kana = isset($data['kana']) ? $data['kana'] : "";
        $age = isset($data['age']) ? $data['age'] : "";
        $phone = isset($data['phone']) ? $data['phone'] : "";
        $mail = isset($data['mail']) ? $data['mail'] : "";
        $address = isset($data['address']) ? $data['address'] : "";
        $medium = isset($data['medium']) ? $data['medium'] : "";
        $question = isset($data['question']) ? $data['question'] : "";

        $sql = "INSERT INTO form_database ( brand, campaign, campaign_id, mail_to, mail_cc, redirect, notice, shop, date, name, kana, age, phone, mail, address, medium, question)
        VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([$brand, $campaign, $campaign_id, $mail_to, $mail_cc, $redirect, $notice, $shop, $date, $name, $kana, $age, $phone, $mail, $address, $medium, $question]);

        if ($stmt) {
            $response = ['status' => 'success', 'message' => '登録完了しました'];
        } else {
            $response = ['status' => 'error', 'message' => '登録エラー'];
        }
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "before_survey" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM before_survey ORDER BY dateStr DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "after_survey" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM after_survey";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "survey_list" && $authHeader === '4081Kokubu') {
        $nowMonth = date('Y/m');
        $month = isset($data['month']) ? $data['month'] : $nowMonth;
        $sql = "SELECT name, id, shop, register, name, shop, staff
        FROM customers ORDER BY register DESC;";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "contract_expected" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM contract_expected";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "contract_ex_update" && $authHeader === '4081Kokubu') {
        $searchSql = "SELECT * FROM contract_expected WHERE date = ? AND shop = ?";
        $stmt = $pdo->prepare($searchSql);
        $stmt->execute([$data['date'], $data['shop']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($rows) {
            $sql = "UPDATE contract_expected SET count = ? WHERE date = ? AND shop = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['count'], $data['date'], $data['shop']]);
            $response = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            $sql = "INSERT INTO contract_expected (`date`, `section`, `shop`, `count`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `count` = VALUES(`count`)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['date'], $data['section'], $data['shop'], $data['count']]);

            $selectSql = "SELECT * FROM contract_expected WHERE `date` = ? AND `shop` = ?";
            $responseStmt = $pdo->prepare($selectSql);
            $responseStmt->execute([$data['date'], $data['shop']]);
            $response = $responseStmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } elseif ($demand === "campaign" && $authHeader === '4081Kokubu') {
        $sql = "SELECT タイムスタンプ as period, ブランド as brand, キャンペーン名 as name FROM pgcloud";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $response = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "master_data_for_survey" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM master_data WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$data['id']]);
        $response = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "show_before_survey" && $authHeader === '4081Kokubu') {
        $sql = "SELECT * FROM before_survey WHERE LEFT(brand, 2) = ? AND REPLACE(REPLACE(name, ' ', ''), '　', '') = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$data['brand'], preg_replace('/[ 　]/u', '', $data['name'])]);
        $response = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "show_before_interview" && $authHeader === '4081Kokubu') {
        try {
            $sql = "SELECT * FROM before_interview WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['id']]);

            if ($stmt->rowCount() > 0) {
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                $response =  $result;
            } else {
                $sql = "SELECT * FROM before_interview WHERE LEFT(shop, 2) = ? AND REPLACE(REPLACE(name, ' ', ''), '　', '') = ?";
                $stmt = $pdo->prepare($sql);
                $normalizedName = preg_replace('/[ 　]/u', '', $data['name']);
                $stmt->execute([$data['brand'], $normalizedName]);
                if ($stmt->rowCount() > 0) {
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    $response = $result;
                } else {
                    $response = [
                        'status' => 'not_found',
                        'message' => '該当するデータが見つかりませんでした'
                    ];
                }
            }
        } catch (PDOException $e) {
            $response = [
                'status' => 'error',
                'message' => '登録エラー: ' . $e->getMessage()
            ];
        }

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "show_after_interview" && $authHeader === '4081Kokubu') {
        try {
            $sql = "SELECT * FROM after_interview WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['id']]);

            if ($stmt->rowCount() > 0) {
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                $response =  $result;
            } else {
                $sql = "SELECT * FROM after_interview WHERE LEFT(shop, 2) = ? AND REPLACE(REPLACE(name, ' ', ''), '　', '') = ?";
                $stmt = $pdo->prepare($sql);
                $normalizedName = preg_replace('/[ 　]/u', '', $data['name']);
                $stmt->execute([$data['brand'], $normalizedName]);
                if ($stmt->rowCount() > 0) {
                    $result = $stmt->fetch(PDO::FETCH_ASSOC);
                    $response = $result;
                } else {
                    $response = [
                        'status' => 'not_found',
                        'message' => '該当するデータが見つかりませんでした'
                    ];
                }
            }
        } catch (PDOException $e) {
            $response = [
                'status' => 'error',
                'message' => '登録エラー: ' . $e->getMessage()
            ];
        }

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "show_customer_interview" && $authHeader === '4081Kokubu') {
        try {
            $sql = "SELECT * FROM master_data WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['id']]);

            if ($stmt->rowCount() > 0) {
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                $response =  $result;
            } else {
                $response = [
                    'status' => 'not_found',
                    'message' => '該当するデータが見つかりませんでした'
                ];
            }
        } catch (PDOException $e) {
            $response = [
                'status' => 'error',
                'message' => '登録エラー: ' . $e->getMessage()
            ];
        }

        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "myhomerobo_test_mail" && $authHeader === '4081Kokubu') {
        try {
            $subject = $data['title'];
            $message = $data['html'];
            mb_language("Japanese");
            mb_internal_encoding("UTF-8");
            $encoded_subject = mb_encode_mimeheader($subject, "UTF-8");
            $headers = "From: " . mb_encode_mimeheader('テストメール') . "<pgcloud@khg-marketing.info>\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $headers .= "Content-Transfer-Encoding: 8bit\r\n";

            if (!empty($data['from']) && !empty($data['html'])) {
                mail($data['from'], $encoded_subject, $message, $headers);
            }
            $response = [
                'status' => 'success',
                'message' => '送信完了'
            ];
        } catch (PDOException $e) {
            $response = [
                'status' => 'error',
                'message' => '登録エラー: ' . $e->getMessage()
            ];
        }
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "myhomerobo_customer_mail" && $authHeader === '4081Kokubu') {
        try {
            $subject = $data['title'];
            $message = $data['html'];
            mb_language("Japanese");
            mb_internal_encoding("UTF-8");
            $encoded_subject = mb_encode_mimeheader($subject, "UTF-8");
            $headers = "From: " . mb_encode_mimeheader($data['brand']) . "<pgcloud@khg-marketing.info>\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $headers .= "Content-Transfer-Encoding: 8bit\r\n";

            if (!empty($data['to']) && !empty($data['html'])) {
                mail($data['to'], $encoded_subject, $message, $headers);
            }
            $response = [
                'status' => 'success',
                'message' => '送信完了'
            ];
        } catch (PDOException $e) {
            $response = [
                'status' => 'error',
                'message' => '登録エラー: ' . $e->getMessage()
            ];
        }
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } elseif ($demand === "open_myhomerobo_mail" && $authHeader === '4081Kokubu') {
        $inquiry_id = isset($data['id']) ? $data['id'] : "";

        $sqlUpdate = "UPDATE inquiry_customer
        SET mhl_mail = ?
        WHERE inquiry_id = ? AND mhl_mail = ''";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $now = date("Y-m-d H:i:s");
        if ($stmtUpdate->execute([$now . ',' . $data['ua'] . ',' . $data['ip'], $inquiry_id])) {
            echo json_encode(["status" => "success"], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(["status" => "error"], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } elseif ($demand === "show_customer_call_log" && $authHeader === '4081Kokubu') {
        try {
            $sql = "SELECT * FROM call_sheet WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['id']]);

            if ($stmt->rowCount() > 0) {
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                $response =  $result;
                echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                $response = [
                    'status' => 'not_found',
                    'message' => '該当するデータが見つかりませんでした'
                ];
                echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        } catch (PDOException $e) {
            $response = [
                'status' => 'error',
                'message' => '登録エラー: ' . $e->getMessage()
            ];
        }
    } elseif ($demand === "update_call_log" && $authHeader === '4081Kokubu') {
        try {
            $sql = "SELECT * FROM call_sheet WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$data['id']]);

            if ($stmt->rowCount() > 0) {
                $updateSql = 'UPDATE call_sheet SET call_log = :call_log, status = :status, shop = :shop, reserved_status = :reserved_status WHERE id = :id';
                $updateStmt = $pdo->prepare($updateSql);
                $updateStmt->bindValue(':call_log', json_encode($data['call_log']), PDO::PARAM_STR);
                $updateStmt->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
                $updateStmt->bindValue(':status', $data['status'], PDO::PARAM_STR);
                $updateStmt->bindValue(':reserved_status', $data['reserved_status'], PDO::PARAM_STR);
                $updateStmt->bindValue(':id', $data['id'], PDO::PARAM_STR);
                if ($updateStmt->execute()) {
                    $response = ['status' => 'success', 'message' => $data['name'] . 'の登録に成功しました。'];
                    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } else {
                    $response = ['status' => 'error', 'message' => $data['name'] . 'の登録に失敗しました。'];
                    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
            } else {
                $insertSql = 'INSERT INTO call_sheet (id, shop, name, call_log, status, reserved_status) VALUES (:id, :shop, :name, :call_log, :status, :reserved_status)';
                $insertStmt = $pdo->prepare($insertSql);
                $insertStmt->bindValue(':id', $data['id'], PDO::PARAM_STR);
                $insertStmt->bindValue(':shop', $data['shop'], PDO::PARAM_STR);
                $insertStmt->bindValue(':name', $data['name'], PDO::PARAM_STR);
                $insertStmt->bindValue(':status', $data['status'], PDO::PARAM_STR);
                $insertStmt->bindValue(':reserved_status', $data['reserved_status'], PDO::PARAM_STR);
                $insertStmt->bindValue(':call_log', json_encode($data['call_log']), PDO::PARAM_STR);
                if ($insertStmt->execute()) {
                    $response = ['status' => 'success', 'message' => $data['name'] . 'のアップデートに成功しました。'];
                    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } else {
                    $response = ['status' => 'error', 'message' => $data['name'] . 'の登録に失敗しました。'];
                    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                }
            }
        } catch (PDOException $e) {
            $response = [
                'status' => 'error',
                'message' => '登録エラー: ' . $e->getMessage()
            ];
        }
    } elseif ($demand === "customer_budget" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT * FROM budget WHERE section = 'order' AND response_medium = 0";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "customer_budget_kaeru" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT * FROM budget WHERE section = 'spec' AND response_medium = 0";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "khf_customer" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT * FROM khf_customers";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "customer_map" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT status, register, reserve, contract, shop, medium, full_address, lat_lng FROM customers WHERE reserve <> ''";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "map_check" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT id, full_address, lat_lng FROM customers WHERE reserve like '%2025%' AND full_address <> '' AND lat_lng =''";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "address_list" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT * FROM area_list";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "customer_summary" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT register, reserve, shop, medium FROM customers";

            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "contract_customer" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // SQLクエリを構築
            $sql = "SELECT contractDate, staff, section, shop FROM contract_customer";

            // プレースホルダーを使ってステートメントを実行
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "contract_staff" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // SQLクエリを構築
            $sql = "SELECT *
    FROM staffcontract";

            // プレースホルダーを使ってステートメントを実行
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "contract_shop" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // SQLクエリを構築
            $sql = "SELECT shop, section FROM shop_list";
            // プレースホルダーを使ってステートメントを実行
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "section_list" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT *FROM section_list";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "breakaway" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "INSERT INTO breakaway (brand, campaign, time, filled) VALUES (?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $success = $stmt->execute([$data['brand'], $data['campaign'], $data['time'], $data['filled']]);

            if ($success) {
                echo json_encode([
                    "message" => "success",
                    "details" => "データベースに追加しました",
                    "inserted" => [
                        "brand"    => $data['brand'],
                        "campaign" => $data['campaign'],
                        "time"     => $data['time'],
                        "filled"   => $data['filled']
                    ]
                ]);
            } else {
                echo json_encode([
                    "message" => "error",
                    "details" => "データベースへの追加に失敗しました"
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } elseif ($demand === "form_show" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT * FROM form_show";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "form_list" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT campaign, campaign_id FROM form_table";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "breakaway_list" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT * FROM breakaway";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "shop_review" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "SELECT * FROM google_review";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    } elseif ($demand === "post_review" && $authHeader === '4081Kokubu') {
        try {
            $pdo = new PDO($dsn, $db_user, $db_password);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $recently_review = is_array($data['recently_review'])
                ? json_encode($data['recently_review'], JSON_UNESCAPED_UNICODE)
                : $data['recently_review'];

            $review_history = is_array($data['review_history'])
                ? json_encode($data['review_history'], JSON_UNESCAPED_UNICODE)
                : $data['review_history'];

            $updateSql = "UPDATE google_review 
                SET average = ? , amount = ?, recently_review = ?, review_history = ?
                WHERE id = ?";
            $updateStmt = $pdo->prepare($updateSql);
            if ($updateStmt->execute([$data['average'], $data['amount'], $recently_review, $review_history, $data['id']])) {
                echo json_encode(["message" => "success", "details" => "レビューを更新しました"]);
            } else {
                echo json_encode(["message" => "error", "details" => "更新に失敗しました"]);
            }
        } catch (PDOException $e) {
            // エラーハンドリング
            echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
        }
    }
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
