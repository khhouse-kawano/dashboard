<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../core/bulk_upsert.php';
require_once __DIR__ . '/portal/townlife_order.php';

// townlife_db の書き込み対象カラム（duplicate は後段の重複チェックで更新する）
$allowedColumns = [
    'id_townlife',
    'name_townlife',
    'kana_townlife',
    'age_townlife',
    'zip_townlife',
    'pref_townlife',
    'city_townlife',
    'address_townlife',
    'mail_townlife',
    'phone_townlife',
    'place_townlife',
    'place_detail_townlife',
    'floor_townlife',
    'adult_townlife',
    'child_townlife',
    'ldk_townlife',
    'budget_townlife',
    'large_townlife',
    'budget_estate_townlife',
    'demand_estate_townlife',
    'image_townlife',
    'demand_house_townlife',
    'note_townlife',
    'response_date_townlife',
    'shop_townlife',
    'status_townlife',
];

$rows = portalReadBulkPayload('townlife_db_order');

$summary = portalRunBulkImport(
    $pdo,
    $rows,
    'townlife_db',
    $allowedColumns,
    ['id_townlife'],
    'portalTownlifeToInquiry'
);

// 他媒体からの反響と重複していれば townlife_db.duplicate に記録する
$summary['errors'] = array_merge($summary['errors'], portalTownlifeMarkDuplicates($pdo, $rows));

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok'               => empty($summary['errors']),
    'inserted'         => $summary['processed'],
    'inquiry_inserted' => $summary['inquiry_inserted'],
    'errors'           => $summary['errors'],
], JSON_UNESCAPED_UNICODE);
