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

// =========================================================
// 【追加】 PDFファイルのアップロードと保存ロジック
// =========================================================
$competitor_pdf_path = $data['competitor_pdf_path'] ?? null; // 更新しない場合は既存のパスを保持

// フロントから 'competitor_pdf' というキーでファイルが送られてきたか確認
if (isset($_FILES['competitor_pdf']) && $_FILES['competitor_pdf']['error'] === UPLOAD_ERR_OK) {
    // 保存先ディレクトリの設定（環境に合わせてパスを変更してください）
    $uploadDir = __DIR__ . '/../uploads/competitors/';

    // ディレクトリが存在しない場合は作成
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    $tmpName = $_FILES['competitor_pdf']['tmp_name'];
    $fileName = basename($_FILES['competitor_pdf']['name']);
    $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    // セキュリティ対策: PDFのみ許可
    if ($fileExt === 'pdf' && mime_content_type($tmpName) === 'application/pdf') {
        // 同名ファイルの上書きを防ぐため、ユニークなファイル名を生成
        $newFileName = uniqid('pdf_') . '_' . time() . '.pdf';
        $destination = $uploadDir . $newFileName;

        // ファイルを指定ディレクトリに移動
        if (move_uploaded_file($tmpName, $destination)) {
            // DBに保存するための相対パス（フロントで参照できるURL形式）をセット
            $competitor_pdf_path = '/uploads/competitors/' . $newFileName;
        }
    }
}

$insertMasterSQL = 'INSERT INTO master_data (
    id,
    category,
    customer_contacts_name,
    customer_contacts_name_2,
    in_charge_user,
    in_charge_store,
    first_interviewed_date,
    full_address,
    extra_address_info,
    customer_contacts_name_kana,
    customer_contacts_phone_number,
    customer_contacts_mobile_phone_number,
    customer_contacts_email,
    customer_contacts_birth_date,
    customer_contacts_employment_type,
    customer_contacts_employer_name,
    customer_contacts_employer_address,
    customer_contacts_years_of_service,
    customer_contacts_annual_income,
    postal_code,
    current_contract_type,
    current_rent,
    budget,
    house_hunting_motivation,
    inquiry_reason,
    planned_construction_site,
    customer_desired_floor,
    customer_desired_period,
    customer_desired_estate,
    customer_desired_order,
    step_migration_item_catalog,
    step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,
    step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
    step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,
    step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN,
    step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
    customized_input_01JRCT12N9X24PCQ5QZPAYKB93,
    customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
    customized_input_01JSE7RNV3VK78YC2GYAG0554D,
    customized_input_01J95TC6KEES87F0YXH29AJP7K,
    customized_input_01J82Z5F366ZQ897PXWF6H5ZAM,
    step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
    step_migration_item_01J82Z5F1WE8SKEES6VNN37B22,
    desired_has_solar_power,
    monthly_repayment_amount,
    remarks,
    repayment_years,
    sales_promotion_name,
    self_budget,
    status,
    land_budget,
    desired_land_area,
    call_status,
    desired_area1_address,
    has_owned_land,
    current_utility_costs,
    current_loan_balance,
    introduction_person_category,
    rank_period,
    call_log
) VALUES (
    :id,
    :category,
    :customer_contacts_name,
    :customer_contacts_name_2,
    :in_charge_user,
    :in_charge_store,
    :first_interviewed_date,
    :full_address,
    :extra_address_info,
    :customer_contacts_name_kana,
    :customer_contacts_phone_number,
    :customer_contacts_mobile_phone_number,
    :customer_contacts_email,
    :customer_contacts_birth_date,
    :customer_contacts_employment_type,
    :customer_contacts_employer_name,
    :customer_contacts_employer_address,
    :customer_contacts_years_of_service,
    :customer_contacts_annual_income,
    :postal_code,
    :current_contract_type,
    :current_rent,
    :budget,
    :house_hunting_motivation,
    :inquiry_reason,
    :planned_construction_site,
    :customer_desired_floor,
    :customer_desired_period,
    :customer_desired_estate,
    :customer_desired_order,
    :step_migration_item_catalog,
    :step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,
    :step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
    :step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,
    :step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN,
    :step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
    :customized_input_01JRCT12N9X24PCQ5QZPAYKB93,
    :customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
    :customized_input_01JSE7RNV3VK78YC2GYAG0554D,
    :customized_input_01J95TC6KEES87F0YXH29AJP7K,
    :customized_input_01J82Z5F366ZQ897PXWF6H5ZAM,
    :step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
    :step_migration_item_01J82Z5F1WE8SKEES6VNN37B22,
    :desired_has_solar_power,
    :monthly_repayment_amount,
    :remarks,
    :repayment_years,
    :sales_promotion_name,
    :self_budget,
    :status,
    :land_budget,
    :desired_land_area,
    :call_status,
    :desired_area1_address,
    :has_owned_land,
    :current_utility_costs,
    :current_loan_balance,
    :introduction_person_category,
    :rank_period,
    :call_log
)';

