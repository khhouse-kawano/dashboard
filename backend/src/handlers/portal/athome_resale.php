<?php

// SUUMOの同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            inquiry_date,
            first_name,
            medium,
            response_medium,
            mobile,
            mail,
            zip,
            building,
            property,
            area,
            brand,
            category,
            shop,
            note
            )
        SELECT 
            CONCAT('athome_', id),
            DATE_FORMAT(registered_at, '%Y/%m/%d'),
            `name`,
            'athome',
            'athome',
            tel,
            email,
            zip,
            `address`,
            building_name,
            property_address,
            '中古住宅専門店',
            '買い:ポータル',
            '買い:ポータル',
            remarks
        FROM 
            athome_db_resale";
$stmt = $pdo->prepare($sql);
$stmt->execute();
