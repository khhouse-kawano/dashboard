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

$contentType = $_SERVER["CONTENT_TYPE"] ?? '';

if (str_contains($contentType, 'application/json')) {
    $data = json_decode(file_get_contents("php://input"), true);
} else {
    parse_str(file_get_contents("php://input"), $data);
}

$demand = $data['demand'] ?? '';




// 本番サーバーデータベース接続 (PDO)
$dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
$db_user = 'xs200571_kawano';
$db_password = '4081kawano';

if ($demand === 'resale') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = 'SELECT * FROM resale_customers WHERE id_related = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id_related']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    // 履歴オブジェクトの作成
    $newAction = [
        'date' => $data['action_date'],
        'method' => $data['action_method'],
        'subject' => $data['subject'],
        'staff' => $data['staff'],
        'note' => $data['note'],
        'status' => $data['status']
    ];

    if ($result) {
        $existingAction = json_decode($result['action'] ?? '[]', true);
        if (!is_array($existingAction)) {
            $existingAction = [];
        }

        $isDuplicate = false;
        foreach ($existingAction as $entry) {
            if (isset($entry['date']) && $entry['date'] === $data['action_date']) {
                $isDuplicate = true;
                break;
            }
        }

        if (!$isDuplicate) {
            array_unshift($existingAction, $newAction);
            $actionJson = json_encode($existingAction, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $sql = "UPDATE resale_customers SET
            id_action = :id_action,
            shop = :shop,
            name = :name,
            estate_name_1 = :estate_name_1,
            category = JSON_ARRAY_INSERT(COALESCE(category, JSON_ARRAY()), '$[0]', :category),
            medium = :medium,
            `case` = :case,
            id_case = :id_case,
            status = :status,
            action = :action
            WHERE id_related = :id_related";

            $stmt = $pdo->prepare($sql);
            if ($stmt->execute([
                ':id_action' => $data['id_action'],
                ':shop' => $data['shop'],
                ':name' => $data['name'],
                ':estate_name_1' => $data['estate_name_1'],
                ':category' => $data['category'],
                ':medium' => $data['medium'],
                ':case' => $data['case'],
                ':id_case' => $data['id_case'],
                ':status' => $data['status'],
                ':action' => $actionJson,
                ':id_related' => $data['id_related']
            ])) {
                echo json_encode(['status' => 'update_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }
    } else {
        // 初回履歴として1件だけ配列にして保存
        $actionJson = json_encode([$newAction], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $sql = "INSERT INTO resale_customers (
            id_action, shop, id_related, name, estate_name_1,
            category, medium, `case`, id_case, status, action
        ) VALUES (
            :id_action, :shop, :id_related, :name, :estate_name_1,
            JSON_ARRAY(:category),
            :medium,
            :case,
            :id_case,
            :status,
            :action
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':id_action' => $data['id_action'],
            ':shop' => $data['shop'],
            ':id_related' => $data['id_related'],
            ':name' => $data['name'],
            ':estate_name_1' => $data['estate_name_1'],
            ':category' => $data['category'],
            ':medium' => $data['medium'],
            ':case' => $data['case'],
            ':id_case' => $data['id_case'],
            ':status' => $data['status'],
            ':action' => $actionJson
        ])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'kaeru') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sql = 'SELECT * FROM khf_customers WHERE id_related = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id_related']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    // 履歴オブジェクトの作成
    $newAction = [
        'date' => $data['action_date'],
        'method' => $data['action_method'],
        'subject' => $data['subject'],
        'note' => $data['note']
    ];

    if ($result) {
        $existingAction = json_decode($result['action'] ?? '[]', true);
        if (!is_array($existingAction)) {
            $existingAction = [];
        }

        $isDuplicate = false;
        foreach ($existingAction as $entry) {
            if (isset($entry['date']) && $entry['date'] === $data['action_date']) {
                $isDuplicate = true;
                break;
            }
        }

        if (!$isDuplicate) {
            array_unshift($existingAction, $newAction);
            $actionJson = json_encode($existingAction, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $sql = "UPDATE khf_customers SET
            id_action = :id_action,
            staff = :staff,
            shop = :shop,
            name = :name,
            estate_name_1 = :estate_name_1,
            category = JSON_ARRAY_INSERT(COALESCE(category, JSON_ARRAY()), '$[0]', :category),
            medium = :medium,
            `case` = :case,
            id_case = :id_case,
            status = :status,
            action = :action
            WHERE id_related = :id_related";

            $stmt = $pdo->prepare($sql);
            if ($stmt->execute([
                ':id_action' => $data['id_action'],
                ':staff' => $data['staff'],
                ':shop' => $data['shop'],
                ':name' => $data['name'],
                ':estate_name_1' => $data['estate_name_1'],
                ':category' => $data['category'],
                ':medium' => $data['medium'],
                ':case' => $data['case'],
                ':id_case' => $data['id_case'],
                ':status' => $data['status'],
                ':action' => $actionJson,
                ':id_related' => $data['id_related']
            ])) {
                echo json_encode(['status' => 'update_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }
    } else {
        // 初回履歴として1件だけ配列にして保存
        $actionJson = json_encode([$newAction], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $sql = "INSERT INTO khf_customers (
            id_action, staff, shop, id_related, name, estate_name_1,
            category, medium, `case`, id_case, status, action
        ) VALUES (
            :id_action, :staff, :shop, :id_related, :name, :estate_name_1,
            JSON_ARRAY(:category),
            :medium,
            :case,
            :id_case,
            :status,
            :action
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':id_action' => $data['id_action'],
            ':staff' => $data['staff'],
            ':shop' => $data['shop'],
            ':id_related' => $data['id_related'],
            ':name' => $data['name'],
            ':estate_name_1' => $data['estate_name_1'],
            ':category' => $data['category'],
            ':medium' => $data['medium'],
            ':case' => $data['case'],
            ':id_case' => $data['id_case'],
            ':status' => $data['status'],
            ':action' => $actionJson
        ])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'resale_new') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM resale_customers WHERE id_related = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id_related']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        $sql = "UPDATE resale_customers SET
          staff = :staff,
          name = :name,
          kana = :kana,
          `case` = :case,
          mail = :mail,
          zip = :zip,
          address = :address,
          phone = :phone,
          registered = :registered
        WHERE id_related = :id_related";
        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':staff' => $data['staff'],
            ':name' => $data['name'],
            ':kana' => $data['kana'],
            ':case' => $data['case'],
            ':mail' => $data['mail'],
            ':zip' => $data['zip'],
            ':address' => $data['address'],
            ':phone' => $data['phone'],
            ':registered' => $data['registered'],
            ':id_related' => $data['id_related']
        ])) {
            echo json_encode(['status' => 'update_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } else {
        $sql = "INSERT INTO resale_customers (
          staff, id_related, name, `case`, mail, zip, address, phone, kana, registered
        ) VALUES (
          :staff, :id_related, :name, :case, :mail, :zip, :address, :phone, :kana, :registered
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':staff' => $data['staff'],
            ':name' => $data['name'],
            ':kana' => $data['kana'],
            ':case' => '売:',
            ':mail' => $data['mail'],
            ':zip' => $data['zip'],
            ':address' => $data['address'],
            ':phone' => $data['phone'],
            ':registered' => $data['registered'],
            ':id_related' => $data['id_related']
        ])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'kaeru_new') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM khf_customers WHERE id_related = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id_related']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        $sql = "UPDATE khf_customers SET
          staff = :staff,
          name = :name,
          kana = :kana,
          `case` = :case,
          mail = :mail,
          zip = :zip,
          address = :address,
          phone = :phone,
          registered = :registered
        WHERE id_related = :id_related";
        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':staff' => $data['staff'],
            ':name' => $data['name'],
            ':kana' => $data['kana'],
            ':case' => $data['case'],
            ':mail' => $data['mail'],
            ':zip' => $data['zip'],
            ':address' => $data['address'],
            ':phone' => $data['phone'],
            ':registered' => $data['registered'],
            ':id_related' => $data['id_related']
        ])) {
            echo json_encode(['status' => 'update_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } else {
        $sql = "INSERT INTO khf_customers (
          staff, id_related, name, `case`, mail, zip, address, phone, kana, registered
        ) VALUES (
          :staff, :id_related, :name, :case, :mail, :zip, :address, :phone, :kana, :registered
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':staff' => $data['staff'],
            ':name' => $data['name'],
            ':kana' => $data['kana'],
            ':case' => '売:',
            ':mail' => $data['mail'],
            ':zip' => $data['zip'],
            ':address' => $data['address'],
            ':phone' => $data['phone'],
            ':registered' => $data['registered'],
            ':id_related' => $data['id_related']
        ])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'kaeru_list') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM khf_customers ORDER BY registered DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} elseif ($demand === 'kaeru_report') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT staff, shop, id_related, medium, status, registered, reserved, contract, rank FROM khf_customers ORDER BY registered DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} elseif ($demand === 'resale_report') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM resale_customers ORDER BY registered DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} elseif ($demand === 'resale_list') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM resale_customers ORDER BY registered DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} elseif ($demand === 'resale_staff') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM staff_list WHERE shop like "%中専鹿児島店%" ORDER BY id ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} elseif ($demand === 'kaeru_status') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM khf_customers WHERE id_related = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id_related']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        $sql = "UPDATE khf_customers SET
          staff = ?,
          registered = ?,
          reserved = ?,
          contract = ?,
          rank = ?,
          medium = ?
        WHERE id_related = ?";
        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([$data['staff'], $data['registered'], $data['reserved'], $data['contract'], $data['rank'], $data['medium'], $data['id_related']
        ])) {
            echo json_encode(['status' => 'update_success' . $data['medium']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } else {
        $sql = "INSERT INTO khf_customers (
          staff, registered, reserved, contract, rank, medium, id_related
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([$data['staff'], $data['registered'], $data['reserved'], $data['contract'], $data['rank'], $data['medium'], $data['id_related']])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'resale_status') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM resale_customers WHERE id_related = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id_related']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        $sql = "UPDATE resale_customers SET
          staff = :staff,
          registered = :registered,
          reserved = :reserved,
          contract = :contract,
          rank = :rank
        WHERE id_related = :id_related";
        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':staff' => $data['staff'],
            ':registered' => $data['registered'],
            ':reserved' => $data['reserved'],
            ':contract' => $data['contract'],
            ':rank' => $data['rank'],
            ':id_related' => $data['id_related']
        ])) {
            echo json_encode(['status' => 'update_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } else {
        $sql = "INSERT INTO resale_customers (
          staff, registered, reserved, contract, rank, id_related, phone
        ) VALUES (
          :staff, :registered, :reserved,  :contract, :rank, :id_related, :phone
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':staff' => $data['staff'],
            ':registered' => $data['registered'],
            ':reserved' => $data['reserved'],
            ':contract' => $data['contract'],
            ':rank' => $data['rank'],
            ':phone' => $data['phone'],
            ':id_related' => $data['id_related']
        ])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'sumai_step') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM sumai_step_db WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);


    if ($result) {
        $sql = "UPDATE sumai_step_db SET
            date= :date,
            status= :status,
            shop= :shop,
            estate= :estate,
            category= :category,
            estate_pref= :estate_pref,
            estate_city= :estate_city,
            estate_town= :estate_town,
            estate_street= :estate_street,
            estate_building= :estate_building,
            estate_room= :estate_room,
            estate_situation= :estate_situation,
            large_1= :large_1,
            large_2= :large_2,
            large_3= :large_3,
            large_4= :large_4,
            land_large_1= :land_large_1,
            land_large_2= :land_large_2,
            land_large_3= :land_large_3,
            plan= :plan,
            situation= :situation,
            relationship= :relationship,
            rent= :rent,
            floor= :floor,
            room= :room,
            reason= :reason,
            reason_other= :reason_other,
            method= :method,
            period= :period,
            opinion= :opinion,
            sei= :sei,
            mei= :mei,
            sei_kana= :sei_kana,
            mei_kana= :mei_kana,
            age= :age,
            phone= :phone,
            mail= :mail,
            zip= :zip,
            address_1= :address_1,
            address_2= :address_2,
            address_3= :address_3,
            phone_call= :phone_call,
            visit= :visit,
            medium= :medium,
            report= :report
        WHERE id= :id";
        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':id' => $data['id'],
            ':date' => $data['date'],
            ':status' => $data['status'],
            ':shop' => $data['shop'],
            ':estate' => $data['estate'],
            ':category' => $data['category'],
            ':estate_pref' => $data['estate_pref'],
            ':estate_city' => $data['estate_city'],
            ':estate_town' => $data['estate_town'],
            ':estate_street' => $data['estate_street'],
            ':estate_building' => $data['estate_building'],
            ':estate_room' => $data['estate_room'],
            ':estate_situation' => $data['estate_situation'],
            ':large_1' => $data['large_1'],
            ':large_2' => $data['large_2'],
            ':large_3' => $data['large_3'],
            ':large_4' => $data['large_4'],
            ':land_large_1' => $data['land_large_1'],
            ':land_large_2' => $data['land_large_2'],
            ':land_large_3' => $data['land_large_3'],
            ':plan' => $data['plan'],
            ':situation' => $data['situation'],
            ':relationship' => $data['relationship'],
            ':rent' => $data['rent'],
            ':floor' => $data['floor'],
            ':room' => $data['room'],
            ':reason' => $data['reason'],
            ':reason_other' => $data['reason_other'],
            ':method' => $data['method'],
            ':period' => $data['period'],
            ':opinion' => $data['opinion'],
            ':sei' => $data['sei'],
            ':mei' => $data['mei'],
            ':sei_kana' => $data['sei_kana'],
            ':mei_kana' => $data['mei_kana'],
            ':age' => $data['age'],
            ':phone' => $data['phone'],
            ':mail' => $data['mail'],
            ':zip' => $data['zip'],
            ':address_1' => $data['address_1'],
            ':address_2' => $data['address_2'],
            ':address_3' => $data['address_3'],
            ':phone_call' => $data['phone_call'],
            ':visit' => $data['visit'],
            ':medium' => $data['medium'],
            ':report' => $data['report']
        ])) {
            echo json_encode(['status' => 'update_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } else {
        $sql = "INSERT INTO sumai_step_db (
          id,  date,  status,  shop,  estate,  category,  estate_pref,  estate_city,  estate_town,  estate_street,  estate_building,  estate_room,  estate_situation,  large_1,  large_2,  large_3,  large_4,  land_large_1,  land_large_2,  land_large_3,  plan,  situation,  relationship,  rent,  floor,  room,  reason,  reason_other,  method,  period,  opinion,  sei,  mei,  sei_kana,  mei_kana,  age,  phone,  mail,  zip,  address_1,  address_2,  address_3,  phone_call,  visit,  medium,  report
        ) VALUES (
          :id,  :date,  :status,  :shop,  :estate,  :category,  :estate_pref,  :estate_city,  :estate_town,  :estate_street,  :estate_building,  :estate_room,  :estate_situation,  :large_1,  :large_2,  :large_3,  :large_4,  :land_large_1,  :land_large_2,  :land_large_3,  :plan,  :situation,  :relationship,  :rent,  :floor,  :room,  :reason,  :reason_other,  :method,  :period,  :opinion,  :sei,  :mei,  :sei_kana,  :mei_kana,  :age,  :phone,  :mail,  :zip,  :address_1,  :address_2,  :address_3,  :phone_call,  :visit,  :medium,  :report
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':id' => $data['id'],
            ':date' => $data['date'],
            ':status' => $data['status'],
            ':shop' => $data['shop'],
            ':estate' => $data['estate'],
            ':category' => $data['category'],
            ':estate_pref' => $data['estate_pref'],
            ':estate_city' => $data['estate_city'],
            ':estate_town' => $data['estate_town'],
            ':estate_street' => $data['estate_street'],
            ':estate_building' => $data['estate_building'],
            ':estate_room' => $data['estate_room'],
            ':estate_situation' => $data['estate_situation'],
            ':large_1' => $data['large_1'],
            ':large_2' => $data['large_2'],
            ':large_3' => $data['large_3'],
            ':large_4' => $data['large_4'],
            ':land_large_1' => $data['land_large_1'],
            ':land_large_2' => $data['land_large_2'],
            ':land_large_3' => $data['land_large_3'],
            ':plan' => $data['plan'],
            ':situation' => $data['situation'],
            ':relationship' => $data['relationship'],
            ':rent' => $data['rent'],
            ':floor' => $data['floor'],
            ':room' => $data['room'],
            ':reason' => $data['reason'],
            ':reason_other' => $data['reason_other'],
            ':method' => $data['method'],
            ':period' => $data['period'],
            ':opinion' => $data['opinion'],
            ':sei' => $data['sei'],
            ':mei' => $data['mei'],
            ':sei_kana' => $data['sei_kana'],
            ':mei_kana' => $data['mei_kana'],
            ':age' => $data['age'],
            ':phone' => $data['phone'],
            ':mail' => $data['mail'],
            ':zip' => $data['zip'],
            ':address_1' => $data['address_1'],
            ':address_2' => $data['address_2'],
            ':address_3' => $data['address_3'],
            ':phone_call' => $data['phone_call'],
            ':visit' => $data['visit'],
            ':medium' => $data['medium'],
            ':report' => $data['report']
        ])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'resale_call_achievement') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM call_achievement WHERE name = ? AND period = ? AND shop = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['name'], $data['period'], $data['shop']]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result) {
        $sql = "UPDATE call_achievement SET
          total = :total,
          appointment = :appointment
        WHERE name = :name AND shop = :shop AND period = :period";
        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':total' => $data['total'],
            ':appointment' => $data['appointment'],
            ':name' => $data['name'],
            ':shop' => $data['shop'],
            ':period' => $data['period'],
        ])) {
            echo json_encode(['status' => 'update_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'update_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    } else {
        $sql = "INSERT INTO call_achievement (
          name, shop, period, total, appointment
        ) VALUES (
          :name, :shop, :period, :total, :appointment
        )";

        $stmt = $pdo->prepare($sql);
        if ($stmt->execute([
            ':total' => $data['total'],
            ':appointment' => $data['appointment'],
            ':name' => $data['name'],
            ':shop' => $data['shop'],
            ':period' => $data['period']
        ])) {
            echo json_encode(['status' => 'insert_success'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            echo json_encode(['status' => 'insert_error'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
} elseif ($demand === 'resale_call_show') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT * FROM call_achievement';
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}elseif ($demand === 'reserve_check') {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $sql = 'SELECT id_related, reserved FROM khf_customers WHERE id_related = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['id']]);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($result ? $result : '無', JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}  else {
    try {
        $pdo = new PDO($dsn, $db_user, $db_password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $sql = "SELECT * FROM budget WHERE section = 'spec'";

        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($customers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (PDOException $e) {
        echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
    }
}
