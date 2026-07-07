<?php
function bindNullable(PDOStatement $stmt, string $param, $value, int $type = PDO::PARAM_STR)
{
    if ($value === null) {
        $stmt->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        // 型に応じてキャストしてバインドするのが安全
        if ($type === PDO::PARAM_INT) {
            $stmt->bindValue($param, (int)$value, PDO::PARAM_INT);
        } elseif ($type === PDO::PARAM_BOOL) {
            $stmt->bindValue($param, (bool)$value, PDO::PARAM_BOOL);
        } else {
            $stmt->bindValue($param, $value, $type);
        }
    }
}


// 共通で使用するため、一番最初にIDを取得しておきます
$id = $data['id'] ?? null;

// =========================================================
// 【追加機能】 PDFファイルのアップロードと competitor_pdf テーブルへの保存（完全上書き版）
// =========================================================
$new_uploaded_pdfs = []; 

// 1. 新規ファイルのアップロード処理
if (isset($_FILES['competitor_pdf_files']) && is_array($_FILES['competitor_pdf_files']['name'])) {
    $uploadDir = __DIR__ . '/../uploads/competitors/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $fileCount = count($_FILES['competitor_pdf_files']['name']);

    for ($i = 0; $i < $fileCount; $i++) {
        if ($_FILES['competitor_pdf_files']['error'][$i] === UPLOAD_ERR_OK) {
            $tmpName = $_FILES['competitor_pdf_files']['tmp_name'][$i];
            $originalFileName = basename($_FILES['competitor_pdf_files']['name'][$i]);
            $fileExt = strtolower(pathinfo($originalFileName, PATHINFO_EXTENSION));
            
            // ▼ ここでフロントエンドから送られてくる値を受け取ります
            $customName = $_POST['competitor_pdf_names'][$i] ?? $originalFileName;
            $staffName = $_POST['competitor_pdf_staff'][$i] ?? ''; // 追加：担当者名

            if ($fileExt === 'pdf' && mime_content_type($tmpName) === 'application/pdf') {
                $newFileName = uniqid('pdf_') . '_' . time() . '_' . $i . '.pdf';
                $destination = $uploadDir . $newFileName;

                if (move_uploaded_file($tmpName, $destination)) {
                    $new_uploaded_pdfs[] = [
                        'name' => $customName,
                        'path' => '/uploads/competitors/' . $newFileName,
                        'staff' => $staffName
                    ];
                }
            }
        }
    }
}

// 2. Reactから送られてきた「削除されずに残っている既存のファイル」を受け取る
$existing_pdfs = [];
if (isset($_POST['existing_pdfs'])) {
    $decoded = json_decode($_POST['existing_pdfs'], true);
    if (is_array($decoded)) {
        $existing_pdfs = $decoded;
    }
}

// 3. 「残った既存ファイル」と「新規アップロードファイル」を結合
$final_pdfs = array_merge($existing_pdfs, $new_uploaded_pdfs);

