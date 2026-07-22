<?php

// SUUMOの同期
$sql = "INSERT IGNORE INTO inquiry_customer_kaeru
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
            'かえる',
            remarks
        FROM 
            athome_db_kaeru";
$stmt = $pdo->prepare($sql);
$stmt->execute();
