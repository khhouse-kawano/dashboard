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

// 1. INSERT文の定義
$insertMasterSQL = 'INSERT INTO master_data_kaeru (
            id,
            customer_contacts_name,
            customer_contacts_name_2,
            in_charge_user,
            in_charge_store,
            first_interviewed_date,
            date,
            full_address,
            sales_promotion_name,
            status,
            category,
            customer_contacts_name_kana,
            customer_tags,
            customer_contacts_phone_number,
            customer_contacts_mobile_phone_number,
            customer_contacts_email,
            customer_contacts_gender,
            customer_contacts_birth_date,
            customer_contacts_employment_type,
            customer_contacts_employer_name,
            customer_contacts_employer_address,
            customer_contacts_years_of_service,
            customer_contacts_annual_income,
            customer_contacts_count,
            elementary_school_id,
            junior_high_school_id,
            postal_code,
            extra_address_info,
            current_contract_type,
            current_utility_costs,
            current_rent,
            budget,
            land_budget,
            desired_purchase_date,
            repayment_years,
            bonus_repayment_amount,
            current_loan_status,
            remarks,
            brand,
            introduction_person_name,
            introduction_person_category,
            introduction_date,
            created_by_name,
            updated_by_name,
            created_at,
            updated_at,
            customer_contacts_preferred_method_of_contact,
            customer_contacts_preferred_contact_time,
            customer_contacts_holiday_list,
            customer_contacts_commute,
            customer_contacts_homecoming_time,
            customer_contacts_parents_place_info,
            email_subscription_status,
            monthly_repayment_amount,
            self_budget,
            budget_reason,
            desired_purchase_date_reason,
            current_loan_balance,
            current_monthly_repayment_amount,
            house_hunting_motivation,
            discovered_reason_name,
            inquiry_reason,
            desired_property_category2,
            desired_elementary_school1,
            desired_elementary_school2,
            desired_elementary_school3,
            desired_junior_high_school1,
            desired_junior_high_school2,
            desired_junior_high_school3,
            desired_land_area,
            desired_occupancy_area,
            desired_area1_postal_code,
            desired_area1_address,
            desired_area2_postal_code,
            desired_area2_address,
            desired_area3_postal_code,
            desired_area3_address,
            desired_nearby_station1_line_name,
            desired_nearby_station1_name,
            desired_nearby_station1_distance,
            desired_nearby_station2_line_name,
            desired_nearby_station2_name,
            desired_nearby_station2_distance,
            desired_nearby_station3_line_name,
            desired_nearby_station3_name,
            desired_nearby_station3_distance,
            desired_area_reason,
            desired_floor,
            desired_layout_rooms_number,
            desired_layout_rooms_arrangement,
            desired_parking_number,
            desired_age_of_construction_max,
            desired_has_solar_power,
            planned_construction_site,
            contracted_property_id,
            contract_land_application_date,
            contract_building_application_date,
            contract_planned_date,
            contract_land_agreement_date,
            contract_building_agreement_date,
            contract_application_fee_planned_date,
            contract_payment_planned_date,
            contraction_contract_price,
            contraction_estimate_number,
            contraction_funding_plan_number,
            contraction_purchase_order_issued_date,
            additional_contraction_contract_price,
            additional_contraction_estimate_number,
            additional_contraction_funding_plan_number,
            additional_contraction_purchase_order_issued_date,
            handover_contract_price,
            handover_estimate_number,
            handover_funding_plan_number,
            handover_purchase_order_issued_date,
            customer_mortgage_examinations_status,
            customer_mortgage_examinations_application_date,
            customer_mortgage_examinations_proposal_date,
            customer_mortgage_examinations_bank_name,
            customer_mortgage_examinations_desired_loan_amount,
            memo_developer_application_company,
            memo_lawyer,
            memo_fire_insurance,
            memo_site_survey,
            memo_ground_survey,
            memo_other_related_person,
            competitor_lost_contract_date,
            competitors_text,
            competitor_name,
            competitor,
            competitor_lost_contract_reason,
            customer_desired_floor,
            customer_desired_period,
            customer_desired_estate,
            customer_desired_order,
            call_status,
            khg_id,
            desired_pref,
            show_dashboard,
            rank_period,
            hp_campaign,
            reserved_interview,
            cancel_status,
            property_name,
            property_tour_name,
            property_contract_name,
            has_owned_land,
            step_migration_item_catalog,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
            step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z,
            step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,
            step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN,
            step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
            step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0,
            step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG,
            step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
            step_migration_item_01J82Z5F1WE8SKEES6VNN37B22,
            customized_input_01JRCT12N9X24PCQ5QZPAYKB93,
            customized_input_01J82Z5F366ZQ897PXWF6H5ZAM,
            customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
            customized_input_01JSE7RNV3VK78YC2GYAG0554D,
            customized_input_01J95TC6KEES87F0YXH29AJP7K,
            call_log
        ) VALUES (
            :id,
            :customer_contacts_name,
            :customer_contacts_name_2,
            :in_charge_user,
            :in_charge_store,
            :first_interviewed_date,
            :date,
            :full_address,
            :sales_promotion_name,
            :status,
            :category,
            :customer_contacts_name_kana,
            :customer_tags,
            :customer_contacts_phone_number,
            :customer_contacts_mobile_phone_number,
            :customer_contacts_email,
            :customer_contacts_gender,
            :customer_contacts_birth_date,
            :customer_contacts_employment_type,
            :customer_contacts_employer_name,
            :customer_contacts_employer_address,
            :customer_contacts_years_of_service,
            :customer_contacts_annual_income,
            :customer_contacts_count,
            :elementary_school_id,
            :junior_high_school_id,
            :postal_code,
            :extra_address_info,
            :current_contract_type,
            :current_utility_costs,
            :current_rent,
            :budget,
            :land_budget,
            :desired_purchase_date,
            :repayment_years,
            :bonus_repayment_amount,
            :current_loan_status,
            :remarks,
            :brand,
            :introduction_person_name,
            :introduction_person_category,
            :introduction_date,
            :created_by_name,
            :updated_by_name,
            :created_at,
            :updated_at,
            :customer_contacts_preferred_method_of_contact,
            :customer_contacts_preferred_contact_time,
            :customer_contacts_holiday_list,
            :customer_contacts_commute,
            :customer_contacts_homecoming_time,
            :customer_contacts_parents_place_info,
            :email_subscription_status,
            :monthly_repayment_amount,
            :self_budget,
            :budget_reason,
            :desired_purchase_date_reason,
            :current_loan_balance,
            :current_monthly_repayment_amount,
            :house_hunting_motivation,
            :discovered_reason_name,
            :inquiry_reason,
            :desired_property_category2,
            :desired_elementary_school1,
            :desired_elementary_school2,
            :desired_elementary_school3,
            :desired_junior_high_school1,
            :desired_junior_high_school2,
            :desired_junior_high_school3,
            :desired_land_area,
            :desired_occupancy_area,
            :desired_area1_postal_code,
            :desired_area1_address,
            :desired_area2_postal_code,
            :desired_area2_address,
            :desired_area3_postal_code,
            :desired_area3_address,
            :desired_nearby_station1_line_name,
            :desired_nearby_station1_name,
            :desired_nearby_station1_distance,
            :desired_nearby_station2_line_name,
            :desired_nearby_station2_name,
            :desired_nearby_station2_distance,
            :desired_nearby_station3_line_name,
            :desired_nearby_station3_name,
            :desired_nearby_station3_distance,
            :desired_area_reason,
            :desired_floor,
            :desired_layout_rooms_number,
            :desired_layout_rooms_arrangement,
            :desired_parking_number,
            :desired_age_of_construction_max,
            :desired_has_solar_power,
            :planned_construction_site,
            :contracted_property_id,
            :contract_land_application_date,
            :contract_building_application_date,
            :contract_planned_date,
            :contract_land_agreement_date,
            :contract_building_agreement_date,
            :contract_application_fee_planned_date,
            :contract_payment_planned_date,
            :contraction_contract_price,
            :contraction_estimate_number,
            :contraction_funding_plan_number,
            :contraction_purchase_order_issued_date,
            :additional_contraction_contract_price,
            :additional_contraction_estimate_number,
            :additional_contraction_funding_plan_number,
            :additional_contraction_purchase_order_issued_date,
            :handover_contract_price,
            :handover_estimate_number,
            :handover_funding_plan_number,
            :handover_purchase_order_issued_date,
            :customer_mortgage_examinations_status,
            :customer_mortgage_examinations_application_date,
            :customer_mortgage_examinations_proposal_date,
            :customer_mortgage_examinations_bank_name,
            :customer_mortgage_examinations_desired_loan_amount,
            :memo_developer_application_company,
            :memo_lawyer,
            :memo_fire_insurance,
            :memo_site_survey,
            :memo_ground_survey,
            :memo_other_related_person,
            :competitor_lost_contract_date,
            :competitors_text,
            :competitor_name,
            :competitor,
            :competitor_lost_contract_reason,
            :customer_desired_floor,
            :customer_desired_period,
            :customer_desired_estate,
            :customer_desired_order,
            :call_status,
            :khg_id,
            :desired_pref,
            :show_dashboard,
            :rank_period,
            :hp_campaign,
            :reserved_interview,
            :cancel_status,
            :property_name,
            :property_tour_name,
            :property_contract_name,
            :has_owned_land,
            :step_migration_item_catalog,
            :step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,
            :step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
            :step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z,
            :step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,
            :step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN,
            :step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
            :step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0,
            :step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG,
            :step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW,
            :step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
            :step_migration_item_01J82Z5F1WE8SKEES6VNN37B22,
            :customized_input_01JRCT12N9X24PCQ5QZPAYKB93,
            :customized_input_01J82Z5F366ZQ897PXWF6H5ZAM,
            :customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
            :customized_input_01JSE7RNV3VK78YC2GYAG0554D,
            :customized_input_01J95TC6KEES87F0YXH29AJP7K,
            :call_log
        )';

