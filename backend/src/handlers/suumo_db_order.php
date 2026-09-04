<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../core/bulk_upsert.php';
require_once __DIR__ . '/portal/suumo_order.php';

// suumo_db の書き込み対象カラム（duplicate_suumo / result は運用側で更新するため触らない）
$allowedColumns = [
    'id_suumo',
    'date_suumo',
    'sei_suumo',
    'mei_suumo',
    'sei_kana_suumo',
    'mei_kana_suumo',
    'age_suumo',
    'zip_suumo',
    'address1_suumo',
    'address2_suumo',
    'address3_suumo',
    'mail_suumo',
    'phone_suumo',
    'period_suumo',
    'place_suumo',
    'budget_suumo',
    'shop_suumo',
];

$rows = portalReadBulkPayload('suumo_db_order');

$summary = portalRunBulkImport(
    $pdo,
    $rows,
    'suumo_db',
    $allowedColumns,
    'id_suumo',
    'portalSuumoToInquiry'
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
