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

// 1. UPDATE文の定義
$updateMasterSQL = 'UPDATE master_data_kaeru SET  
            customer_contacts_name = :customer_contacts_name,
            in_charge_user = :in_charge_user,
            in_charge_store = :in_charge_store,
            first_interviewed_date = :first_interviewed_date,
            date = :date,
            full_address = :full_address,
            sales_promotion_name = :sales_promotion_name,
            status = :status,
            category = :category,
            customer_contacts_name_kana = :customer_contacts_name_kana,
            customer_tags = :customer_tags,
            customer_contacts_phone_number = :customer_contacts_phone_number,
            customer_contacts_mobile_phone_number = :customer_contacts_mobile_phone_number,
            customer_contacts_email = :customer_contacts_email,
            customer_contacts_gender = :customer_contacts_gender,
            customer_contacts_birth_date = :customer_contacts_birth_date,
            customer_contacts_employment_type = :customer_contacts_employment_type,
            customer_contacts_employer_name = :customer_contacts_employer_name,
            customer_contacts_employer_address = :customer_contacts_employer_address,
            customer_contacts_years_of_service = :customer_contacts_years_of_service,
            customer_contacts_annual_income = :customer_contacts_annual_income,
            customer_contacts_count = :customer_contacts_count,
            elementary_school_id = :elementary_school_id,
            junior_high_school_id = :junior_high_school_id,
            postal_code = :postal_code,
            extra_address_info = :extra_address_info,
            current_contract_type = :current_contract_type,
            current_utility_costs = :current_utility_costs,
            current_rent = :current_rent,
            budget = :budget,
            land_budget = :land_budget,
            desired_purchase_date = :desired_purchase_date,
            repayment_years = :repayment_years,
            bonus_repayment_amount = :bonus_repayment_amount,
            current_loan_status = :current_loan_status,
            remarks = :remarks,
            brand = :brand,
            introduction_person_name = :introduction_person_name,
            introduction_person_category = :introduction_person_category,
            introduction_date = :introduction_date,
            created_by_name = :created_by_name,
            updated_by_name = :updated_by_name,
            created_at = :created_at,
            updated_at = :updated_at,
            customer_contacts_preferred_method_of_contact = :customer_contacts_preferred_method_of_contact,
            customer_contacts_preferred_contact_time = :customer_contacts_preferred_contact_time,
            customer_contacts_holiday_list = :customer_contacts_holiday_list,
            customer_contacts_commute = :customer_contacts_commute,
            customer_contacts_homecoming_time = :customer_contacts_homecoming_time,
            customer_contacts_parents_place_info = :customer_contacts_parents_place_info,
            email_subscription_status = :email_subscription_status,
            monthly_repayment_amount = :monthly_repayment_amount,
            self_budget = :self_budget,
            budget_reason = :budget_reason,
            desired_purchase_date_reason = :desired_purchase_date_reason,
            current_loan_balance = :current_loan_balance,
            current_monthly_repayment_amount = :current_monthly_repayment_amount,
            house_hunting_motivation = :house_hunting_motivation,
            discovered_reason_name = :discovered_reason_name,
            inquiry_reason = :inquiry_reason,
            desired_property_category2 = :desired_property_category2,
            desired_elementary_school1 = :desired_elementary_school1,
            desired_elementary_school2 = :desired_elementary_school2,
            desired_elementary_school3 = :desired_elementary_school3,
            desired_junior_high_school1 = :desired_junior_high_school1,
            desired_junior_high_school2 = :desired_junior_high_school2,
            desired_junior_high_school3 = :desired_junior_high_school3,
            desired_land_area = :desired_land_area,
            desired_occupancy_area = :desired_occupancy_area,
            desired_area1_postal_code = :desired_area1_postal_code,
            desired_area1_address = :desired_area1_address,
            desired_area2_postal_code = :desired_area2_postal_code,
            desired_area2_address = :desired_area2_address,
            desired_area3_postal_code = :desired_area3_postal_code,
            desired_area3_address = :desired_area3_address,
            desired_nearby_station1_line_name = :desired_nearby_station1_line_name,
            desired_nearby_station1_name = :desired_nearby_station1_name,
            desired_nearby_station1_distance = :desired_nearby_station1_distance,
            desired_nearby_station2_line_name = :desired_nearby_station2_line_name,
            desired_nearby_station2_name = :desired_nearby_station2_name,
            desired_nearby_station2_distance = :desired_nearby_station2_distance,
            desired_nearby_station3_line_name = :desired_nearby_station3_line_name,
            desired_nearby_station3_name = :desired_nearby_station3_name,
            desired_nearby_station3_distance = :desired_nearby_station3_distance,
            desired_area_reason = :desired_area_reason,
            desired_floor = :desired_floor,
            desired_layout_rooms_number = :desired_layout_rooms_number,
            desired_layout_rooms_arrangement = :desired_layout_rooms_arrangement,
            desired_parking_number = :desired_parking_number,
            desired_age_of_construction_max = :desired_age_of_construction_max,
            desired_has_solar_power = :desired_has_solar_power,
            planned_construction_site = :planned_construction_site,
            contracted_property_id = :contracted_property_id,
            contract_land_application_date = :contract_land_application_date,
            contract_building_application_date = :contract_building_application_date,
            contract_planned_date = :contract_planned_date,
            contract_land_agreement_date = :contract_land_agreement_date,
            contract_building_agreement_date = :contract_building_agreement_date,
            contract_application_fee_planned_date = :contract_application_fee_planned_date,
            contract_payment_planned_date = :contract_payment_planned_date,
            contraction_contract_price = :contraction_contract_price,
            contraction_estimate_number = :contraction_estimate_number,
            contraction_funding_plan_number = :contraction_funding_plan_number,
            contraction_purchase_order_issued_date = :contraction_purchase_order_issued_date,
            additional_contraction_contract_price = :additional_contraction_contract_price,
            additional_contraction_estimate_number = :additional_contraction_estimate_number,
            additional_contraction_funding_plan_number = :additional_contraction_funding_plan_number,
            additional_contraction_purchase_order_issued_date = :additional_contraction_purchase_order_issued_date,
            handover_contract_price = :handover_contract_price,
            handover_estimate_number = :handover_estimate_number,
            handover_funding_plan_number = :handover_funding_plan_number,
            handover_purchase_order_issued_date = :handover_purchase_order_issued_date,
            customer_mortgage_examinations_status = :customer_mortgage_examinations_status,
            customer_mortgage_examinations_application_date = :customer_mortgage_examinations_application_date,
            customer_mortgage_examinations_proposal_date = :customer_mortgage_examinations_proposal_date,
            customer_mortgage_examinations_bank_name = :customer_mortgage_examinations_bank_name,
            customer_mortgage_examinations_desired_loan_amount = :customer_mortgage_examinations_desired_loan_amount,
            memo_developer_application_company = :memo_developer_application_company,
            memo_lawyer = :memo_lawyer,
            memo_fire_insurance = :memo_fire_insurance,
            memo_site_survey = :memo_site_survey,
            memo_ground_survey = :memo_ground_survey,
            memo_other_related_person = :memo_other_related_person,
            competitor_lost_contract_date = :competitor_lost_contract_date,
            competitors_text = :competitors_text,
            competitor_name = :competitor_name,
            competitor = :competitor,
            competitor_lost_contract_reason = :competitor_lost_contract_reason,
            customer_desired_floor = :customer_desired_floor,
            customer_desired_period = :customer_desired_period,
            customer_desired_estate = :customer_desired_estate,
            customer_desired_order = :customer_desired_order,
            call_status = :call_status,
            khg_id = :khg_id,
            desired_pref = :desired_pref,
            show_dashboard = :show_dashboard,
            rank_period = :rank_period,
            hp_campaign = :hp_campaign,
            reserved_interview = :reserved_interview,
            cancel_status = :cancel_status,
            property_name = :property_name,
            property_tour_name = :property_tour_name,
            has_owned_land = :has_owned_land,
            step_migration_item_catalog = :step_migration_item_catalog,
            step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 = :step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7,
            step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 = :step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
            step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z = :step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z,
            step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR = :step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR,
            step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN = :step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN,
            step_migration_item_01JSENACS2FC422ZHEZWNSXNYA = :step_migration_item_01JSENACS2FC422ZHEZWNSXNYA,
            step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 = :step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0,
            step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG = :step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG,
            step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW = :step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW,
            step_migration_item_01J82Z5F1RR18Z792C7KZS88QG = :step_migration_item_01J82Z5F1RR18Z792C7KZS88QG,
            customized_input_01JRCT12N9X24PCQ5QZPAYKB93 = :customized_input_01JRCT12N9X24PCQ5QZPAYKB93,
            customized_input_01J82Z5F366ZQ897PXWF6H5ZAM = :customized_input_01J82Z5F366ZQ897PXWF6H5ZAM,
            customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN = :customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN,
            customized_input_01JSE7RNV3VK78YC2GYAG0554D = :customized_input_01JSE7RNV3VK78YC2GYAG0554D,
            customized_input_01J95TC6KEES87F0YXH29AJP7K = :customized_input_01J95TC6KEES87F0YXH29AJP7K
            WHERE id = :id';