$insertMasterStmt = $pdo->prepare($insertMasterSQL);

// 安全に値を取り出す（未定義キー対策）
$id = $data['id'] ?? null;
$customer_contacts_name = $data['customer_contacts_name'] ?? null;
$customer_contacts_name_2 = $data['customer_contacts_name_2'] ?? null;
$in_charge_user = $data['in_charge_user'] ?? null;
$in_charge_store = $data['in_charge_store'] ?? null;
$first_interviewed_date = date('Y/m/d'); // 挿入時に今日を入れる場合
$full_address = $data['full_address'] ?? null;
$extra_address_info = $data['extra_address_info'] ?? null;
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
$step_migration_item_01J82Z5F1RR18Z792C7KZS88QG = $data['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'] ?? null;
$step_migration_item_01J82Z5F1WE8SKEES6VNN37B22 = $data['step_migration_item_01J82Z5F1WE8SKEES6VNN37B22'] ?? null;
$desired_has_solar_power = $data['desired_has_solar_power'] ?? null;
$monthly_repayment_amount = $data['monthly_repayment_amount'] ?? null;
$remarks = $data['remarks'] ?? null;
$repayment_years = $data['repayment_years'] ?? null;
$sales_promotion_name = $data['sales_promotion_name'] ?? null;
$self_budget = $data['self_budget'] ?? null;
$status = $data['status'] ?? null;
$land_budget = $data['land_budget'] ?? null;
$desired_land_area = $data['desired_land_area'] ?? null;
$call_status = $data['call_status'] ?? null;
$desired_area1_address = $data['desired_area1_address'] ?? null;
$has_owned_land = $data['has_owned_land'] ?? null;
$current_loan_balance = $data['current_loan_balance'] ?? null;
$current_utility_costs = $data['current_utility_costs'] ?? null;
$introduction_person_category = $data['introduction_person_category'] ?? null;
$rank_period = $data['rank_period'] ?? null;
$call_log = $data['call_log'] ?? null;

