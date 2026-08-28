<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../core/bulk_upsert.php';
require_once __DIR__ . '/portal/homes_order.php';

// homes_db の書き込み対象カラム
$allowedColumns = [
    'id_homes',
    'name_homes',
    'kana_homes',
    'zip_homes',
    'address_homes',
    'mail_homes',
    'phone_homes',
    'period_homes',
    'estate_homes',
    'status_homes',
    'budget_detail_homes',
    'income_homes',
    'age_homes',
    'place_homes',
    'shop_homes',
    'date_homes',
];

$rows = portalReadBulkPayload('homes_db_order');

$summary = portalRunBulkImport(
    $pdo,
    $rows,
    'homes_db',
    $allowedColumns,
    ['id_homes'],
    'portalHomesToInquiry'
);

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok'               => empty($summary['errors']),
    'inserted'         => $summary['processed'],
    'inquiry_inserted' => $summary['inquiry_inserted'],
    'errors'           => $summary['errors'],
], JSON_UNESCAPED_UNICODE);
