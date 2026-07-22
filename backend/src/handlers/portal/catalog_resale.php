<?php

// 資料請求(リセール)の同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            inquiry_date,
            first_name,
            first_name_kana,
            medium,
            mobile,
            mail,
            zip,
            building,
            brand,
            hp_campaign,
            note
            )
        SELECT 
            CONCAT('hp_catalog_', no),
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            nameKana,
            'ホームページ反響',
            tel,                                       -- 電話番号をmobileにマッピング
            email,                                     -- メールアドレス
            zip,
            `address`,
            '中古住宅専門店',
            '資料請求',                                -- 資料請求用の識別キャンペーン名
            remarks                                    -- 不動産URL情報等を含む全詳細テキスト
        FROM 
            catalog_resale
        WHERE
            `name` IS NOT NULL AND `name` != ''";

$stmt = $pdo->prepare($sql);
$stmt->execute();