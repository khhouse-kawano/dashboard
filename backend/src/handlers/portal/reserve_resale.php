<?php

// イベント・物件予約(リセール)の同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
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
            reserved_date,
            reserved_time,
            brand,
            hp_campaign,
            note
            )
        SELECT 
            CONCAT('hp_resale_', no),                  -- 重複防止のため固有の接頭辞＋AUTO_INCREMENTのno
            DATE_FORMAT(registered, '%Y/%m/%d'),       -- メール受信日時を「/」区切りの日付に変換
            `name`,
            nameKana,
            'ホームページ反響',
            source,                                    -- ご予約のきっかけ
            tel,
            email,
            zip,
            `address`,
            `date`,                                    -- ご来店・参加希望日
            `time`,                                    -- ご来店・参加希望時間
            '中古住宅専門店',
            event,                            -- 他のフォームと区別するためのキャンペーン名
            remarks                                    -- 全項目を網羅した詳細テキスト
        FROM 
            reserve_resale
        WHERE
            `name` IS NOT NULL AND `name` != ''";

$stmt = $pdo->prepare($sql);
$stmt->execute();