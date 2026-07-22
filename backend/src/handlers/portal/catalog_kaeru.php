<?php

// 資料請求(かえるホーム)の同期
$sql = "INSERT IGNORE INTO inquiry_customer_kaeru
            (inquiry_id,
            inquiry_date,
            first_name,
            first_name_kana,
            medium,
            response_medium,
            mobile,
            mail,
            zip,
            building,
            reserved_date,
            reserved_time,
            brand,
            hp_campaign,
            note,
            property
            )
        SELECT 
            CONCAT('hp_catalog_kaeru_', no),
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            nameKana,
            'ホームページ反響',
            source,
            tel,                                       -- 電話番号をmobileにマッピング
            email,
            zip,
            `address`,
            `date`,                                    -- ご希望日（空欄ならNULLになります）
            `time`,                                    -- ご希望時間（空欄ならNULLになります）
            'かえる',
            '資料請求',                                -- 資料請求用のキャンペーン名
            remarks,                                    -- 全詳細テキスト
            property
        FROM 
            catalog_kaeru
        WHERE
            `name` IS NOT NULL AND `name` != ''";

$stmt = $pdo->prepare($sql);
$stmt->execute();