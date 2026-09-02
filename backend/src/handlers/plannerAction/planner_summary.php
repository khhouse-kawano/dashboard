<?php

// リード情報
$sql_lead = "SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads');";
$stmt_lead = $pdo->prepare($sql_lead);
$stmt_lead->execute();
$response_lead = $stmt_lead->fetchAll(PDO::FETCH_ASSOC);


// スタッフ情報
$sql_staff = "SELECT * FROM staff_list WHERE shop = '不動産企画係';";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

// アプリ全体設定
//   KPIサマリーの分母に使う。
//     srcCosts    … 売り反響元ごとの反響単価（円/件）→ 反響費用・媒介獲得単価
//     portalCosts … 買いポータルごとの反響単価（円/件）→ 反響費用・申込単価
//     staff[].baikaiTarget … 年間の媒介受託目標。12で割って月次目標にする
$sql_state = "SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1";
$stmt_state = $pdo->prepare($sql_state);
$stmt_state->execute();
$raw_state = $stmt_state->fetchColumn();

// 設定が未登録でも画面が壊れないよう、必ずオブジェクトを返す
$response_settings = $raw_state ? json_decode($raw_state, true) : null;
if (!is_array($response_settings)) {
    $response_settings = [];
}

$result = [
    "lead" => $response_lead,
    "staff" => $response_staff,
    "settings" => $response_settings
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
