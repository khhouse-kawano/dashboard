<?php

// 会員登録(かえるホーム)の同期
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
            area,
            brand,
            hp_campaign,
            note
            )
        SELECT 
            CONCAT('hp_pre_', id),
            DATE_FORMAT(registered_at, '%Y/%m/%d'),
            `name`,
            name_kana,
            'ホームページ反響',
            'Web検索',
            tel,
            email,
            zip,
            `address`,
            pre_properties,
            'かえる',
            '先取物件',
            remarks
        FROM 
            pre_kaeru";
$stmt = $pdo->prepare($sql);
$stmt->execute();
