<?php

// HOME'Sの同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            category,
            inquiry_date,
            first_name,
            medium,
            response_medium,
            mobile,
            mail,
            property,
            area,
            brand,
            `url`,
            remarks,
            note
            )
        SELECT 
            CONCAT('homes_', userId),
            '買い:ポータル',
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            'HOME''S',
            'HOME''S',
            mobile,
            mail,
            propertyName,
            area,
            '中古住宅専門店',
            propertyUrl,
            note,
            remarks
        FROM 
            homes_db_resale";
$stmt = $pdo->prepare($sql);
$stmt->execute();
