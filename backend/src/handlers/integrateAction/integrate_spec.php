<?php
// ==========================================
// 顧客データ統合（名寄せ）処理
// ==========================================
// ★ 修正1: $postData ではなく $data を使用する
if (isset($data['request']) && $data['request'] === 'integrate') {

    $base = $data['base'] ?? null;
    $integrateListStr = $data['integrateList'] ?? ''; // 例: "12,35,40"

    if (!$base || !isset($base['id'])) {
        echo json_encode(['status' => 'error', 'message' => '統合先(ベース)のデータが不足しています。'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $baseId = $base['id']; // 統合先のID

    // カンマ区切りの文字列を配列に変換（空文字なら空配列）
    $integrateIds = !empty($integrateListStr) ? explode(',', $integrateListStr) : [];

try {
        // 安全対策: トランザクションを開始
        $pdo->beginTransaction();

        // 1. ベース（統合先）の現在データを取得
        $stmt = $pdo->prepare("SELECT * FROM master_data_kaeru WHERE id = :id");
        $stmt->execute([':id' => $baseId]);
        $baseRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$baseRecord) {
            throw new Exception("統合先(ベース)のデータが存在しません。");
        }

        // 2. 統合対象のデータを取得
        // 💡 堅牢化: フロントから来た "12, 35" などの空白を確実に除去し、空の値を弾く
        $cleanIntegrateIds = array_filter(array_map('trim', $integrateIds));
        
        $integrateRecords = [];
        if (!empty($cleanIntegrateIds)) {
            $placeholders = implode(',', array_fill(0, count($cleanIntegrateIds), '?'));
            $stmt = $pdo->prepare("SELECT * FROM master_data_kaeru WHERE id IN ($placeholders)");
            $stmt->execute($cleanIntegrateIds);
            $integrateRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $fieldPairs = [
            ['customer_contacts_name', 'customer_contacts_name_2'],
            ['customer_contacts_name_kana', 'customer_contacts_name_kana_2'],
            ['customer_contacts_email', 'extra_address_info'],
            ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'],
            ['sales_promotion_name', 'sales_promotion_name_2']
        ];

        // 💡 修正1: 名寄せ先（ベース）は必ず「integration=1, show_dashboard=1」にする
        $updateQueryParts = ["integration = '1'", "show_dashboard = '1'"];
        $updateValues = [':id' => $baseId];

        $normalize = function($str) {
            return str_replace([' ', ' ', "\t", "\n", "\r"], '', (string)$str);
        };

        foreach ($fieldPairs as $pair) {
            $col1 = $pair[0];
            $col2 = $pair[1];

            $val1 = $baseRecord[$col1] ?? '';
            $val2 = $baseRecord[$col2] ?? '';
            $norm1 = $normalize($val1);
            $norm2 = $normalize($val2);

            foreach ($integrateRecords as $rec) {
                $intVals = [$rec[$col1] ?? '', $rec[$col2] ?? ''];
                
                foreach ($intVals as $intVal) {
                    $intNorm = $normalize($intVal);
                    if ($intNorm === '') continue;

                    if ($intNorm !== $norm1 && $intNorm !== $norm2) {
                        if ($norm1 === '') {
                            $val1 = $intVal;
                            $norm1 = $intNorm;
                            $updateQueryParts[] = "$col1 = :$col1";
                            $updateValues[":$col1"] = $val1;
                        } elseif ($norm2 === '') {
                            $val2 = $intVal;
                            $norm2 = $intNorm;
                            $updateQueryParts[] = "$col2 = :$col2";
                            $updateValues[":$col2"] = $val2;
                        }
                    }
                }
            }
        }

        // ベース行のUPDATE
        $setClause = implode(', ', $updateQueryParts);
        $stmt = $pdo->prepare("UPDATE master_data_kaeru SET $setClause WHERE id = :id");
        $stmt->execute($updateValues);

        // 💡 修正2: 名寄せされた側（統合元）は必ず「integration=0, show_dashboard=0」にする
        if (!empty($cleanIntegrateIds)) {
            $placeholders = implode(',', array_fill(0, count($cleanIntegrateIds), '?'));
            $stmt = $pdo->prepare("UPDATE master_data_kaeru SET show_dashboard = '0', integration = '0' WHERE id IN ($placeholders)");
            $stmt->execute($cleanIntegrateIds);
        }

        // --- (中略：interview_sheet と call_sheet の統合処理は元のまま) ---
        // ※長くなるため省略します。そのまま残してください。

        // データベースに確定
        $pdo->commit();

        // 💡 修正3: フロントエンドが期待するプロパティ名で正しく返却する
        $sql_customer = "SELECT
          id,
          COALESCE(customer_contacts_name, '') AS customer,
          COALESCE(in_charge_store, '') AS shop,
          COALESCE(in_charge_user, '') AS staff,
          COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
          COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
          COALESCE(REPLACE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '/', '-'), '') AS tour,
          COALESCE(
          DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
          DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
          ''
          ) AS register,
          COALESCE(sales_promotion_name, '') AS medium,
          COALESCE(status, '') AS status,
          COALESCE(rank_period, '') AS rank_period,
          COALESCE(call_status, '') AS call_status,
          COALESCE(show_dashboard, 0) AS trash,            /* ←既存の機能が壊れないよう念のため残す */
          COALESCE(show_dashboard, 0) AS show_dashboard,   /* ←★Reactが期待している名前を確実に追加！ */
          COALESCE(full_address, '') AS full_address,
          COALESCE(hp_campaign, '') AS hp_campaign,
          COALESCE(property_name, '') AS property_name,
          COALESCE(property_tour_name, '') AS property_tour_name,
          COALESCE(introduction_person_category, '') AS introduction_person_category,
          COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
          COALESCE(customer_contacts_email, '') AS mail,
          COALESCE(integration, '') AS integration
          FROM master_data_kaeru;
        ";
        $stmt_customer = $pdo->prepare($sql_customer);
        $stmt_customer->execute();
        $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'status'   => 'success',
            'message' => '名寄せ・統合処理が正常に完了しました。',
            'customer' => $response_customer
        ], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (Throwable $e) {
        $pdo->rollBack();

        echo json_encode([
            'status'  => 'error',
            'message' => '統合処理中にエラーが発生したため、変更をロールバックしました: ' . $e->getMessage(),
            'line'    => $e->getLine()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'リクエストが integrate ではない、またはデータが不足しています。'], JSON_UNESCAPED_UNICODE);
    exit;
}