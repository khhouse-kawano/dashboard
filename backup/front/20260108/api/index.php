<?php
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/token.php';
require_once __DIR__ . '/core/helpers.php';

$action = $_GET['action'] ?? '';

try {
    if ($demand === "contract_goal" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/contract_goal.php';
    } elseif ($demand === "customer_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_list.php';
    } elseif ($demand === "customer_detail" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_detail.php';
    } elseif ($demand === "all_customer" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/all_customer.php';
    } elseif ($demand === "customer_database" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_database.php';
    } elseif ($demand === "trend_customer" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/trend_customer.php';
    } elseif ($demand === "shop_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/shop_list.php';
    } elseif ($demand === "shop_marketing" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/shop_marketing.php';
    } elseif ($demand === "staff_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/staff_list.php';
    } elseif ($demand === "medium_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/medium_list.php';
    } elseif ($demand === "inquiry_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/inquiry_list.php';
    } elseif ($demand === "achievement_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/achievement_list.php';
    } elseif ($demand === "shop_change" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/shop_change.php';
    } elseif ($demand === "tag" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/tag.php';
    } elseif ($demand === "staff_change" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/staff_change.php';
    } elseif ($demand === "reserve_goal" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/reserve_goal.php';
    } elseif ($demand === "reserve_calendar" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/reserve_calendar.php';
    } elseif ($demand === "form_set" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/form_set.php';
    } elseif ($demand === "before_survey" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/before_survey.php';
    } elseif ($demand === "after_survey" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/after_survey.php';
    } elseif ($demand === "survey_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/survey_list.php';
    } elseif ($demand === "contract_expected" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/contract_expected.php';
    } elseif ($demand === "contract_ex_update" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/contract_ex_update.php';
    } elseif ($demand === "campaign" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/campaign.php';
    } elseif ($demand === "master_data_for_survey" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/master_data_for_survey.php';
    } elseif ($demand === "show_before_survey" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/show_before_survey.php';
    } elseif ($demand === "show_before_interview" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/show_before_interview.php';
    } elseif ($demand === "show_after_interview" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/show_after_interview.php';
    } elseif ($demand === "show_customer_interview" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/show_customer_interview.php';
    } elseif ($demand === "myhomerobo_test_mail" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/myhomerobo_test_mail.php';
    } elseif ($demand === "myhomerobo_customer_mail" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/myhomerobo_customer_mail.php';
    } elseif ($demand === "open_myhomerobo_mail" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/open_myhomerobo_mail.php';
    } elseif ($demand === "show_customer_call_log" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/show_customer_call_log.php';
    } elseif ($demand === "update_call_log" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/update_call_log.php';
    } elseif ($demand === "customer_budget" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_budget.php';
    } elseif ($demand === "customer_budget_kaeru" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_budget_kaeru.php';
    } elseif ($demand === "khf_customer" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/khf_customer.php';
    } elseif ($demand === "customer_map" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_map.php';
    } elseif ($demand === "map_check" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/map_check.php';
    } elseif ($demand === "address_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/address_list.php';
    } elseif ($demand === "customer_summary" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_summary.php';
    } elseif ($demand === "contract_customer" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/contract_customer.php';
    } elseif ($demand === "contract_staff" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/contract_staff.php';
    } elseif ($demand === "contract_shop" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/contract_shop.php';
    } elseif ($demand === "section_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/section_list.php';
    } elseif ($demand === "breakaway" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/breakaway.php';
    } elseif ($demand === "form_show" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/form_show.php';
    } elseif ($demand === "form_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/form_list.php';
    } elseif ($demand === "breakaway_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/breakaway_list.php';
    } elseif ($demand === "shop_review" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/shop_review.php';
    } elseif ($demand === "post_review" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/post_review.php';
    } elseif ($demand === "population" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/population.php';
    } elseif ($demand === "households" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/households.php';
    } elseif ($demand === "marketing" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/marketing.php';
    } elseif ($demand === "build" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/build.php';
    } elseif ($demand === "marketing_khf" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/marketing_khf.php';
    } elseif ($demand === "contract_list" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/contract_list.php';
    } elseif ($demand === "construction_list_khf" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/construction_list_khf.php';
    } elseif ($demand === "delete_customer_database" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/delete_customer_database.php';
    } elseif ($demand === "return_customer_database" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/return_customer_database.php';
    } elseif ($demand === "medium_marketing" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/medium_marketing.php';
    } elseif ($action === "login") {
        require_once __DIR__ . '/actions/login.php';
    } elseif ($action === "login_user") {
        require_once __DIR__ . '/actions/user.php';
    } elseif ($demand === "shop_list_accounting" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/shop_list_accounting.php';
    } elseif ($demand === "budget_accounting" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/budget_accounting.php';
    } elseif ($demand === "medium_list_accounting" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/medium_list_accounting.php';
    } elseif ($demand === "customer_contract" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/customer_contract.php';
    } elseif ($demand === "change_company_achievement" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/change_company_achievement.php';
    } elseif ($demand === "company_achievement" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/company_achievement.php';
    } elseif ($demand === "section_list_report" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/section_list_report.php';
    } elseif ($demand === "shop_list_report" && $authHeader === '4081Kokubu') {
        require_once __DIR__ . '/actions/shop_list_report.php';
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
