<?php


// ⚠️ v2.2.274: 期間（$listMonths。list.php が作る）で絞る。null なら全件（今までどおり）
$listMonths = $listMonths ?? null;

//来場の状況（⚠️ 画面は初回面談日の月で数える）
[$summaryCond, $summaryParams] = listMonthCondition('step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', $listMonths);
$sql_summary = "SELECT 
COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
COALESCE(in_charge_store, '') as shop,
COALESCE(sales_promotion_name, '') as medium
FROM master_data WHERE show_dashboard = 1 AND step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 <> '' AND step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 IS NOT NULL
AND {$summaryCond}";
$stmt_summary = $pdo->prepare($sql_summary);
$stmt_summary->execute($summaryParams);
$response_summary = $stmt_summary->fetchAll(PDO::FETCH_ASSOC);

// 店舗
$sql_shop = "SELECT shop, section, area
        FROM shop_list WHERE show_flag = 1 AND division = '注文事業'";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


// スタッフ
$sql_staff = "SELECT name, pg_id, shop, category, period, section, position FROM staff_list";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT medium, list_medium
        FROM medium_list WHERE response_medium = 0;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 反響一覧（⚠️ 反響日の月で絞る）
[$inquiryCond, $inquiryParams] = listMonthCondition('inquiry_date', $listMonths);
$sql_inquiry = "SELECT id, inquiry_id, pg_id, mhl_id, mhl_url, mhl_mail, inquiry_date, medium, response_medium, first_name, last_name,
        first_name_kana, last_name_kana, mobile, landline, mail, line_id, zip, pref, city, town, street, building, brand, shop, sync, staff, area, 
        reserved_date, hp_campaign, duplicate, hotlead_url, url_params, landing_params,
        duplicate_flag, gift_flag, support_flag, black_flag
        FROM inquiry_customer WHERE first_name <> '' AND {$inquiryCond} ORDER By inquiry_date DESC";
$stmt_inquiry = $pdo->prepare($sql_inquiry);
$stmt_inquiry->execute($inquiryParams);
$response_inquiry = $stmt_inquiry->fetchAll(PDO::FETCH_ASSOC);


// 事前アンケート（⚠️ 回答日の月で絞る）
[$surveyCond, $surveyParams] = listMonthCondition('dateStr', $listMonths);
$sql_survey = "SELECT * FROM before_survey WHERE {$surveyCond} ORDER BY dateStr DESC";
$stmt_survey = $pdo->prepare($sql_survey);
$stmt_survey->execute($surveyParams);
$response_survey = $stmt_survey->fetchAll(PDO::FETCH_ASSOC);


// ブラックリスト
$sql_black = "SELECT mail, mobile FROM black_list WHERE show_key = 1";
$stmt_black = $pdo->prepare($sql_black);
$stmt_black->execute();
$response_black = $stmt_black->fetchAll(PDO::FETCH_ASSOC);


// 課リスト
$sql_section = "SELECT * FROM section_list WHERE division = '注文事業'";
$stmt_section = $pdo->prepare($sql_section);
$stmt_section->execute();
$response_section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "summary" => $response_summary,
    "shop" => $response_shop,
    "staff" => $response_staff,
    "medium" => $response_medium,
    "inquiry" => $response_inquiry,
    "survey" => $response_survey,
    "black" => $response_black,
    "section" => $response_section
];

/**
 * ⚠️ v2.2.274: 重複判定用の全反響（期間に関係なく。画面が氏名・携帯・メールで突き合わせ、相手の店舗・媒体を出す）。
 * ⚠️ dup=1 のときだけ返す（画面の初回と再読み込み）。⚠️ 並びは反響一覧と同じ（重複相手の並びを変えない）。
 */
if (!empty($listWithDup)) {
    $sql_dup = "SELECT inquiry_id, first_name, last_name, mobile, mail, shop, response_medium
        FROM inquiry_customer WHERE first_name <> '' ORDER By inquiry_date DESC";
    $stmt_dup = $pdo->prepare($sql_dup);
    $stmt_dup->execute();
    $result["dup"] = $stmt_dup->fetchAll(PDO::FETCH_ASSOC);
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