// 2. 安全に値を取り出す（未定義キー対策）
$id = $data['id'] ?? null;
$first_interviewed_date = date('Y/m/d'); // 挿入時に今日を入れる場合
$date = $data['date'] ?? null;
$customer_contacts_name = $data['customer_contacts_name'] ?? null;
$in_charge_store = $data['in_charge_store'] ?? null;
$in_charge_user = $data['in_charge_user'] ?? null;
$full_address = $data['full_address'] ?? null;
$sales_promotion_name = $data['sales_promotion_name'] ?? null;
$status = $data['status'] ?? null;
$category = $data['category'] ?? null;
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
$created_at = $data['created_at'] ?? null;
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
$show_dashboard = $data['show_dashboard'] ?? null;
$rank_period = $data['rank_period'] ?? null;
$hp_campaign = $data['hp_campaign'] ?? null;
$reserved_interview = $data['reserved_interview'] ?? null;
$cancel_status = $data['cancel_status'] ?? null;
$property_name = $data['property_name'] ?? null;
$property_tour_name = $data['property_tour_name'] ?? null;
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
$customized_input_01JRCT12N9X24PCQ5QZPAYKB93 = $data['customized_input_01JRCT12N9X24PCQ5QZPAYKB93'] ?? null;
$customized_input_01J82Z5F366ZQ897PXWF6H5ZAM = $data['customized_input_01J82Z5F366ZQ897PXWF6H5ZAM'] ?? null;
$customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN = $data['customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN'] ?? null;
$customized_input_01JSE7RNV3VK78YC2GYAG0554D = $data['customized_input_01JSE7RNV3VK78YC2GYAG0554D'] ?? null;
$customized_input_01J95TC6KEES87F0YXH29AJP7K = $data['customized_input_01J95TC6KEES87F0YXH29AJP7K'] ?? null;


