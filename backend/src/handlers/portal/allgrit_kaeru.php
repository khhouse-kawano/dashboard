<?php

// ALLGRITの同期
$sql = "INSERT IGNORE INTO inquiry_customer_kaeru
            (inquiry_id,
            inquiry_date,
            first_name,
            first_name_kana,
            medium,
            response_medium,
            mobile,
            mail,
            zip,
            building,
            brand,
            note
            )
        SELECT 
            CONCAT('allgrit_', line_uid), -- 重複判定の軸である line_uid を使用
            line_registered_at,           -- inquiry_date には登録日を入れる
            CONCAT(COALESCE(last_name, ''), COALESCE(first_name, '')), -- どちらかが欠けていてもNULLにならないように対策
            name_kana,
            'ALLGRIT',
            'ALLGRIT',
            phone,
            email,
            zip_code,
            address,
            'かえる',
            remarks
        FROM 
            allGrit_kaeru
        WHERE
            line_uid IS NOT NULL AND line_uid != ''";

$stmt = $pdo->prepare($sql);
$stmt->execute();