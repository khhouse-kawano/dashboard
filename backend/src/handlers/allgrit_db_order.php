<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../core/bulk_upsert.php';
require_once __DIR__ . '/portal/allgrit_order.php';

// allGrit_db の書き込み対象カラム
// （kana_allGrit / reservation など CSV 由来の項目はテーブルに存在しないため保存されない）
$allowedColumns = [
    'id_allGrit',
    'date_allGrit',
    'status_allGrit',
    'sei_allGrit',
    'mei_allGrit',
    'mail_allGrit',
    'phone_allGrit',
    'zip_allGrit',
    'address1_allGrit',
    'budget_allGrit',
    'pref_allGrit',
    'city_allGrit',
    'city_allGrit2',
    'city_allGrit3',
    'shop_allGrit',
];

$rows = portalReadBulkPayload('allgrit_db_order');

// allGrit_db 側の id_allGrit にもブランド接尾辞を付けた ID を保存する
foreach ($rows as $i => $row) {
    if (is_array($row)) {
        $rows[$i]['id_allGrit'] = portalAllgritId($row);
    }
}

$summary = portalRunBulkImport(
    $pdo,
    $rows,
    'allGrit_db',
    $allowedColumns,
    'id_allGrit',
    'portalAllgritToInquiry'
);

header('Content-Type: application/json; charset=utf-8');
// skipped は「既に取り込み済みだったため何もしなかった件数」。
// ⚠️ エラーではない。毎回ポータルの全件が送られてくるため、
//   平常時は skipped のほうが大きくなるのが正常な状態である。
echo json_encode([
    'ok'               => empty($summary['errors']),
    'inserted'         => $summary['processed'],
    'skipped'          => $summary['skipped'],
    'inquiry_inserted' => $summary['inquiry_inserted'],
    'inquiry_skipped'  => $summary['inquiry_skipped'],
    'errors'           => $summary['errors'],
], JSON_UNESCAPED_UNICODE);