// 3. 値のバインド
$updateMasterStmt = $pdo->prepare($updateMasterSQL);
bindNullable($updateMasterStmt, ':id', $id, PDO::PARAM_STR);
bindNullable($updateMasterStmt, ':first_interviewed_date', $first_interviewed_date);
bindNullable($updateMasterStmt, ':date', $date);
bindNullable($updateMasterStmt, ':customer_contacts_name', $customer_contacts_name);
bindNullable($updateMasterStmt, ':in_charge_store', $in_charge_store);
bindNullable($updateMasterStmt, ':in_charge_user', $in_charge_user);
bindNullable($updateMasterStmt, ':full_address', $full_address);
bindNullable($updateMasterStmt, ':sales_promotion_name', $sales_promotion_name);
bindNullable($updateMasterStmt, ':status', $status);
bindNullable($updateMasterStmt, ':category', $category);
bindNullable($updateMasterStmt, ':customer_contacts_name_kana', $customer_contacts_name_kana);
bindNullable($updateMasterStmt, ':customer_tags', $customer_tags);
bindNullable($updateMasterStmt, ':customer_contacts_phone_number', $customer_contacts_phone_number);
bindNullable($updateMasterStmt, ':customer_contacts_mobile_phone_number', $customer_contacts_mobile_phone_number);
bindNullable($updateMasterStmt, ':customer_contacts_email', $customer_contacts_email);
bindNullable($updateMasterStmt, ':customer_contacts_gender', $customer_contacts_gender);
bindNullable($updateMasterStmt, ':customer_contacts_birth_date', $customer_contacts_birth_date);
bindNullable($updateMasterStmt, ':customer_contacts_employment_type', $customer_contacts_employment_type);
bindNullable($updateMasterStmt, ':customer_contacts_employer_name', $customer_contacts_employer_name);
bindNullable($updateMasterStmt, ':customer_contacts_employer_address', $customer_contacts_employer_address);
bindNullable($updateMasterStmt, ':customer_contacts_years_of_service', $customer_contacts_years_of_service);
bindNullable($updateMasterStmt, ':customer_contacts_annual_income', $customer_contacts_annual_income);
bindNullable($updateMasterStmt, ':customer_contacts_count', $customer_contacts_count);
bindNullable($updateMasterStmt, ':elementary_school_id', $elementary_school_id);
bindNullable($updateMasterStmt, ':junior_high_school_id', $junior_high_school_id);
bindNullable($updateMasterStmt, ':postal_code', $postal_code);
bindNullable($updateMasterStmt, ':extra_address_info', $extra_address_info);
bindNullable($updateMasterStmt, ':current_contract_type', $current_contract_type);
bindNullable($updateMasterStmt, ':current_utility_costs', $current_utility_costs);
bindNullable($updateMasterStmt, ':current_rent', $current_rent);
bindNullable($updateMasterStmt, ':budget', $budget);
bindNullable($updateMasterStmt, ':land_budget', $land_budget);
bindNullable($updateMasterStmt, ':desired_purchase_date', $desired_purchase_date);
bindNullable($updateMasterStmt, ':repayment_years', $repayment_years);
bindNullable($updateMasterStmt, ':bonus_repayment_amount', $bonus_repayment_amount);
bindNullable($updateMasterStmt, ':current_loan_status', $current_loan_status);
bindNullable($updateMasterStmt, ':remarks', $remarks);
bindNullable($updateMasterStmt, ':brand', $brand);
bindNullable($updateMasterStmt, ':introduction_person_name', $introduction_person_name);
bindNullable($updateMasterStmt, ':introduction_person_category', $introduction_person_category);
bindNullable($updateMasterStmt, ':introduction_date', $introduction_date);
bindNullable($updateMasterStmt, ':created_by_name', $created_by_name);
bindNullable($updateMasterStmt, ':updated_by_name', $updated_by_name);
bindNullable($updateMasterStmt, ':created_at', $created_at);
bindNullable($updateMasterStmt, ':updated_at', $updated_at);
bindNullable($updateMasterStmt, ':customer_contacts_preferred_method_of_contact', $customer_contacts_preferred_method_of_contact);
bindNullable($updateMasterStmt, ':customer_contacts_preferred_contact_time', $customer_contacts_preferred_contact_time);
bindNullable($updateMasterStmt, ':customer_contacts_holiday_list', $customer_contacts_holiday_list);
bindNullable($updateMasterStmt, ':customer_contacts_commute', $customer_contacts_commute);
bindNullable($updateMasterStmt, ':customer_contacts_homecoming_time', $customer_contacts_homecoming_time);
bindNullable($updateMasterStmt, ':customer_contacts_parents_place_info', $customer_contacts_parents_place_info);
bindNullable($updateMasterStmt, ':email_subscription_status', $email_subscription_status);
bindNullable($updateMasterStmt, ':monthly_repayment_amount', $monthly_repayment_amount);
bindNullable($updateMasterStmt, ':self_budget', $self_budget);
bindNullable($updateMasterStmt, ':budget_reason', $budget_reason);
bindNullable($updateMasterStmt, ':desired_purchase_date_reason', $desired_purchase_date_reason);
bindNullable($updateMasterStmt, ':current_loan_balance', $current_loan_balance);
bindNullable($updateMasterStmt, ':current_monthly_repayment_amount', $current_monthly_repayment_amount);
bindNullable($updateMasterStmt, ':house_hunting_motivation', $house_hunting_motivation);
bindNullable($updateMasterStmt, ':discovered_reason_name', $discovered_reason_name);
bindNullable($updateMasterStmt, ':inquiry_reason', $inquiry_reason);
bindNullable($updateMasterStmt, ':desired_property_category2', $desired_property_category2);
bindNullable($updateMasterStmt, ':desired_elementary_school1', $desired_elementary_school1);
bindNullable($updateMasterStmt, ':desired_elementary_school2', $desired_elementary_school2);
bindNullable($updateMasterStmt, ':desired_elementary_school3', $desired_elementary_school3);
bindNullable($updateMasterStmt, ':desired_junior_high_school1', $desired_junior_high_school1);
bindNullable($updateMasterStmt, ':desired_junior_high_school2', $desired_junior_high_school2);
bindNullable($updateMasterStmt, ':desired_junior_high_school3', $desired_junior_high_school3);
bindNullable($updateMasterStmt, ':desired_land_area', $desired_land_area);
bindNullable($updateMasterStmt, ':desired_occupancy_area', $desired_occupancy_area);
bindNullable($updateMasterStmt, ':desired_area1_postal_code', $desired_area1_postal_code);
bindNullable($updateMasterStmt, ':desired_area1_address', $desired_area1_address);
bindNullable($updateMasterStmt, ':desired_area2_postal_code', $desired_area2_postal_code);
bindNullable($updateMasterStmt, ':desired_area2_address', $desired_area2_address);
bindNullable($updateMasterStmt, ':desired_area3_postal_code', $desired_area3_postal_code);
bindNullable($updateMasterStmt, ':desired_area3_address', $desired_area3_address);
bindNullable($updateMasterStmt, ':desired_nearby_station1_line_name', $desired_nearby_station1_line_name);
bindNullable($updateMasterStmt, ':desired_nearby_station1_name', $desired_nearby_station1_name);
bindNullable($updateMasterStmt, ':desired_nearby_station1_distance', $desired_nearby_station1_distance);
bindNullable($updateMasterStmt, ':desired_nearby_station2_line_name', $desired_nearby_station2_line_name);
bindNullable($updateMasterStmt, ':desired_nearby_station2_name', $desired_nearby_station2_name);
bindNullable($updateMasterStmt, ':desired_nearby_station2_distance', $desired_nearby_station2_distance);
bindNullable($updateMasterStmt, ':desired_nearby_station3_line_name', $desired_nearby_station3_line_name);
bindNullable($updateMasterStmt, ':desired_nearby_station3_name', $desired_nearby_station3_name);
bindNullable($updateMasterStmt, ':desired_nearby_station3_distance', $desired_nearby_station3_distance);
bindNullable($updateMasterStmt, ':desired_area_reason', $desired_area_reason);
bindNullable($updateMasterStmt, ':desired_floor', $desired_floor);
bindNullable($updateMasterStmt, ':desired_layout_rooms_number', $desired_layout_rooms_number);
bindNullable($updateMasterStmt, ':desired_layout_rooms_arrangement', $desired_layout_rooms_arrangement);
bindNullable($updateMasterStmt, ':desired_parking_number', $desired_parking_number);
bindNullable($updateMasterStmt, ':desired_age_of_construction_max', $desired_age_of_construction_max);
bindNullable($updateMasterStmt, ':desired_has_solar_power', $desired_has_solar_power);
bindNullable($updateMasterStmt, ':planned_construction_site', $planned_construction_site);
bindNullable($updateMasterStmt, ':contracted_property_id', $contracted_property_id);
bindNullable($updateMasterStmt, ':contract_land_application_date', $contract_land_application_date);
bindNullable($updateMasterStmt, ':contract_building_application_date', $contract_building_application_date);
bindNullable($updateMasterStmt, ':contract_planned_date', $contract_planned_date);
bindNullable($updateMasterStmt, ':contract_land_agreement_date', $contract_land_agreement_date);
bindNullable($updateMasterStmt, ':contract_building_agreement_date', $contract_building_agreement_date);
bindNullable($updateMasterStmt, ':contract_application_fee_planned_date', $contract_application_fee_planned_date);
bindNullable($updateMasterStmt, ':contract_payment_planned_date', $contract_payment_planned_date);
bindNullable($updateMasterStmt, ':contraction_contract_price', $contraction_contract_price);
bindNullable($updateMasterStmt, ':contraction_estimate_number', $contraction_estimate_number);
bindNullable($updateMasterStmt, ':contraction_funding_plan_number', $contraction_funding_plan_number);
bindNullable($updateMasterStmt, ':contraction_purchase_order_issued_date', $contraction_purchase_order_issued_date);
bindNullable($updateMasterStmt, ':additional_contraction_contract_price', $additional_contraction_contract_price);
bindNullable($updateMasterStmt, ':additional_contraction_estimate_number', $additional_contraction_estimate_number);
bindNullable($updateMasterStmt, ':additional_contraction_funding_plan_number', $additional_contraction_funding_plan_number);
bindNullable($updateMasterStmt, ':additional_contraction_purchase_order_issued_date', $additional_contraction_purchase_order_issued_date);
bindNullable($updateMasterStmt, ':handover_contract_price', $handover_contract_price);
bindNullable($updateMasterStmt, ':handover_estimate_number', $handover_estimate_number);
bindNullable($updateMasterStmt, ':handover_funding_plan_number', $handover_funding_plan_number);
bindNullable($updateMasterStmt, ':handover_purchase_order_issued_date', $handover_purchase_order_issued_date);
bindNullable($updateMasterStmt, ':customer_mortgage_examinations_status', $customer_mortgage_examinations_status);
bindNullable($updateMasterStmt, ':customer_mortgage_examinations_application_date', $customer_mortgage_examinations_application_date);
bindNullable($updateMasterStmt, ':customer_mortgage_examinations_proposal_date', $customer_mortgage_examinations_proposal_date);
bindNullable($updateMasterStmt, ':customer_mortgage_examinations_bank_name', $customer_mortgage_examinations_bank_name);
bindNullable($updateMasterStmt, ':customer_mortgage_examinations_desired_loan_amount', $customer_mortgage_examinations_desired_loan_amount);
bindNullable($updateMasterStmt, ':memo_developer_application_company', $memo_developer_application_company);
bindNullable($updateMasterStmt, ':memo_lawyer', $memo_lawyer);
bindNullable($updateMasterStmt, ':memo_fire_insurance', $memo_fire_insurance);
bindNullable($updateMasterStmt, ':memo_site_survey', $memo_site_survey);
bindNullable($updateMasterStmt, ':memo_ground_survey', $memo_ground_survey);
bindNullable($updateMasterStmt, ':memo_other_related_person', $memo_other_related_person);
bindNullable($updateMasterStmt, ':competitor_lost_contract_date', $competitor_lost_contract_date);
bindNullable($updateMasterStmt, ':competitors_text', $competitors_text);
bindNullable($updateMasterStmt, ':competitor_name', $competitor_name);
bindNullable($updateMasterStmt, ':competitor', $competitor);
bindNullable($updateMasterStmt, ':competitor_lost_contract_reason', $competitor_lost_contract_reason);
bindNullable($updateMasterStmt, ':customer_desired_floor', $customer_desired_floor);
bindNullable($updateMasterStmt, ':customer_desired_period', $customer_desired_period);
bindNullable($updateMasterStmt, ':customer_desired_estate', $customer_desired_estate);
bindNullable($updateMasterStmt, ':customer_desired_order', $customer_desired_order);
bindNullable($updateMasterStmt, ':call_status', $call_status);
bindNullable($updateMasterStmt, ':khg_id', $khg_id);
bindNullable($updateMasterStmt, ':desired_pref', $desired_pref);
bindNullable($updateMasterStmt, ':show_dashboard', $show_dashboard);
bindNullable($updateMasterStmt, ':rank_period', $rank_period);
bindNullable($updateMasterStmt, ':hp_campaign', $hp_campaign);
bindNullable($updateMasterStmt, ':reserved_interview', $reserved_interview);
bindNullable($updateMasterStmt, ':cancel_status', $cancel_status);
bindNullable($updateMasterStmt, ':property_name', $property_name);
bindNullable($updateMasterStmt, ':property_tour_name', $property_tour_name);
bindNullable($updateMasterStmt, ':has_owned_land', $has_owned_land);
bindNullable($updateMasterStmt, ':step_migration_item_catalog', $step_migration_item_catalog);
bindNullable($updateMasterStmt, ':step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', $step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7);
bindNullable($updateMasterStmt, ':step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', $step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99);
bindNullable($updateMasterStmt, ':step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', $step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z);
bindNullable($updateMasterStmt, ':step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', $step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR);
bindNullable($updateMasterStmt, ':step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', $step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN);
bindNullable($updateMasterStmt, ':step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', $step_migration_item_01JSENACS2FC422ZHEZWNSXNYA);
bindNullable($updateMasterStmt, ':step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', $step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0);
bindNullable($updateMasterStmt, ':step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', $step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG);
bindNullable($updateMasterStmt, ':step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', $step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW);
bindNullable($updateMasterStmt, ':step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', $step_migration_item_01J82Z5F1RR18Z792C7KZS88QG);
bindNullable($updateMasterStmt, ':customized_input_01JRCT12N9X24PCQ5QZPAYKB93', $customized_input_01JRCT12N9X24PCQ5QZPAYKB93);
bindNullable($updateMasterStmt, ':customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', $customized_input_01J82Z5F366ZQ897PXWF6H5ZAM);
bindNullable($updateMasterStmt, ':customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', $customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN);
bindNullable($updateMasterStmt, ':customized_input_01JSE7RNV3VK78YC2GYAG0554D', $customized_input_01JSE7RNV3VK78YC2GYAG0554D);
bindNullable($updateMasterStmt, ':customized_input_01J95TC6KEES87F0YXH29AJP7K', $customized_input_01J95TC6KEES87F0YXH29AJP7K);

// 4. 実行とレスポンス
if ($updateMasterStmt->execute()) {
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
