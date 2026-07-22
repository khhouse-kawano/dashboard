<?php
// 1. 各パラメータの抽出と初期値セット（Reactの初期値と完全に同期）
$brand       = $data['brand'] ?? '';
$shop        = $data['shop'] ?? '';
$division    = $data['division'] ?? '';
$section     = $data['section'] ?? '';
$area        = $data['area'] ?? '';
$show_flag   = $data['show_flag'] ?? '1';   // 初期値: 表示
$report_flag = $data['report_flag'] ?? '0'; // 初期値: 非対象
$multi       = $data['multi'] ?? '0';       // 初期値: 非対象

// 2. バリデーション（店舗名の空チェック）
if (trim($shop) === '') {
    echo json_encode([
        "status" => "error", 
        "message" => "店舗名を入力してください。"
    ]);
    exit;
}

// 3. データベースへのインサート処理
try {
    // テーブル名は環境に合わせて必要なら変更してください（例: `shop_list`）
    $sql = "
        INSERT INTO `shop_list` (
            `brand`, `shop`, `division`, `section`, `area`, 
            `show_flag`, `report_flag`, `multi`
        ) VALUES (
            :brand, :shop, :division, :section, :area, 
            :show_flag, :report_flag, :multi
        )
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':brand'       => $brand,
        ':shop'        => $shop,
        ':division'    => $division,
        ':section'     => $section,
        ':area'        => $area,
        ':show_flag'   => $show_flag,   // フロントから届く "0" または "1"
        ':report_flag' => $report_flag, // フロントから届く "0" または "1"
        ':multi'       => $multi        // フロントから届く "0" または "1"
    ]);

    // AUTO_INCREMENTで採番された最新の店舗IDを取得
    $newId = $pdo->lastInsertId();

    // 4. フロント（React）側へ成功レスポンスと新規IDを返却
    echo json_encode([
        "status" => "success",
        "message" => "店舗を新規登録しました。",
        "id" => $newId // これがReact側の「[createdRecord, ...prev]」に綺麗に繋がります
    ]);
    exit;

} catch (PDOException $e) {
    echo json_encode([
        "status" => "error",
        "message" => "データベースの登録処理に失敗しました。",
        "debug" => $e->getMessage()
    ]);
    exit;
}