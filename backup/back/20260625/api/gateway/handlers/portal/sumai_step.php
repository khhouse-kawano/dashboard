<?php

// すまいステップの同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            category,
            inquiry_date,
            first_name,
            last_name,
            first_name_kana,
            last_name_kana,
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
            CONCAT('sumai_step_', id),
            '売り:ポータル',
            DATE_FORMAT(`date`, '%Y/%m/%d'),
            mei,
            sei,
            mei_kana,
            sei_kana,            
            'すまいステップ',
            'すまいステップ',
            phone,
            mail,
            zip,
            CONCAT_WS('', address_1, address_2, address_3),
            estate,
            CONCAT_WS('', estate_pref, estate_city, estate_town, estate_street, estate_building, estate_room),            
            '中古住宅専門店',
            remarks
        FROM 
            sumai_step_db";

$stmt = $pdo->prepare($sql);
$stmt->execute();