// バインド（NULL を考慮）
bindNullable($insertMasterStmt, ':id', $id, PDO::PARAM_STR);
bindNullable($insertMasterStmt, ':category', '注文');
bindNullable($insertMasterStmt, ':customer_contacts_name', $customer_contacts_name);
bindNullable($insertMasterStmt, ':customer_contacts_name_2', $customer_contacts_name_2);
bindNullable($insertMasterStmt, ':in_charge_user', $in_charge_user);
bindNullable($insertMasterStmt, ':in_charge_store', $in_charge_store);
bindNullable($insertMasterStmt, ':first_interviewed_date', $first_interviewed_date);
bindNullable($insertMasterStmt, ':full_address', $full_address);
bindNullable($insertMasterStmt, ':extra_address_info', $extra_address_info);
bindNullable($insertMasterStmt, ':customer_contacts_name_kana', $customer_contacts_name_kana);
bindNullable($insertMasterStmt, ':customer_contacts_phone_number', $customer_contacts_phone_number);
bindNullable($insertMasterStmt, ':customer_contacts_mobile_phone_number', $customer_contacts_mobile_phone_number);
bindNullable($insertMasterStmt, ':customer_contacts_email', $customer_contacts_email);
bindNullable($insertMasterStmt, ':customer_contacts_birth_date', $customer_contacts_birth_date);
bindNullable($insertMasterStmt, ':customer_contacts_employment_type', $customer_contacts_employment_type);
bindNullable($insertMasterStmt, ':customer_contacts_employer_name', $customer_contacts_employer_name);
bindNullable($insertMasterStmt, ':customer_contacts_employer_address', $customer_contacts_employer_address);
bindNullable($insertMasterStmt, ':customer_contacts_years_of_service', $customer_contacts_years_of_service);
bindNullable($insertMasterStmt, ':customer_contacts_annual_income', $customer_contacts_annual_income);
bindNullable($insertMasterStmt, ':postal_code', $postal_code);
bindNullable($insertMasterStmt, ':current_contract_type', $current_contract_type);
bindNullable($insertMasterStmt, ':current_rent', $current_rent);
bindNullable($insertMasterStmt, ':budget', $budget);
bindNullable($insertMasterStmt, ':house_hunting_motivation', $house_hunting_motivation);
bindNullable($insertMasterStmt, ':inquiry_reason', $inquiry_reason);
bindNullable($insertMasterStmt, ':planned_construction_site', $planned_construction_site);
bindNullable($insertMasterStmt, ':customer_desired_floor', $customer_desired_floor);
bindNullable($insertMasterStmt, ':customer_desired_period', $customer_desired_period);
bindNullable($insertMasterStmt, ':customer_desired_estate', $customer_desired_estate);
bindNullable($insertMasterStmt, ':customer_desired_order', $customer_desired_order);
bindNullable($insertMasterStmt, ':step_migration_item_catalog', $step_migration_item_catalog);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', $step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', $step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99);
bindNullable($insertMasterStmt, ':step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', $step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR);
bindNullable($insertMasterStmt, ':step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', $step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN);
bindNullable($insertMasterStmt, ':step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', $step_migration_item_01JSENACS2FC422ZHEZWNSXNYA);
bindNullable($insertMasterStmt, ':customized_input_01JRCT12N9X24PCQ5QZPAYKB93', $customized_input_01JRCT12N9X24PCQ5QZPAYKB93);
bindNullable($insertMasterStmt, ':customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', $customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN);
bindNullable($insertMasterStmt, ':customized_input_01JSE7RNV3VK78YC2GYAG0554D', $customized_input_01JSE7RNV3VK78YC2GYAG0554D);
bindNullable($insertMasterStmt, ':customized_input_01J95TC6KEES87F0YXH29AJP7K', $customized_input_01J95TC6KEES87F0YXH29AJP7K);
bindNullable($insertMasterStmt, ':customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', $customized_input_01J82Z5F366ZQ897PXWF6H5ZAM);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', $step_migration_item_01J82Z5F1RR18Z792C7KZS88QG);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', $step_migration_item_01J82Z5F1WE8SKEES6VNN37B22);
bindNullable($insertMasterStmt, ':desired_has_solar_power', $desired_has_solar_power);
bindNullable($insertMasterStmt, ':monthly_repayment_amount', $monthly_repayment_amount);
bindNullable($insertMasterStmt, ':remarks', $remarks);
bindNullable($insertMasterStmt, ':repayment_years', $repayment_years);
bindNullable($insertMasterStmt, ':sales_promotion_name', $sales_promotion_name);
bindNullable($insertMasterStmt, ':self_budget', $self_budget);
bindNullable($insertMasterStmt, ':status', $status);
bindNullable($insertMasterStmt, ':land_budget', $land_budget);
bindNullable($insertMasterStmt, ':desired_land_area', $desired_land_area);
bindNullable($insertMasterStmt, ':call_status', $call_status);
bindNullable($insertMasterStmt, ':desired_area1_address', $desired_area1_address);
bindNullable($insertMasterStmt, ':has_owned_land', $has_owned_land);
bindNullable($insertMasterStmt, ':current_utility_costs', $current_utility_costs);
bindNullable($insertMasterStmt, ':current_loan_balance', $current_loan_balance);
bindNullable($insertMasterStmt, ':introduction_person_category', $introduction_person_category);
bindNullable($insertMasterStmt, ':rank_period', $rank_period);
bindNullable($insertMasterStmt, ':call_log', $call_log);

// 実行
if ($insertMasterStmt->execute()) {
    echo json_encode([
        'status' => 'success',
        'message' => ($customer_contacts_name ?? 'レコード') . ' 様を顧客情報に登録しました。'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    $err = $insertMasterStmt->errorInfo();
    echo json_encode([
        'status' => 'error',
        'message' => '顧客情報の登録に失敗しました。',
        'error' => $err
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
