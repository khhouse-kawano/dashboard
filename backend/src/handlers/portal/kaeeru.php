<?php

// 会員登録・査定依頼(かえるホーム)の同期
$sql = "INSERT IGNORE INTO inquiry_customer_resale
            (inquiry_id,
            inquiry_date,
            first_name,
            first_name_kana,
            medium,
            response_medium,
            mobile,
            mail,
            building,
            area,
            brand,
            category,
            hp_campaign,
            note
            )
        SELECT 
            CONCAT('kaeeru_assess_', id),  -- IDプレフィックスを査定用として変更
            DATE_FORMAT(registered, '%Y/%m/%d'),
            `name`,
            name_kana,
            'カエール',
            'カエール',            -- 反響媒体を査定用に変更
            tel,
            email,
            `address`,
            location,                   -- 【所在地】をエリアに割り当て
            '中古住宅専門店',
            '売り:ポータル',
            'カエール',          -- キャンペーン名を変更
            CONCAT(                     -- ダッシュボード等で確認しやすいように査定情報を備考(note)に結合
                '【種別】', IFNULL(type, ''), '\n',
                '【土地面積】', IFNULL(area, ''), '\n',
                '【現況】', IFNULL(status, ''), '\n',
                '【売却予定】', IFNULL(schedule, ''), '\n',
                '【査定対象不動産とご自身の関係】', IFNULL(relation, ''), '\n',
                '【査定額】', IFNULL(price, '')
            )
        FROM 
            kaeeru_db";

$stmt = $pdo->prepare($sql);
$stmt->execute();