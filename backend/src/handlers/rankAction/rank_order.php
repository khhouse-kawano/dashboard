<?php
        // 担当営業
        $sql_staff = "SELECT name, shop, section, sort, memo, period, khg_id, position
        FROM staff_list WHERE rank = 1";
        $stmt_staff = $pdo->prepare($sql_staff);
        $stmt_staff->execute();
        $response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);


        // 店舗
        $sql_shop = "SELECT shop, section, division
        FROM shop_list WHERE division = '注文事業'";
        $stmt_shop = $pdo->prepare($sql_shop);
        $stmt_shop->execute();
        $response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);


        // 営業課
        $sql_section = "SELECT name FROM section_list WHERE division = '注文事業'";
        $stmt_section = $pdo->prepare($sql_section);
        $stmt_section->execute();
        $response_section = $stmt_section->fetchAll(PDO::FETCH_ASSOC);


        // 顧客一覧
        $sql_contract = "SELECT id,
                        customer_contacts_name as customer,
                        in_charge_store as shop,
                        in_charge_user as staff,
                        customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
                        step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
                        step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
                        step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
                        step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
                        step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
                        status,
                        rank_period FROM master_data
                        WHERE show_dashboard = 1";
        $stmt_contract = $pdo->prepare($sql_contract);
        $stmt_contract->execute();
        $response_contract = $stmt_contract->fetchAll(PDO::FETCH_ASSOC);


        // 契約目標
        $sql_achievement = "SELECT category, name, period, value FROM company_achievement";
        $stmt_achievement = $pdo->prepare($sql_achievement);
        $stmt_achievement->execute();
        $response_achievement = $stmt_achievement->fetchAll(PDO::FETCH_ASSOC);


        // 契約見込み
        $sql_expected = "SELECT * FROM contract_expected";
        $stmt_expected = $pdo->prepare($sql_expected);
        $stmt_expected->execute();
        $response_expected = $stmt_expected->fetchAll(PDO::FETCH_ASSOC);


        $result = [
                "staff" => $response_staff,
                "shop" => $response_shop,
                "section" => $response_section,
                "customer" => $response_contract,
                "achievement" => $response_achievement,
                "expected" => $response_expected
        ];

        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;