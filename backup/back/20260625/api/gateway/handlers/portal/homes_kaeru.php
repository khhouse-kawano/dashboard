<?php

// HOME'Sの同期
$sql = "INSERT IGNORE INTO inquiry_customer_kaeru
            (inquiry_id,
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
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            'HOME''S',
            'HOME''S',
            mobile,
            mail,
            propertyName,
            area,
            'かえる',
            propertyUrl,
            note,
            remarks
        FROM 
            homes_db_kaeru";
$stmt = $pdo->prepare($sql);
$stmt->execute();
