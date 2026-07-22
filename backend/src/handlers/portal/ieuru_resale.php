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
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            nameKana,
            'イエウール',
            'イエウール',
            mobile,
            email,
            `address`,
            propertyType,
            propertyAddress,
            '中古住宅専門店',
            remarks
        FROM 
            ieuru_resale";

$stmt = $pdo->prepare($sql);
$stmt->execute();