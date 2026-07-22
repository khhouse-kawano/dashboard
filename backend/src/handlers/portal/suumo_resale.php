<?php

// SUUMOの同期
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
            zip,
            pref,
            city,
            street,
            property,
            area,
            brand,
            `url`,
            note
            )
        SELECT 
            CONCAT('suumo_', sequence_no),
            '買い:ポータル',
            SUBSTRING_INDEX(received_at, ' ', 1),
            last_name_kanji,
            last_name_kana,
            'SUUMO',
            'SUUMO',
            CONCAT(phone_1, phone_2, phone_3),
            email,
            CONCAT(zip_code_1, zip_code_2),
            address_1,
            address_2,
            address_3,
            property_name_1,
            property_location,
            '中古住宅専門店',
            free_1,
            remarks
        FROM 
            suumo_db_resale";
$stmt = $pdo->prepare($sql);
$stmt->execute();
