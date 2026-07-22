<?php

// イエイの同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            category,
            inquiry_date,
            first_name,
            first_name_kana,
            medium,
            response_medium,
            mobile,
            landline,
            mail,
            building,
            property,
            area,
            brand,
            note
            ) 
        SELECT 
            CONCAT('iei_', id),
            '売り:ポータル',
            DATE_FORMAT(registered_at, '%Y/%m/%d'),
            `name`,
            name_kana,
            'イエイ',
            'イエイ',
            tel1,
            tel2,
            email,
            `address`,
            property_type,
            property_address,
            '中古住宅専門店',
            remarks
        FROM 
            iei_db";

$stmt = $pdo->prepare($sql);
$stmt->execute();