<?php

declare(strict_types=1);

/**
 * SUUMO（注文事業）の 1 レコードを inquiry_customer 用の連想配列へ変換する。
 * 移植元 api/suumo.php の INSERT 句と同じマッピング。
 */
function portalSuumoToInquiry(array $row): ?array
{
    $id = trim((string)($row['id_suumo'] ?? ''));
    if ($id === '') {
        return null;
    }

    // 住所は address1 と address3 のみを連結する（address2 は移植元でも未使用）
    $building = (string)($row['address1_suumo'] ?? '') . (string)($row['address3_suumo'] ?? '');

    return [
        'inquiry_id'       => 'suumo' . $id,
        'inquiry_date'     => (string)($row['date_suumo'] ?? ''),
        'medium'           => 'SUUMO',
        'response_medium'  => 'SUUMO',
        'first_name'       => (string)($row['sei_suumo'] ?? ''),
        'last_name'        => (string)($row['mei_suumo'] ?? ''),
        'first_name_kana'  => (string)($row['sei_kana_suumo'] ?? ''),
        'last_name_kana'   => (string)($row['mei_kana_suumo'] ?? ''),
        'mobile'           => (string)($row['phone_suumo'] ?? ''),
        'mail'             => (string)($row['mail_suumo'] ?? ''),
        'building'         => $building,
        'brand'            => (string)($row['shop_suumo'] ?? ''),
        'shop'             => (string)($row['shop'] ?? ''),
        'area'             => (string)($row['place_suumo'] ?? ''),
    ];
}