// 2. 安全に値を取り出す（未定義キー対策）
$id = $data['id'] ?? null;
$first_interviewed_date = date('Y/m/d'); // 挿入時に今日を入れる場合
$date = $data['date'] ?? null;
$customer_contacts_name = $data['customer_contacts_name'] ?? null;
$customer_contacts_name_2 = $data['customer_contacts_name_2'] ?? null;
$in_charge_store = $data['in_charge_store'] ?? null;
$in_charge_user = $data['in_charge_user'] ?? null;
$full_address = $data['full_address'] ?? null;
$sales_promotion_name = $data['sales_promotion_name'] ?? null;
$status = $data['status'] ?? null;
$category = '建売';
$customer_contacts_name_kana = $data['customer_contacts_name_kana'] ?? null;
$customer_tags = $data['customer_tags'] ?? null;
$customer_contacts_phone_number = $data['customer_contacts_phone_number'] ?? null;
$customer_contacts_mobile_phone_number = $data['customer_contacts_mobile_phone_number'] ?? null;
$customer_contacts_email = $data['customer_contacts_email'] ?? null;
$customer_contacts_gender = $data['customer_contacts_gender'] ?? null;
$customer_contacts_birth_date = $data['customer_contacts_birth_date'] ?? null;
$customer_contacts_employment_type = $data['customer_contacts_employment_type'] ?? null;
$customer_contacts_employer_name = $data['customer_contacts_employer_name'] ?? null;
$customer_contacts_employer_address = $data['customer_contacts_employer_address'] ?? null;
$customer_contacts_years_of_service = $data['customer_contacts_years_of_service'] ?? null;
$customer_contacts_annual_income = $data['customer_contacts_annual_income'] ?? null;
$customer_contacts_count = $data['customer_contacts_count'] ?? null;
$elementary_school_id = $data['elementary_school_id'] ?? null;
$junior_high_school_id = $data['junior_high_school_id'] ?? null;
$postal_code = $data['postal_code'] ?? null;
$extra_address_info = $data['extra_address_info'] ?? null;
$current_contract_type = $data['current_contract_type'] ?? null;
$current_utility_costs = $data['current_utility_costs'] ?? null;
$current_rent = $data['current_rent'] ?? null;
$budget = $data['budget'] ?? null;
$land_budget = $data['land_budget'] ?? null;
$desired_purchase_date = $data['desired_purchase_date'] ?? null;
$repayment_years = $data['repayment_years'] ?? null;
$bonus_repayment_amount = $data['bonus_repayment_amount'] ?? null;
$current_loan_status = $data['current_loan_status'] ?? null;
$remarks = $data['remarks'] ?? null;
$brand = $data['brand'] ?? null;
$introduction_person_name = $data['introduction_person_name'] ?? null;
$introduction_person_category = $data['introduction_person_category'] ?? null;
$introduction_date = $data['introduction_date'] ?? null;
$created_by_name = $data['created_by_name'] ?? null;
$updated_by_name = $data['updated_by_name'] ?? null;
$created_at = $data['created_at'] ?? null; // 新規登録時は現在時刻を入れる場合もあります（例: date('Y-m-d H:i:s')）
$updated_at = $data['updated_at'] ?? null;
$customer_contacts_preferred_method_of_contact = $data['customer_contacts_preferred_method_of_contact'] ?? null;
$customer_contacts_preferred_contact_time = $data['customer_contacts_preferred_contact_time'] ?? null;
$customer_contacts_holiday_list = $data['customer_contacts_holiday_list'] ?? null;
$customer_contacts_commute = $data['customer_contacts_commute'] ?? null;
$customer_contacts_homecoming_time = $data['customer_contacts_homecoming_time'] ?? null;
$customer_contacts_parents_place_info = $data['customer_contacts_parents_place_info'] ?? null;
$email_subscription_status = $data['email_subscription_status'] ?? null;
$monthly_repayment_amount = $data['monthly_repayment_amount'] ?? null;
$self_budget = $data['self_budget'] ?? null;
$budget_reason = $data['budget_reason'] ?? null;
$desired_purchase_date_reason = $data['desired_purchase_date_reason'] ?? null;
$current_loan_balance = $data['current_loan_balance'] ?? null;
$current_monthly_repayment_amount = $data['current_monthly_repayment_amount'] ?? null;
$house_hunting_motivation = $data['house_hunting_motivation'] ?? null;
$discovered_reason_name = $data['discovered_reason_name'] ?? null;
$inquiry_reason = $data['inquiry_reason'] ?? null;
$desired_property_category2 = $data['desired_property_category2'] ?? null;
$desired_elementary_school1 = $data['desired_elementary_school1'] ?? null;
$desired_elementary_school2 = $data['desired_elementary_school2'] ?? null;
$desired_elementary_school3 = $data['desired_elementary_school3'] ?? null;
$desired_junior_high_school1 = $data['desired_junior_high_school1'] ?? null;
$desired_junior_high_school2 = $data['desired_junior_high_school2'] ?? null;
$desired_junior_high_school3 = $data['desired_junior_high_school3'] ?? null;
$desired_land_area = $data['desired_land_area'] ?? null;
$desired_occupancy_area = $data['desired_occupancy_area'] ?? null;
$desired_area1_postal_code = $data['desired_area1_postal_code'] ?? null;
$desired_area1_address = $data['desired_area1_address'] ?? null;
$desired_area2_postal_code = $data['desired_area2_postal_code'] ?? null;
$desired_area2_address = $data['desired_area2_address'] ?? null;
$desired_area3_postal_code = $data['desired_area3_postal_code'] ?? null;
$desired_area3_address = $data['desired_area3_address'] ?? null;
$desired_nearby_station1_line_name = $data['desired_nearby_station1_line_name'] ?? null;
$desired_nearby_station1_name = $data['desired_nearby_station1_name'] ?? null;
$desired_nearby_station1_distance = $data['desired_nearby_station1_distance'] ?? null;
$desired_nearby_station2_line_name = $data['desired_nearby_station2_line_name'] ?? null;
$desired_nearby_station2_name = $data['desired_nearby_station2_name'] ?? null;
$desired_nearby_station2_distance = $data['desired_nearby_station2_distance'] ?? null;
$desired_nearby_station3_line_name = $data['desired_nearby_station3_line_name'] ?? null;
$desired_nearby_station3_name = $data['desired_nearby_station3_name'] ?? null;
$desired_nearby_station3_distance = $data['desired_nearby_station3_distance'] ?? null;
$desired_area_reason = $data['desired_area_reason'] ?? null;
$desired_floor = $data['desired_floor'] ?? null;
$desired_layout_rooms_number = $data['desired_layout_rooms_number'] ?? null;
$desired_layout_rooms_arrangement = $data['desired_layout_rooms_arrangement'] ?? null;
$desired_parking_number = $data['desired_parking_number'] ?? null;
$desired_age_of_construction_max = $data['desired_age_of_construction_max'] ?? null;
$desired_has_solar_power = $data['desired_has_solar_power'] ?? null;
$planned_construction_site = $data['planned_construction_site'] ?? null;
$contracted_property_id = $data['contracted_property_id'] ?? null;
$contract_land_application_date = $data['contract_land_application_date'] ?? null;
$contract_building_application_date = $data['contract_building_application_date'] ?? null;
$contract_planned_date = $data['contract_planned_date'] ?? null;
$contract_land_agreement_date = $data['contract_land_agreement_date'] ?? null;
$contract_building_agreement_date = $data['contract_building_agreement_date'] ?? null;
$contract_application_fee_planned_date = $data['contract_application_fee_planned_date'] ?? null;
$contract_payment_planned_date = $data['contract_payment_planned_date'] ?? null;
$contraction_contract_price = $data['contraction_contract_price'] ?? null;
$contraction_estimate_number = $data['contraction_estimate_number'] ?? null;
$contraction_funding_plan_number = $data['contraction_funding_plan_number'] ?? null;
$contraction_purchase_order_issued_date = $data['contraction_purchase_order_issued_date'] ?? null;
$additional_contraction_contract_price = $data['additional_contraction_contract_price'] ?? null;
$additional_contraction_estimate_number = $data['additional_contraction_estimate_number'] ?? null;
$additional_contraction_funding_plan_number = $data['additional_contraction_funding_plan_number'] ?? null;
$additional_contraction_purchase_order_issued_date = $data['additional_contraction_purchase_order_issued_date'] ?? null;
$handover_contract_price = $data['handover_contract_price'] ?? null;
$handover_estimate_number = $data['handover_estimate_number'] ?? null;
$handover_funding_plan_number = $data['handover_funding_plan_number'] ?? null;
$handover_purchase_order_issued_date = $data['handover_purchase_order_issued_date'] ?? null;
$customer_mortgage_examinations_status = $data['customer_mortgage_examinations_status'] ?? null;
$customer_mortgage_examinations_application_date = $data['customer_mortgage_examinations_application_date'] ?? null;
$customer_mortgage_examinations_proposal_date = $data['customer_mortgage_examinations_proposal_date'] ?? null;
$customer_mortgage_examinations_bank_name = $data['customer_mortgage_examinations_bank_name'] ?? null;
$customer_mortgage_examinations_desired_loan_amount = $data['customer_mortgage_examinations_desired_loan_amount'] ?? null;
$memo_developer_application_company = $data['memo_developer_application_company'] ?? null;
$memo_lawyer = $data['memo_lawyer'] ?? null;
$memo_fire_insurance = $data['memo_fire_insurance'] ?? null;
$memo_site_survey = $data['memo_site_survey'] ?? null;
$memo_ground_survey = $data['memo_ground_survey'] ?? null;
$memo_other_related_person = $data['memo_other_related_person'] ?? null;
$competitor_lost_contract_date = $data['competitor_lost_contract_date'] ?? null;
$competitors_text = $data['competitors_text'] ?? null;
$competitor_name = $data['competitor_name'] ?? null;
$competitor = $data['competitor'] ?? null;
$competitor_lost_contract_reason = $data['competitor_lost_contract_reason'] ?? null;
$customer_desired_floor = $data['customer_desired_floor'] ?? null;
$customer_desired_period = $data['customer_desired_period'] ?? null;
$customer_desired_estate = $data['customer_desired_estate'] ?? null;
$customer_desired_order = $data['customer_desired_order'] ?? null;
$call_status = $data['call_status'] ?? null;
$khg_id = $data['khg_id'] ?? null;
$desired_pref = $data['desired_pref'] ?? null;
$show_dashboard = $data['show_dashboard'] ?? 1;
$rank_period = $data['rank_period'] ?? null;
$hp_campaign = $data['hp_campaign'] ?? null;
$reserved_interview = $data['reserved_interview'] ?? null;
$cancel_status = $data['cancel_status'] ?? null;
$property_name = $data['property_name'] ?? null;
$property_tour_name = $data['property_tour_name'] ?? null;
$property_contract_name = $data['property_contract_name'] ?? null;
$has_owned_land = $data['has_owned_land'] ?? null;
$step_migration_item_catalog = $data['step_migration_item_catalog'] ?? null;
$step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 = $data['step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7'] ?? null;
$step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 = $data['step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99'] ?? null;
$step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z = $data['step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z'] ?? null;
$step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR = $data['step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR'] ?? null;
$step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN = $data['step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN'] ?? null;
$step_migration_item_01JSENACS2FC422ZHEZWNSXNYA = $data['step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'] ?? null;
$step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 = $data['step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0'] ?? null;
$step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG = $data['step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG'] ?? null;
$step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW = $data['step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW'] ?? null;
$step_migration_item_01J82Z5F1RR18Z792C7KZS88QG = $data['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'] ?? null;
$step_migration_item_01J82Z5F1WE8SKEES6VNN37B22 = $data['step_migration_item_01J82Z5F1WE8SKEES6VNN37B22'] ?? null;
$customized_input_01JRCT12N9X24PCQ5QZPAYKB93 = $data['customized_input_01JRCT12N9X24PCQ5QZPAYKB93'] ?? null;
$customized_input_01J82Z5F366ZQ897PXWF6H5ZAM = $data['customized_input_01J82Z5F366ZQ897PXWF6H5ZAM'] ?? null;
$customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN = $data['customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN'] ?? null;
$customized_input_01JSE7RNV3VK78YC2GYAG0554D = $data['customized_input_01JSE7RNV3VK78YC2GYAG0554D'] ?? null;
$customized_input_01J95TC6KEES87F0YXH29AJP7K = $data['customized_input_01J95TC6KEES87F0YXH29AJP7K'] ?? null;
$call_log = $data['call_log'] ?? null;


