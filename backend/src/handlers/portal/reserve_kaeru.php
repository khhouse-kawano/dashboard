<?php

// 来場予約(かえるホーム)の同期
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
            area,
            reserved_date,
            reserved_time,
            brand,
            hp_campaign,
            note
            )
        SELECT 
            CONCAT('hp_reserve_', no),                 -- 重複防止のため AUTO_INCREMENTの'no' を活用
            DATE_FORMAT(registered, '%Y/%m/%d'),       -- 文字列(YYYY-MM-DD HH:mm:ss)を / 区切りにフォーマット
            `name`,
            nameKana,
            'ホームページ反響',
            source,
            tel,                                       -- 来場予約は電話番号項目が1つのためmobileにマッピング
            email,
            zip,
            `address`,
            area,
            `date`,                                    -- ご来場希望日
            `time`,                                    -- ご来場希望時間
            'かえる',
            event,                                -- 会員登録と区別するためのキャンペーン名
            remarks                                    -- TypeScript側で生成した全データの詳細テキスト
        FROM 
            reserve_kaeru
        WHERE
            `name` IS NOT NULL AND `name` != ''";

$stmt = $pdo->prepare($sql);
$stmt->execute();