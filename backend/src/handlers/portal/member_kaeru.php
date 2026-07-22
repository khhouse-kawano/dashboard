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
            landline,
            mail,
            zip,
            building,
            area,
            area_2,
            area_3,
            school_area,
            other_condition,
            brand,
            hp_campaign,
            note
            )
        SELECT 
            CONCAT('hp_member_', id),
            DATE_FORMAT(registered_at, '%Y/%m/%d'),
            `name`,
            name_kana,
            'ホームページ反響',
            source,
            mobile,
            tel,
            email,
            zip,
            `address`,
            desired_area_1,
            desired_area_2,
            desired_area_3,
            area_notes,
            other_conditions,
            'かえる',
            '会員登録',
            remarks
        FROM 
            member_kaeru";
$stmt = $pdo->prepare($sql);
$stmt->execute();
