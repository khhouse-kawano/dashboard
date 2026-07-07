<?php
// 1. 各パラメータの抽出（mail, period に加えて position を追加）
$khg_id   = $data['khg_id'] ?? '';
$name     = $data['name'] ?? '';
$position = $data['position'] ?? '一般'; // ✨ 追加：フロントから届く役職データ
$mail     = $data['mail'] ?? '';
$status   = $data['status'] ?? '在籍';
$section  = $data['section'] ?? '';
$shop     = $data['shop'] ?? '';
$category = $data['category'] ?? '0';
$rank     = $data['rank'] ?? '0';
$report   = $data['report'] ?? '0';
$multi    = $data['multi'] ?? '0';
$estate   = $data['estate'] ?? '0';
$period   = $data['period'] ?? ''; 

if (trim($name) === '') {
    echo json_encode([
        "status" => "error", 
        "message" => "氏名を入力してください。"
    ]);
    exit;
}

try {
    // 2. SQL文に position カラムとプレースホルダーを追加
    $sql = "
        INSERT INTO `staff_list` (
            `khg_id`, `name`, `position`, `mail`, `status`, `section`, `shop`, 
            `category`, `rank`, `report`, `multi`, `estate`, `period`
        ) VALUES (
            :khg_id, :name, :position, :mail, :status, :section, :shop, 
            :category, :rank, :report, :multi, :estate, :period
        )
    ";

    $stmt = $pdo->prepare($sql);
    
    // 3. 実行配列に :position のバインドを追加
    $stmt->execute([
        ':khg_id'   => $khg_id,
        ':name'     => $name,
        ':position' => $position, // ✨ 追加
        ':mail'     => $mail,
        ':status'   => $status,
        ':section'  => $section,
        ':shop'     => $shop,
        ':category' => $category,
        ':rank'     => $rank,
        ':report'   => $report,
        ':multi'    => $multi,
        ':estate'   => $estate,
        ':period'   => $period 
    ]);

    // マスター用のベーステーブル
    $sql_base = "INSERT INTO staff (name, brand, mail) VALUES(:name, :brand, :mail)";
    $stmt_base = $pdo->prepare($sql_base);
    $stmt_base->execute([
        ':name'  => $name,
        ':brand' => 'ordinary',
        ':mail'  => $mail,
        // ※ 共通マスタ側（staffテーブル）にも必要であればカラム拡張をして追加してください
    ]);

    echo json_encode([
        "status" => "success",
        "message" => "スタッフを新規登録しました。",
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