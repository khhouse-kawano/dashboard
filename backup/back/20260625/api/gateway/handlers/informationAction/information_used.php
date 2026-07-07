<?php

// 1. 未定義エラー（Notice）を防ぐため、最初に変数で受け取る
$id = $data['id'] ?? '';

// ==========================================
// マスターデータの取得（全員共通）
// ==========================================
// 担当営業
$sql_staff = "SELECT name, shop, category, section, period
        FROM staff_list WHERE category = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


// 販促媒体
$sql_medium = "SELECT * FROM medium_resale;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);


// 物件リスト
$sql_property = "SELECT * FROM property_list_kaeru";
$stmt_property = $pdo->prepare($sql_property);
$stmt_property->execute();
$response_property = $stmt_property->fetchAll(PDO::FETCH_ASSOC);

// ハウスメーカーリスト
$sql_maker = "SELECT * FROM house_maker";
$stmt_maker = $pdo->prepare($sql_maker);
$stmt_maker->execute();
$response_maker = $stmt_maker->fetchAll(PDO::FETCH_ASSOC);

// 紹介
$sql_introductory = "SELECT * FROM introductory";
$stmt_introductory = $pdo->prepare($sql_introductory);
$stmt_introductory->execute();
$response_introductory = $stmt_introductory->fetchAll(PDO::FETCH_ASSOC);

// ==========================================
// 個別データの取得（初期値は空のオブジェクト）
// ==========================================
// 2. 返り値の初期値をセットしておく
$response_customer = new stdClass();
$response_call = new stdClass();
$response_interview = new stdClass();
$response_pdf = new stdClass(); // これが抜けていました

if ($id !== '' && $id !== 'new') {
    // 顧客情報
    $sql_customer = "SELECT * FROM master_data_resale WHERE id = ?";
    $stmt_customer = $pdo->prepare($sql_customer);
    $stmt_customer->execute([$id]);
    // 3. fetchが空振りした（false）場合は初期値にする
    $response_customer = $stmt_customer->fetch(PDO::FETCH_ASSOC) ?: new stdClass();

    // 架電状況
    $sql_call = "SELECT * FROM call_sheet WHERE id = ?";
    $stmt_call = $pdo->prepare($sql_call);
    $stmt_call->execute([$id]);
    $response_call = $stmt_call->fetch(PDO::FETCH_ASSOC) ?: new stdClass();

    // 面談記録
    $sql_interview = "SELECT * FROM interview_sheet WHERE id = ?";
    $stmt_interview = $pdo->prepare($sql_interview);
    $stmt_interview->execute([$id]);
    $response_interview = $stmt_interview->fetch(PDO::FETCH_ASSOC) ?: new stdClass();

    // 競合資料
    $sql_pdf = "SELECT * FROM competitor_pdf WHERE id = ?";
    $stmt_pdf = $pdo->prepare($sql_pdf);
    // 【修正2】$data['id'] ではなく $id に統一
    $stmt_pdf->execute([$id]);
    $response_pdf = $stmt_pdf->fetch(PDO::FETCH_ASSOC) ?: new stdClass();
}

// ==========================================
// JSON出力
// ==========================================
$result = [
    "staff" => $response_staff,
    "medium" => $response_medium,
    "property" => $response_property,
    "customer" => $response_customer,
    "call" => $response_call,
    "interview" => $response_interview,
    "maker" => $response_maker,
    "introductory" => $response_introductory,
    "pdf" => $response_pdf
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
