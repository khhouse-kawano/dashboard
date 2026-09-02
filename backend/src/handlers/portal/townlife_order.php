<?php

declare(strict_types=1);

/**
 * タウンライフ（注文事業）の 1 レコードを inquiry_customer 用の連想配列へ変換する。
 * 移植元 api/townlife.php をベースにしつつ、住所は pref/city/street に分解せず
 * building へ連結する方針に変更している。
 */
function portalTownlifeToInquiry(array $row): ?array
{
    $id = trim((string)($row['id_townlife'] ?? ''));
    if ($id === '') {
        return null;
    }

    // 氏名・カナは全角スペース区切り
    [$firstName, $lastName] = portalSplitName($row['name_townlife'] ?? '', '　');
    [$firstKana, $lastKana] = portalSplitName($row['kana_townlife'] ?? '', '　');

    $building = (string)($row['pref_townlife'] ?? '')
        . (string)($row['city_townlife'] ?? '')
        . (string)($row['address_townlife'] ?? '');

    return [
        'inquiry_id'       => 'townlife' . $id,
        'inquiry_date'     => (string)($row['response_date_townlife'] ?? ''),
        'medium'           => 'タウンライフ',
        'response_medium'  => 'タウンライフ',
        'first_name'       => $firstName,
        'last_name'        => $lastName,
        'first_name_kana'  => $firstKana,
        'last_name_kana'   => $lastKana,
        'mobile'           => (string)($row['phone_townlife'] ?? ''),
        'mail'             => (string)($row['mail_townlife'] ?? ''),
        'zip'              => (string)($row['zip_townlife'] ?? ''),
        'building'         => $building,
        'brand'            => (string)($row['shop_townlife'] ?? ''),
        'shop'             => (string)($row['shop'] ?? ''),
        'area'             => (string)($row['place_detail_townlife'] ?? ''),
    ];
}

/**
 * 同じメールアドレス・同じブランドで、タウンライフ以外の媒体からの反響が既にある場合、
 * townlife_db.duplicate にその旨を記録する。
 *
 * 移植元は WHERE 句に存在しないカラム `mail` を使っており常に SQL エラーになっていたため、
 * 正しいカラム名 `mail_townlife` に修正している。
 */
function portalTownlifeMarkDuplicates(PDO $pdo, array $rows): array
{
    $errors = [];

    $selectSql = "SELECT inquiry_date, response_medium
                  FROM inquiry_customer
                  WHERE mail = ? AND brand = ? AND response_medium <> 'タウンライフ'
                  LIMIT 1";
    $updateSql = "UPDATE townlife_db SET duplicate = ?
                  WHERE mail_townlife = ? AND shop_townlife = ?";

    try {
        $select = $pdo->prepare($selectSql);
        $update = $pdo->prepare($updateSql);

        foreach ($rows as $row) {
            $mail  = trim((string)($row['mail_townlife'] ?? ''));
            $brand = trim((string)($row['brand'] ?? $row['shop_townlife'] ?? ''));
            if ($mail === '' || $brand === '') {
                continue;
            }

            $select->execute([$mail, $brand]);
            $found = $select->fetch(PDO::FETCH_ASSOC);
            if (!$found) {
                continue;
            }

            $note = $found['inquiry_date'] . ' ' . $brand . ' ' . $found['response_medium'] . 'からの反響重複';
            $update->execute([$note, $mail, $brand]);
        }
    } catch (Throwable $e) {
        $errors[] = '重複情報の記録に失敗: ' . $e->getMessage();
    }

    return $errors;
}
