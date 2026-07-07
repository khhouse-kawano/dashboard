<?php

// 1. 未定義エラー（Notice）を防ぐため、最初に変数で受け取る
$id = $data['id'] ?? '';

// ==========================================
// マスターデータの取得（全員共通）
// ==========================================
// 店舗
$sql_shop = "SELECT brand, shop, division, section, multi, report_flag FROM shop_list";
$stmt_shop = $pdo->prepare($sql_shop);
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

// 担当営業
$sql_staff = "SELECT name, shop, category, section, period FROM staff_list WHERE category = 1;";
$stmt_staff = $pdo->prepare($sql_staff);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

// 販促媒体
$sql_medium = "SELECT medium, list_medium FROM medium_list WHERE response_medium = 0;";
$stmt_medium = $pdo->prepare($sql_medium);
$stmt_medium->execute();
$response_medium = $stmt_medium->fetchAll(PDO::FETCH_ASSOC);

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
// 【修正1】返り値の初期値に $response_pdf を追加！
$response_customer = new stdClass();
$response_call = new stdClass();
$response_interview = new stdClass();
$response_pdf = new stdClass(); // これが抜けていました

if ($id !== '' && $id !== 'new') {
    // 顧客情報
    $sql_customer = "SELECT * FROM master_data WHERE id = ?";
    $stmt_customer = $pdo->prepare($sql_customer);
    $stmt_customer->execute([$id]);
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
        "shop" => $response_shop,
        "medium" => $response_medium,
        "customer" => $response_customer,
        "call" => $response_call,
        "interview" => $response_interview,
        "maker" => $response_maker,
        "introductory" => $response_introductory,
        "pdf" => $response_pdf
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);