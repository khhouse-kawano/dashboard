<?php

// リード情報
// LeadOpportunity は 'ledger'、LeadResale は 'resales' を参照する。
// 各コンポーネント側で kind により絞り込むため、まとめて返して問題ない。
$sql_lead = "SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads', 'ledger', 'resales');";
$stmt_lead = $pdo->prepare($sql_lead);
$stmt_lead->execute();
$response_lead = $stmt_lead->fetchAll(PDO::FETCH_ASSOC);


// スタッフ情報
$sql_staff = "SELECT * FROM staff_list WHERE shop = '不動産企画係';";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

// ⚠️ v2.2.225: 売り反響・買い反響の画面の歩留まり（担当者・反響単価・期首月）のため設定も返す（② の features/realty と同じ）
$stmt_state = $pdo->prepare("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1");
$stmt_state->execute();
$raw_state = $stmt_state->fetchColumn();
$response_settings = $raw_state ? json_decode($raw_state, true) : null;
if (!is_array($response_settings) || $response_settings === []) {
    // ⚠️ 空の配列で返すと json_encode が [] にする。画面は Object として読むので {} にする
    $response_settings = new stdClass();
}

$result = [
    "lead" => $response_lead,
    "staff" => $response_staff,
    "settings" => $response_settings
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
