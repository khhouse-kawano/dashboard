<?php

declare(strict_types=1);

/**
 * ALLGRIT（注文事業）の id_allGrit を組み立てる。
 *
 * 移植元 api/allGrit.php では、同一の LINE UID が KH / DJH の両アカウントに現れて
 * 衝突するのを避けるため、DJH のときだけ末尾に "DJH" を連結している。
 */
function portalAllgritId(array $row): string
{
    $id = trim((string)($row['id_allGrit'] ?? ''));
    if ($id === '') {
        return '';
    }
    $shop = (string)($row['shop_allGrit'] ?? '');
    $suffix = (strpos($shop, 'DJH') === false) ? '' : 'DJH';
    if ($suffix === '') {
        return $id;
    }
    // ハンドラ側で付与済みの ID を再度渡されても二重に連結しない
    return str_ends_with($id, $suffix) ? $id : $id . $suffix;
}

/**
 * ALLGRIT の 1 レコードを inquiry_customer 用の連想配列へ変換する。
 */
function portalAllgritToInquiry(array $row): ?array
{
    $id = portalAllgritId($row);
    if ($id === '') {
        return null;
    }

    return [
        'inquiry_id'       => 'allgrit' . $id,
        'inquiry_date'     => (string)($row['date_allGrit'] ?? ''),
        'medium'           => 'ALLGRIT',
        'response_medium'  => 'ALLGRIT',
        'first_name'       => (string)($row['sei_allGrit'] ?? ''),
        'last_name'        => (string)($row['mei_allGrit'] ?? ''),
        'mobile'           => (string)($row['phone_allGrit'] ?? ''),
        'mail'             => (string)($row['mail_allGrit'] ?? ''),
        'zip'              => (string)($row['zip_allGrit'] ?? ''),
        'building'         => (string)($row['address1_allGrit'] ?? ''),
        'brand'            => (string)($row['shop_allGrit'] ?? ''),
        'shop'             => (string)($row['shop'] ?? ''),
        'area'             => (string)($row['pref_allGrit'] ?? '') . (string)($row['city_allGrit'] ?? ''),
    ];
}
