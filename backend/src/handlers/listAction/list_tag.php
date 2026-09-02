<?php
// 反響一覧の顧客タグ（重複 / ギフト券進呈済み / 業者 / ブラックリスト）の ON・OFF。
//
// ⚠️ 以前は black_list カラムに CONCAT で追記し、出現回数の偶奇で
//   ON/OFF を判定していた。以下の問題があったためフラグカラムに移行した。
//     ・OFFにしても文字列が伸び続ける（削除されない）
//     ・連打や二重送信で偶奇が反転し、表示と実体がずれる
//     ・SQLから「業者を除く」といった絞り込みができない
//
//   移行SQL: backend/scripts/sql/2026-09-02_inquiry_tag_flags.sql
//
// ⚠️ black_list カラムには書き込まない。旧データは移行済みで、
//   カラムは切り戻し用に残してあるだけ。

$tableMap = [
    'order' => 'inquiry_customer',
    'spec'  => 'inquiry_customer_kaeru',
    'used'  => 'inquiry_customer_resale',
];

// フロントから届くタグ名と、実際のカラム名の対応。
// ⚠️ リクエストの値をそのままSQLに埋めないための許可リスト。
//   カラム名はプレースホルダにできないため、必ずこの表を経由する。
$columnMap = [
    'duplicate' => 'duplicate_flag',
    'gift'      => 'gift_flag',
    'support'   => 'support_flag',
    'black'     => 'black_flag',
];

$category   = $data['category'] ?? '';
$tag        = $data['list'] ?? '';
$inquiry_id = $data['inquiry_id'] ?? '';

// 0 / 1 を明示的に受け取る。
// ⚠️ 旧仕様は「押すたびに反転」だったため、同じリクエストを2回送ると
//   状態が変わってしまった。値を明示する形にして冪等にしている。
$value = isset($data['value']) && (int) $data['value'] === 1 ? 1 : 0;

if (!isset($tableMap[$category])) {
    echo json_encode([
        'status'  => 'error',
        'message' => '対象が不正です。',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!isset($columnMap[$tag])) {
    echo json_encode([
        'status'  => 'error',
        'message' => '許可されていないタグです: ' . $tag,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($inquiry_id === '') {
    echo json_encode([
        'status'  => 'error',
        'message' => '対象の反響が指定されていません。',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$tableName = $tableMap[$category];
$column    = $columnMap[$tag];

try {
    $sqlUpdate = "UPDATE `{$tableName}` SET `{$column}` = ? WHERE `inquiry_id` = ?";
    $stmtUpdate = $pdo->prepare($sqlUpdate);
    $stmtUpdate->execute([$value, $inquiry_id]);

    if ($stmtUpdate->rowCount() === 0) {
        // 該当行が無い場合と、既に同じ値だった場合の両方でここに来る。
        // 前者だけを区別するために存在確認する。
        $stmtExists = $pdo->prepare("SELECT 1 FROM `{$tableName}` WHERE `inquiry_id` = ? LIMIT 1");
        $stmtExists->execute([$inquiry_id]);

        if ($stmtExists->fetchColumn() === false) {
            echo json_encode([
                'status'  => 'error',
                'message' => "{$inquiry_id} が見つかりません。",
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }
    }

    echo json_encode([
        'status'  => 'success',
        'message' => "{$inquiry_id} のタグを更新しました。",
        'tag'     => $tag,
        'value'   => $value,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    error_log('list_tag: ' . $e->getMessage());
    echo json_encode([
        'status'  => 'error',
        'message' => 'タグの更新に失敗しました。',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