// 4. データが送信されていて、かつ $id が存在する場合はテーブルを完全に「上書き」
if ($id && isset($_POST['existing_pdfs'])) {
    $newPdfPathJson = json_encode($final_pdfs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $checkStmt = $pdo->prepare('SELECT id FROM competitor_pdf WHERE id = :id');
    $checkStmt->bindValue(':id', $id, PDO::PARAM_STR);
    $checkStmt->execute();

    if ($checkStmt->fetch()) {
        // 既存レコードがある場合：そのまま上書き（UPDATE）
        $updatePdfStmt = $pdo->prepare('UPDATE competitor_pdf SET pdf_path = :pdf_path WHERE id = :id');
        $updatePdfStmt->bindValue(':pdf_path', $newPdfPathJson, PDO::PARAM_STR);
        $updatePdfStmt->bindValue(':id', $id, PDO::PARAM_STR);
        $updatePdfStmt->execute();
    } else {
        // 既存レコードがない場合：INSERT
        $insertPdfStmt = $pdo->prepare('INSERT INTO competitor_pdf (id, pdf_path) VALUES (:id, :pdf_path)');
        $insertPdfStmt->bindValue(':id', $id, PDO::PARAM_STR);
        $insertPdfStmt->bindValue(':pdf_path', $newPdfPathJson, PDO::PARAM_STR);
        $insertPdfStmt->execute();
    }
}
// =========================================================

$updateMasterSQL = 'UPDATE master_data SET 	
            customer_contacts_name = :customer_contacts_name,
            in_charge_user = :in_charge_user,
            in_charge_store = :in_charge_store,
            first_interviewed_date = :first_interviewed_date,
            full_address = :full_address,
            customer_contacts_name_kana = :customer_contacts_name_kana,
            customer_contacts_phone_number = :customer_contacts_phone_number,
            customer_contacts_mobile_phone_number = :customer_contacts_mobile_phone_number,
            customer_contacts_email = :customer_contacts_email,
            customer_contacts_birth_date = :customer_contacts_birth_date,
            customer_contacts_employment_type = :customer_contacts_employment_type,
            customer_contacts_employer_name = :customer_contacts_employer_name,
            customer_contacts_employer_address = :customer_contacts_employer_address,
            customer_contacts_years_of_service = :customer_contacts_years_of_service,
            customer_contacts_annual_income = :customer_contacts_annual_income,
            postal_code = :postal_code,
            current_contract_type = :current_contract_type,
            current_rent = :current_rent,
            budget = :budget,
            house_hunting_motivation = :house_hunting_motivation,
            inquiry_reason = :inquiry_reason,
            planned_construction_site = :planned_construction_site,
            customer_desired_floor = :customer_desired_floor,
            customer_desired_period = :customer_desired_period,
            customer_desired_estate = :customer_desired_estate,
            customer_desired_order = :customer_desired_order,
            step_migration_item_catalog = :step_migration_item_catalog,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 = :step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 = :step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
            step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR = :step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,
            step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN = :step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN,
            step_migration_item_01JSENACS2FC422ZHEZWNSXNYA = :step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
            customized_input_01JRCT12N9X24PCQ5QZPAYKB93 = :customized_input_01JRCT12N9X24PCQ5QZPAYKB93,
            customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN = :customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
            customized_input_01JSE7RNV3VK78YC2GYAG0554D = :customized_input_01JSE7RNV3VK78YC2GYAG0554D,
            customized_input_01J95TC6KEES87F0YXH29AJP7K = :customized_input_01J95TC6KEES87F0YXH29AJP7K,
            customized_input_01J82Z5F366ZQ897PXWF6H5ZAM = :customized_input_01J82Z5F366ZQ897PXWF6H5ZAM,
            customized_input_01JSE7H4MQES619NBWX6PQDFRH = :customized_input_01JSE7H4MQES619NBWX6PQDFRH,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG = :step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
            desired_has_solar_power = :desired_has_solar_power,
            monthly_repayment_amount = :monthly_repayment_amount,
            remarks = :remarks,
            repayment_years = :repayment_years,
            sales_promotion_name = :sales_promotion_name,
            self_budget = :self_budget,
            status = :status,
            land_budget = :land_budget,
            desired_land_area = :desired_land_area,
            call_status = :call_status,
            has_owned_land = :has_owned_land,
            desired_area1_address = :desired_area1_address,
            current_utility_costs = :current_utility_costs,
            current_loan_balance = :current_loan_balance,
            competitors_text = :competitors_text,
            reserved_interview = :reserved_interview,
            first_interviewed_user = :first_interviewed_user,
            last_action_step_migration_item_name = :last_action_step_migration_item_name,
            customer_contacts_birth_date = :customer_contacts_birth_date,
            introduction_person_category = :introduction_person_category,
            rank_steps = :rank_steps,
            competitor_lost_contract_reason = :competitor_lost_contract_reason,
            memo_other_related_person = :memo_other_related_person,
            competitor_name = :competitor_name,
            customized_input_01JRF9CZSW65A151WR30NA4PB3 = :customized_input_01JRF9CZSW65A151WR30NA4PB3,
            rank_period = :rank_period
            WHERE id = :id';

// 安全に値を取り出す（未定義キー対策）
$customer_contacts_name = $data['customer_contacts_name'] ?? null;
$in_charge_user = $data['in_charge_user'] ?? null;
$in_charge_store = $data['in_charge_store'] ?? null;
$first_interviewed_date = date('Y/m/d'); // 挿入時に今日を入れる場合
$full_address = $data['full_address'] ?? null;
$customer_contacts_name_kana = $data['customer_contacts_name_kana'] ?? null;
$customer_contacts_phone_number = $data['customer_contacts_phone_number'] ?? null;
$customer_contacts_mobile_phone_number = $data['customer_contacts_mobile_phone_number'] ?? null;
$customer_contacts_email = $data['customer_contacts_email'] ?? null;
$customer_contacts_birth_date = $data['customer_contacts_birth_date'] ?? null;
$customer_contacts_employment_type = $data['customer_contacts_employment_type'] ?? null;
$customer_contacts_employer_name = $data['customer_contacts_employer_name'] ?? null;
$customer_contacts_employer_address = $data['customer_contacts_employer_address'] ?? null;
$customer_contacts_years_of_service = $data['customer_contacts_years_of_service'] ?? null;
$customer_contacts_annual_income = $data['customer_contacts_annual_income'] ?? null;
$postal_code = $data['postal_code'] ?? null;
$current_contract_type = $data['current_contract_type'] ?? null;
$current_rent = $data['current_rent'] ?? null;
$budget = $data['budget'] ?? null;
$house_hunting_motivation = $data['house_hunting_motivation'] ?? null;
$inquiry_reason = $data['inquiry_reason'] ?? null;
$planned_construction_site = $data['planned_construction_site'] ?? null;
$customer_desired_floor = $data['customer_desired_floor'] ?? null;
$customer_desired_period = $data['customer_desired_period'] ?? null;
$customer_desired_estate = $data['customer_desired_estate'] ?? null;
$customer_desired_order = $data['customer_desired_order'] ?? null;
$step_migration_item_catalog = $data['step_migration_item_catalog'] ?? null;
$step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 = $data['step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'] ?? null;
$step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 = $data['step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'] ?? null;
$step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR = $data['step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'] ?? null;
$step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN = $data['step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN'] ?? null;
$step_migration_item_01JSENACS2FC422ZHEZWNSXNYA = $data['step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'] ?? null;
$customized_input_01JRCT12N9X24PCQ5QZPAYKB93 = $data['customized_input_01JRCT12N9X24PCQ5QZPAYKB93'] ?? null;
$customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN = $data['customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN'] ?? null;
$customized_input_01JSE7RNV3VK78YC2GYAG0554D = $data['customized_input_01JSE7RNV3VK78YC2GYAG0554D'] ?? null;
$customized_input_01J95TC6KEES87F0YXH29AJP7K = $data['customized_input_01J95TC6KEES87F0YXH29AJP7K'] ?? null;
$customized_input_01J82Z5F366ZQ897PXWF6H5ZAM = $data['customized_input_01J82Z5F366ZQ897PXWF6H5ZAM'] ?? null;
$customized_input_01JSE7H4MQES619NBWX6PQDFRH = $data['customized_input_01JSE7H4MQES619NBWX6PQDFRH'] ?? null;
$step_migration_item_01J82Z5F1RR18Z792C7KZS88QG = $data['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'] ?? null;
$desired_has_solar_power = $data['desired_has_solar_power'] ?? null;
$monthly_repayment_amount = $data['monthly_repayment_amount'] ?? null;
$remarks = $data['remarks'] ?? null;
$repayment_years = $data['repayment_years'] ?? null;
$sales_promotion_name = $data['sales_promotion_name'] ?? null;
$self_budget = $data['self_budget'] ?? null;
$status = $data['status'] ?? null;
$land_budget = $data['land_budget'] ?? null;
$desired_land_area = $data['desired_land_area'] ?? null;
$has_owned_land = $data['has_owned_land'] ?? null;
$call_status = $data['call_status'] ?? null;
$desired_area1_address = $data['desired_area1_address'] ?? null;
$current_utility_costs = $data['current_utility_costs'] ?? null;
$current_loan_balance = $data['current_loan_balance'] ?? null;
$competitors_text = $data['competitors_text'] ?? null;
$reserved_interview = $data['reserved_interview'] ?? null;
$first_interviewed_user = $data['first_interviewed_user'] ?? null;
$last_action_step_migration_item_name = $data['last_action_step_migration_item_name'] ?? null;
$customer_contacts_birth_date = $data['customer_contacts_birth_date'] ?? null;
$introduction_person_category = $data['introduction_person_category'] ?? null;
$rank_steps = $data['rank_steps'] ?? null;
$competitor_lost_contract_reason = $data['competitor_lost_contract_reason'] ?? null;
$memo_other_related_person = $data['memo_other_related_person'] ?? null;
$competitor_name = $data['competitor_name'] ?? null;
$customized_input_01JRF9CZSW65A151WR30NA4PB3 = $data['customized_input_01JRF9CZSW65A151WR30NA4PB3'] ?? null;
$rank_period = $data['rank_period'] ?? null;

$updateMasterStmt = $pdo->prepare($updateMasterSQL);
bindNullable($updateMasterStmt, ':id', $id, PDO::PARAM_STR);
bindNullable($updateMasterStmt, ':customer_contacts_name', $customer_contacts_name);
bindNullable($updateMasterStmt, ':in_charge_user', $in_charge_user);
bindNullable($updateMasterStmt, ':in_charge_store', $in_charge_store);
bindNullable($updateMasterStmt, ':first_interviewed_date', $first_interviewed_date);
bindNullable($updateMasterStmt, ':full_address', $full_address);
bindNullable($updateMasterStmt, ':customer_contacts_name_kana', $customer_contacts_name_kana);
bindNullable($updateMasterStmt, ':customer_contacts_phone_number', $customer_contacts_phone_number);
bindNullable($updateMasterStmt, ':customer_contacts_mobile_phone_number', $customer_contacts_mobile_phone_number);
bindNullable($updateMasterStmt, ':customer_contacts_email', $customer_contacts_email);
bindNullable($updateMasterStmt, ':customer_contacts_birth_date', $customer_contacts_birth_date);
bindNullable($updateMasterStmt, ':customer_contacts_employment_type', $customer_contacts_employment_type);
bindNullable($updateMasterStmt, ':customer_contacts_employer_name', $customer_contacts_employer_name);
bindNullable($updateMasterStmt, ':customer_contacts_employer_address', $customer_contacts_employer_address);
bindNullable($updateMasterStmt, ':customer_contacts_years_of_service', $customer_contacts_years_of_service);
bindNullable($updateMasterStmt, ':customer_contacts_annual_income', $customer_contacts_annual_income);
bindNullable($updateMasterStmt, ':postal_code', $postal_code);
bindNullable($updateMasterStmt, ':current_contract_type', $current_contract_type);
bindNullable($updateMasterStmt, ':current_rent', $current_rent);
bindNullable($updateMasterStmt, ':budget', $budget);
bindNullable($updateMasterStmt, ':house_hunting_motivation', $house_hunting_motivation);
bindNullable($updateMasterStmt, ':inquiry_reason', $inquiry_reason);
bindNullable($updateMasterStmt, ':planned_construction_site', $planned_construction_site);
bindNullable($updateMasterStmt, ':customer_desired_floor', $customer_desired_floor);
bindNullable($updateMasterStmt, ':customer_desired_period', $customer_desired_period);
bindNullable($updateMasterStmt, ':customer_desired_estate', $customer_desired_estate);
bindNullable($updateMasterStmt, ':customer_desired_order', $customer_desired_order);
bindNullable($updateMasterStmt, ':step_migration_item_catalog', $step_migration_item_catalog);
bindNullable($updateMasterStmt, ':step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', $step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7);
bindNullable($updateMasterStmt, ':step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', $step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99);
bindNullable($updateMasterStmt, ':step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', $step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR);
bindNullable($updateMasterStmt, ':step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', $step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN);
bindNullable($updateMasterStmt, ':step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', $step_migration_item_01JSENACS2FC422ZHEZWNSXNYA);
bindNullable($updateMasterStmt, ':customized_input_01JRCT12N9X24PCQ5QZPAYKB93', $customized_input_01JRCT12N9X24PCQ5QZPAYKB93);
bindNullable($updateMasterStmt, ':customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', $customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN);
bindNullable($updateMasterStmt, ':customized_input_01JSE7RNV3VK78YC2GYAG0554D', $customized_input_01JSE7RNV3VK78YC2GYAG0554D);
bindNullable($updateMasterStmt, ':customized_input_01J95TC6KEES87F0YXH29AJP7K', $customized_input_01J95TC6KEES87F0YXH29AJP7K);
bindNullable($updateMasterStmt, ':customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', $customized_input_01J82Z5F366ZQ897PXWF6H5ZAM);
bindNullable($updateMasterStmt, ':customized_input_01JSE7H4MQES619NBWX6PQDFRH', $customized_input_01JSE7H4MQES619NBWX6PQDFRH);
bindNullable($updateMasterStmt, ':step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', $step_migration_item_01J82Z5F1RR18Z792C7KZS88QG);
bindNullable($updateMasterStmt, ':desired_has_solar_power', $desired_has_solar_power);
bindNullable($updateMasterStmt, ':monthly_repayment_amount', $monthly_repayment_amount);
bindNullable($updateMasterStmt, ':remarks', $remarks);
bindNullable($updateMasterStmt, ':repayment_years', $repayment_years);
bindNullable($updateMasterStmt, ':sales_promotion_name', $sales_promotion_name);
bindNullable($updateMasterStmt, ':self_budget', $self_budget);
bindNullable($updateMasterStmt, ':status', $status);
bindNullable($updateMasterStmt, ':land_budget', $land_budget);
bindNullable($updateMasterStmt, ':has_owned_land', $has_owned_land);
bindNullable($updateMasterStmt, ':desired_land_area', $desired_land_area);
bindNullable($updateMasterStmt, ':call_status', $call_status);
bindNullable($updateMasterStmt, ':desired_area1_address', $desired_area1_address);
bindNullable($updateMasterStmt, ':current_utility_costs', $current_utility_costs);
bindNullable($updateMasterStmt, ':current_loan_balance', $current_loan_balance);
bindNullable($updateMasterStmt, ':competitors_text', $competitors_text);
bindNullable($updateMasterStmt, ':reserved_interview', $reserved_interview);
bindNullable($updateMasterStmt, ':first_interviewed_user', $first_interviewed_user);
bindNullable($updateMasterStmt, ':last_action_step_migration_item_name', $last_action_step_migration_item_name);
bindNullable($updateMasterStmt, ':customer_contacts_birth_date', $customer_contacts_birth_date);
bindNullable($updateMasterStmt, ':introduction_person_category', $introduction_person_category);
bindNullable($updateMasterStmt, ':rank_steps', $rank_steps);
bindNullable($updateMasterStmt, ':competitor_lost_contract_reason', $competitor_lost_contract_reason);
bindNullable($updateMasterStmt, ':memo_other_related_person', $memo_other_related_person);
bindNullable($updateMasterStmt, ':competitor_name', $competitor_name);
bindNullable($updateMasterStmt, ':customized_input_01JRF9CZSW65A151WR30NA4PB3', $customized_input_01JRF9CZSW65A151WR30NA4PB3);
bindNullable($updateMasterStmt, ':rank_period', $rank_period);

if ($updateMasterStmt->execute()) {
    echo json_encode([
        'status' => 'success',
        'message' => $data['customer_contacts_name'] . '様を顧客情報に登録しました。'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    echo json_encode([
        'status' => 'error',
        'message' => '顧客情報の登録に失敗しました。'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
