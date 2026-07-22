<?php

// 会員登録(中古住宅専門店)の同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            inquiry_date,
            category,
            first_name,
            first_name_kana,
            medium,
            response_medium,
            mobile,
            landline,
            mail,
            building,
            brand,
            note,
            hp_campaign
            )
        SELECT 
            CONCAT('hp_member_', id),
            DATE_FORMAT(registered_at, '%Y/%m/%d'),
            '買い:中古リノベ',
            `name`,
            name_kana,
            'ホームページ反響',
            source,
            mobile,
            tel,
            email,
            `address`,
            '中古住宅専門店',
            remarks,
            '会員登録'
        FROM 
            member_resale";
$stmt = $pdo->prepare($sql);
$stmt->execute();