// 3. 値のバインド
$insertMasterStmt = $pdo->prepare($insertMasterSQL);
bindNullable($insertMasterStmt, ':id', $id, PDO::PARAM_STR);
bindNullable($insertMasterStmt, ':first_interviewed_date', $first_interviewed_date);
bindNullable($insertMasterStmt, ':date', $date);
bindNullable($insertMasterStmt, ':customer_contacts_name', $customer_contacts_name);
bindNullable($insertMasterStmt, ':customer_contacts_name_2', $customer_contacts_name_2);
bindNullable($insertMasterStmt, ':in_charge_store', $in_charge_store);
bindNullable($insertMasterStmt, ':in_charge_user', $in_charge_user);
bindNullable($insertMasterStmt, ':full_address', $full_address);
bindNullable($insertMasterStmt, ':sales_promotion_name', $sales_promotion_name);
bindNullable($insertMasterStmt, ':status', $status);
bindNullable($insertMasterStmt, ':category', $category);
bindNullable($insertMasterStmt, ':customer_contacts_name_kana', $customer_contacts_name_kana);
bindNullable($insertMasterStmt, ':customer_tags', $customer_tags);
bindNullable($insertMasterStmt, ':customer_contacts_phone_number', $customer_contacts_phone_number);
bindNullable($insertMasterStmt, ':customer_contacts_mobile_phone_number', $customer_contacts_mobile_phone_number);
bindNullable($insertMasterStmt, ':customer_contacts_email', $customer_contacts_email);
bindNullable($insertMasterStmt, ':customer_contacts_gender', $customer_contacts_gender);
bindNullable($insertMasterStmt, ':customer_contacts_birth_date', $customer_contacts_birth_date);
bindNullable($insertMasterStmt, ':customer_contacts_employment_type', $customer_contacts_employment_type);
bindNullable($insertMasterStmt, ':customer_contacts_employer_name', $customer_contacts_employer_name);
bindNullable($insertMasterStmt, ':customer_contacts_employer_address', $customer_contacts_employer_address);
bindNullable($insertMasterStmt, ':customer_contacts_years_of_service', $customer_contacts_years_of_service);
bindNullable($insertMasterStmt, ':customer_contacts_annual_income', $customer_contacts_annual_income);
bindNullable($insertMasterStmt, ':customer_contacts_count', $customer_contacts_count);
bindNullable($insertMasterStmt, ':elementary_school_id', $elementary_school_id);
bindNullable($insertMasterStmt, ':junior_high_school_id', $junior_high_school_id);
bindNullable($insertMasterStmt, ':postal_code', $postal_code);
bindNullable($insertMasterStmt, ':extra_address_info', $extra_address_info);
bindNullable($insertMasterStmt, ':current_contract_type', $current_contract_type);
bindNullable($insertMasterStmt, ':current_utility_costs', $current_utility_costs);
bindNullable($insertMasterStmt, ':current_rent', $current_rent);
bindNullable($insertMasterStmt, ':budget', $budget);
bindNullable($insertMasterStmt, ':land_budget', $land_budget);
bindNullable($insertMasterStmt, ':desired_purchase_date', $desired_purchase_date);
bindNullable($insertMasterStmt, ':repayment_years', $repayment_years);
bindNullable($insertMasterStmt, ':bonus_repayment_amount', $bonus_repayment_amount);
bindNullable($insertMasterStmt, ':current_loan_status', $current_loan_status);
bindNullable($insertMasterStmt, ':remarks', $remarks);
bindNullable($insertMasterStmt, ':brand', $brand);
bindNullable($insertMasterStmt, ':introduction_person_name', $introduction_person_name);
bindNullable($insertMasterStmt, ':introduction_person_category', $introduction_person_category);
bindNullable($insertMasterStmt, ':introduction_date', $introduction_date);
bindNullable($insertMasterStmt, ':created_by_name', $created_by_name);
bindNullable($insertMasterStmt, ':updated_by_name', $updated_by_name);
bindNullable($insertMasterStmt, ':created_at', $created_at);
bindNullable($insertMasterStmt, ':updated_at', $updated_at);
bindNullable($insertMasterStmt, ':customer_contacts_preferred_method_of_contact', $customer_contacts_preferred_method_of_contact);
bindNullable($insertMasterStmt, ':customer_contacts_preferred_contact_time', $customer_contacts_preferred_contact_time);
bindNullable($insertMasterStmt, ':customer_contacts_holiday_list', $customer_contacts_holiday_list);
bindNullable($insertMasterStmt, ':customer_contacts_commute', $customer_contacts_commute);
bindNullable($insertMasterStmt, ':customer_contacts_homecoming_time', $customer_contacts_homecoming_time);
bindNullable($insertMasterStmt, ':customer_contacts_parents_place_info', $customer_contacts_parents_place_info);
bindNullable($insertMasterStmt, ':email_subscription_status', $email_subscription_status);
bindNullable($insertMasterStmt, ':monthly_repayment_amount', $monthly_repayment_amount);
bindNullable($insertMasterStmt, ':self_budget', $self_budget);
bindNullable($insertMasterStmt, ':budget_reason', $budget_reason);
bindNullable($insertMasterStmt, ':desired_purchase_date_reason', $desired_purchase_date_reason);
bindNullable($insertMasterStmt, ':current_loan_balance', $current_loan_balance);
bindNullable($insertMasterStmt, ':current_monthly_repayment_amount', $current_monthly_repayment_amount);
bindNullable($insertMasterStmt, ':house_hunting_motivation', $house_hunting_motivation);
bindNullable($insertMasterStmt, ':discovered_reason_name', $discovered_reason_name);
bindNullable($insertMasterStmt, ':inquiry_reason', $inquiry_reason);
bindNullable($insertMasterStmt, ':desired_property_category2', $desired_property_category2);
bindNullable($insertMasterStmt, ':desired_elementary_school1', $desired_elementary_school1);
bindNullable($insertMasterStmt, ':desired_elementary_school2', $desired_elementary_school2);
bindNullable($insertMasterStmt, ':desired_elementary_school3', $desired_elementary_school3);
bindNullable($insertMasterStmt, ':desired_junior_high_school1', $desired_junior_high_school1);
bindNullable($insertMasterStmt, ':desired_junior_high_school2', $desired_junior_high_school2);
bindNullable($insertMasterStmt, ':desired_junior_high_school3', $desired_junior_high_school3);
bindNullable($insertMasterStmt, ':desired_land_area', $desired_land_area);
bindNullable($insertMasterStmt, ':desired_occupancy_area', $desired_occupancy_area);
bindNullable($insertMasterStmt, ':desired_area1_postal_code', $desired_area1_postal_code);
bindNullable($insertMasterStmt, ':desired_area1_address', $desired_area1_address);
bindNullable($insertMasterStmt, ':desired_area2_postal_code', $desired_area2_postal_code);
bindNullable($insertMasterStmt, ':desired_area2_address', $desired_area2_address);
bindNullable($insertMasterStmt, ':desired_area3_postal_code', $desired_area3_postal_code);
bindNullable($insertMasterStmt, ':desired_area3_address', $desired_area3_address);
bindNullable($insertMasterStmt, ':desired_nearby_station1_line_name', $desired_nearby_station1_line_name);
bindNullable($insertMasterStmt, ':desired_nearby_station1_name', $desired_nearby_station1_name);
bindNullable($insertMasterStmt, ':desired_nearby_station1_distance', $desired_nearby_station1_distance);
bindNullable($insertMasterStmt, ':desired_nearby_station2_line_name', $desired_nearby_station2_line_name);
bindNullable($insertMasterStmt, ':desired_nearby_station2_name', $desired_nearby_station2_name);
bindNullable($insertMasterStmt, ':desired_nearby_station2_distance', $desired_nearby_station2_distance);
bindNullable($insertMasterStmt, ':desired_nearby_station3_line_name', $desired_nearby_station3_line_name);
bindNullable($insertMasterStmt, ':desired_nearby_station3_name', $desired_nearby_station3_name);
bindNullable($insertMasterStmt, ':desired_nearby_station3_distance', $desired_nearby_station3_distance);
bindNullable($insertMasterStmt, ':desired_area_reason', $desired_area_reason);
bindNullable($insertMasterStmt, ':desired_floor', $desired_floor);
bindNullable($insertMasterStmt, ':desired_layout_rooms_number', $desired_layout_rooms_number);
bindNullable($insertMasterStmt, ':desired_layout_rooms_arrangement', $desired_layout_rooms_arrangement);
bindNullable($insertMasterStmt, ':desired_parking_number', $desired_parking_number);
bindNullable($insertMasterStmt, ':desired_age_of_construction_max', $desired_age_of_construction_max);
bindNullable($insertMasterStmt, ':desired_has_solar_power', $desired_has_solar_power);
bindNullable($insertMasterStmt, ':planned_construction_site', $planned_construction_site);
bindNullable($insertMasterStmt, ':contracted_property_id', $contracted_property_id);
bindNullable($insertMasterStmt, ':contract_land_application_date', $contract_land_application_date);
bindNullable($insertMasterStmt, ':contract_building_application_date', $contract_building_application_date);
bindNullable($insertMasterStmt, ':contract_planned_date', $contract_planned_date);
bindNullable($insertMasterStmt, ':contract_land_agreement_date', $contract_land_agreement_date);
bindNullable($insertMasterStmt, ':contract_building_agreement_date', $contract_building_agreement_date);
bindNullable($insertMasterStmt, ':contract_application_fee_planned_date', $contract_application_fee_planned_date);
bindNullable($insertMasterStmt, ':contract_payment_planned_date', $contract_payment_planned_date);
bindNullable($insertMasterStmt, ':contraction_contract_price', $contraction_contract_price);
bindNullable($insertMasterStmt, ':contraction_estimate_number', $contraction_estimate_number);
bindNullable($insertMasterStmt, ':contraction_funding_plan_number', $contraction_funding_plan_number);
bindNullable($insertMasterStmt, ':contraction_purchase_order_issued_date', $contraction_purchase_order_issued_date);
bindNullable($insertMasterStmt, ':additional_contraction_contract_price', $additional_contraction_contract_price);
bindNullable($insertMasterStmt, ':additional_contraction_estimate_number', $additional_contraction_estimate_number);
bindNullable($insertMasterStmt, ':additional_contraction_funding_plan_number', $additional_contraction_funding_plan_number);
bindNullable($insertMasterStmt, ':additional_contraction_purchase_order_issued_date', $additional_contraction_purchase_order_issued_date);
bindNullable($insertMasterStmt, ':handover_contract_price', $handover_contract_price);
bindNullable($insertMasterStmt, ':handover_estimate_number', $handover_estimate_number);
bindNullable($insertMasterStmt, ':handover_funding_plan_number', $handover_funding_plan_number);
bindNullable($insertMasterStmt, ':handover_purchase_order_issued_date', $handover_purchase_order_issued_date);
bindNullable($insertMasterStmt, ':customer_mortgage_examinations_status', $customer_mortgage_examinations_status);
bindNullable($insertMasterStmt, ':customer_mortgage_examinations_application_date', $customer_mortgage_examinations_application_date);
bindNullable($insertMasterStmt, ':customer_mortgage_examinations_proposal_date', $customer_mortgage_examinations_proposal_date);
bindNullable($insertMasterStmt, ':customer_mortgage_examinations_bank_name', $customer_mortgage_examinations_bank_name);
bindNullable($insertMasterStmt, ':customer_mortgage_examinations_desired_loan_amount', $customer_mortgage_examinations_desired_loan_amount);
bindNullable($insertMasterStmt, ':memo_developer_application_company', $memo_developer_application_company);
bindNullable($insertMasterStmt, ':memo_lawyer', $memo_lawyer);
bindNullable($insertMasterStmt, ':memo_fire_insurance', $memo_fire_insurance);
bindNullable($insertMasterStmt, ':memo_site_survey', $memo_site_survey);
bindNullable($insertMasterStmt, ':memo_ground_survey', $memo_ground_survey);
bindNullable($insertMasterStmt, ':memo_other_related_person', $memo_other_related_person);
bindNullable($insertMasterStmt, ':competitor_lost_contract_date', $competitor_lost_contract_date);
bindNullable($insertMasterStmt, ':competitors_text', $competitors_text);
bindNullable($insertMasterStmt, ':competitor_name', $competitor_name);
bindNullable($insertMasterStmt, ':competitor', $competitor);
bindNullable($insertMasterStmt, ':competitor_lost_contract_reason', $competitor_lost_contract_reason);
bindNullable($insertMasterStmt, ':customer_desired_floor', $customer_desired_floor);
bindNullable($insertMasterStmt, ':customer_desired_period', $customer_desired_period);
bindNullable($insertMasterStmt, ':customer_desired_estate', $customer_desired_estate);
bindNullable($insertMasterStmt, ':customer_desired_order', $customer_desired_order);
bindNullable($insertMasterStmt, ':call_status', $call_status);
bindNullable($insertMasterStmt, ':khg_id', $khg_id);
bindNullable($insertMasterStmt, ':desired_pref', $desired_pref);
bindNullable($insertMasterStmt, ':show_dashboard', $show_dashboard);
bindNullable($insertMasterStmt, ':rank_period', $rank_period);
bindNullable($insertMasterStmt, ':hp_campaign', $hp_campaign);
bindNullable($insertMasterStmt, ':reserved_interview', $reserved_interview);
bindNullable($insertMasterStmt, ':cancel_status', $cancel_status);
bindNullable($insertMasterStmt, ':property_name', $property_name);
bindNullable($insertMasterStmt, ':property_tour_name', $property_tour_name);
bindNullable($insertMasterStmt, ':property_contract_name', $property_contract_name);
bindNullable($insertMasterStmt, ':has_owned_land', $has_owned_land);
bindNullable($insertMasterStmt, ':step_migration_item_catalog', $step_migration_item_catalog);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', $step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', $step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', $step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z);
bindNullable($insertMasterStmt, ':step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', $step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR);
bindNullable($insertMasterStmt, ':step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', $step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN);
bindNullable($insertMasterStmt, ':step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', $step_migration_item_01JSENACS2FC422ZHEZWNSXNYA);
bindNullable($insertMasterStmt, ':step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', $step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0);
bindNullable($insertMasterStmt, ':step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', $step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG);
bindNullable($insertMasterStmt, ':step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', $step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', $step_migration_item_01J82Z5F1RR18Z792C7KZS88QG);
bindNullable($insertMasterStmt, ':step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', $step_migration_item_01J82Z5F1WE8SKEES6VNN37B22);
bindNullable($insertMasterStmt, ':customized_input_01JRCT12N9X24PCQ5QZPAYKB93', $customized_input_01JRCT12N9X24PCQ5QZPAYKB93);
bindNullable($insertMasterStmt, ':customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', $customized_input_01J82Z5F366ZQ897PXWF6H5ZAM);
bindNullable($insertMasterStmt, ':customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', $customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN);
bindNullable($insertMasterStmt, ':customized_input_01JSE7RNV3VK78YC2GYAG0554D', $customized_input_01JSE7RNV3VK78YC2GYAG0554D);
bindNullable($insertMasterStmt, ':customized_input_01J95TC6KEES87F0YXH29AJP7K', $customized_input_01J95TC6KEES87F0YXH29AJP7K);
bindNullable($insertMasterStmt, ':call_log', $call_log);

// 4. 実行とレスポンス
if ($insertMasterStmt->execute()) {
    echo json_encode([
        'status' => 'success',
        'message' => ($customer_contacts_name ?? 'お客様') . '様を顧客情報に登録しました。'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    echo json_encode([
        'status' => 'error',
        'message' => '顧客情報の登録に失敗しました。'
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
