<?php

// SUUMOの同期
$sql = "INSERT IGNORE INTO inquiry_customer_kaeru
            (inquiry_id,
            inquiry_date,
            first_name,
            first_name_kana,
            medium,
            response_medium,
            mobile,
            mail,
            property,
            area,
            reserved_date,
            reserved_time,
            building,
            brand,
            note
            )
        SELECT 
            CONCAT('suumo_', customer_id),
            first_reaction_date,
            `name`,
            name_kana,
            'SUUMO',
            'SUUMO',
            phone,
            email,
            first_reaction_property_name,
            first_reaction_property_address,
            SUBSTRING_INDEX(first_visit_datetime, ' ', 1),
            SUBSTRING_INDEX(first_visit_datetime, ' ', -1),
            `address`,
            'かえる',
            remarks
        FROM 
            suumo_db_kaeru";
$stmt = $pdo->prepare($sql);
$stmt->execute();
