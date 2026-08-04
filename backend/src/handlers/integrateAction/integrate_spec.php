<?php
// ==========================================
// 顧客データ統合（名寄せ）処理
// ==========================================
if (isset($data['request']) && $data['request'] === 'integrate') {

    // フロントエンドから送信されたキーに合わせて受け取る
    $baseId = $data['base_id'] ?? null;
    $integrateListStr = $data['integrate_ids'] ?? ''; // 例: "12,35,40"
    $newStaff = $data['staff'] ?? '';

    if (!$baseId) {
        echo json_encode(['status' => 'error', 'message' => '統合先(ベース)のデータが不足しています。'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // カンマ区切りの文字列を配列に変換（空文字なら空配列）
    $integrateIds = !empty($integrateListStr) ? explode(',', $integrateListStr) : [];

    try {
        // 安全対策: トランザクションを開始
        $pdo->beginTransaction();

        // 1. ベース（統合先）の現在データを取得
        $stmt = $pdo->prepare("SELECT * FROM master_data_kaeru WHERE id = :id FOR UPDATE");
        $stmt->execute([':id' => $baseId]);
        $baseRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$baseRecord) {
            throw new Exception("統合先(ベース)のデータが存在しません。");
        }

        // 2. 統合対象のデータを取得
        // 堅牢化: フロントから来た "12, 35" などの空白を確実に除去し、空の値を弾く
        $cleanIntegrateIds = array_filter(array_map('trim', $integrateIds));

        $integrateRecords = [];
        if (!empty($cleanIntegrateIds)) {
            $placeholders = implode(',', array_fill(0, count($cleanIntegrateIds), '?'));
            $stmt = $pdo->prepare("SELECT * FROM master_data_kaeru WHERE id IN ($placeholders) FOR UPDATE");
            $stmt->execute($cleanIntegrateIds);
            $integrateRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // ベースの基本更新要素（名寄せ先は表示状態を維持）
        $updateQueryParts = ["integration = '1'", "show_dashboard = '1'"];
        $updateValues = [':id' => $baseId];

        // Step4で選択した担当者の更新
        if ($newStaff !== '' && ($baseRecord['in_charge_user'] ?? '') !== $newStaff) {
            $updateQueryParts[] = "in_charge_user = :in_charge_user";
            $updateValues[':in_charge_user'] = $newStaff;
        }

        // 比較用に全角・半角スペース等を削除する無名関数
        $normalize = function ($str) {
            return preg_replace('/[\s\x{3000}]+/u', '', (string)$str);
        };

        // ==========================================
        // A. 氏名とふりがなの処理
        // ==========================================
        $valName1 = $baseRecord['customer_contacts_name'] ?? '';
        $valName2 = $baseRecord['customer_contacts_name_2'] ?? '';
        $normName1 = $normalize($valName1);
        $normName2 = $normalize($valName2);

        $valKana1 = $baseRecord['customer_contacts_name_kana'] ?? '';
        $valKana2 = $baseRecord['customer_contacts_name_kana_2'] ?? '';

        foreach ($integrateRecords as $rec) {
            // 統合元の ① と ② の氏名・ふりがなペア
            $intNames = [
                ['name' => $rec['customer_contacts_name'] ?? '', 'kana' => $rec['customer_contacts_name_kana'] ?? ''],
                ['name' => $rec['customer_contacts_name_2'] ?? '', 'kana' => $rec['customer_contacts_name_kana_2'] ?? '']
            ];

            foreach ($intNames as $intData) {
                $intName = $intData['name'];
                $intKana = $intData['kana'];
                $intNormName = $normalize($intName);

                if ($intNormName === '') continue;

                // ①にも②にも一致しない場合
                if ($intNormName !== $normName1 && $intNormName !== $normName2) {
                    // ①が空なら①へ入れる（自然な挙動として）
                    if ($normName1 === '') {
                        $valName1 = $intName;
                        $normName1 = $intNormName;
                        $valKana1 = $intKana; // ふりがなも連動

                        $updateQueryParts[] = "customer_contacts_name = :customer_contacts_name";
                        $updateValues[":customer_contacts_name"] = $valName1;
                        $updateQueryParts[] = "customer_contacts_name_kana = :customer_contacts_name_kana";
                        $updateValues[":customer_contacts_name_kana"] = $valKana1;
                    }
                    // ①が埋まっていて②が空なら②へ入れる
                    elseif ($normName2 === '') {
                        $valName2 = $intName;
                        $normName2 = $intNormName;
                        $valKana2 = $intKana; // 氏名②の追加があった場合のみふりがな②を追加

                        $updateQueryParts[] = "customer_contacts_name_2 = :customer_contacts_name_2";
                        $updateValues[":customer_contacts_name_2"] = $valName2;
                        $updateQueryParts[] = "customer_contacts_name_kana_2 = :customer_contacts_name_kana_2";
                        $updateValues[":customer_contacts_name_kana_2"] = $valKana2;
                    }
                }
            }
        }

        // ==========================================
        // B. 電話番号、メールアドレス、販促媒体の処理
        // ==========================================
        $otherFields = [
            ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'],
            ['customer_contacts_email', 'extra_address_info'],
            ['sales_promotion_name', 'sales_promotion_name_2']
        ];

        foreach ($otherFields as $pair) {
            $col1 = $pair[0];
            $col2 = $pair[1];

            $val1 = $baseRecord[$col1] ?? '';
            $val2 = $baseRecord[$col2] ?? '';
            $norm1 = $normalize($val1);
            $norm2 = $normalize($val2);

            foreach ($integrateRecords as $rec) {
                // 統合元の ① と ② の値
                $intVals = [$rec[$col1] ?? '', $rec[$col2] ?? ''];

                foreach ($intVals as $intVal) {
                    $intNorm = $normalize($intVal);
                    if ($intNorm === '') continue;

                    // ①にも②にも一致しない場合
                    if ($intNorm !== $norm1 && $intNorm !== $norm2) {
                        // ①が空なら①へ入れる
                        if ($norm1 === '') {
                            $val1 = $intVal;
                            $norm1 = $intNorm;
                            $updateQueryParts[] = "$col1 = :$col1";
                            $updateValues[":$col1"] = $val1;
                        }
                        // ①が埋まっていて②が空なら②へ入れる
                        elseif ($norm2 === '') {
                            $val2 = $intVal;
                            $norm2 = $intNorm;
                            $updateQueryParts[] = "$col2 = :$col2";
                            $updateValues[":$col2"] = $val2;
                        }
                    }
                }
            }
        }

        // 統合先(ベース)のUPDATE実行
        $setClause = implode(', ', $updateQueryParts);
        $stmt = $pdo->prepare("UPDATE master_data_kaeru SET $setClause WHERE id = :id");
        $stmt->execute($updateValues);

        // 統合元(消える側)は show_dashboard=0 にして非表示化
        if (!empty($cleanIntegrateIds)) {
            $placeholders = implode(',', array_fill(0, count($cleanIntegrateIds), '?'));
            $stmt = $pdo->prepare("UPDATE master_data_kaeru SET show_dashboard = '0', integration = '0' WHERE id IN ($placeholders)");
            $stmt->execute($cleanIntegrateIds);
        }

        // ------------------------------------------
        // 3. interview_sheet テーブルのログ結合 (JSON配列)
        // ------------------------------------------
        $stmt = $pdo->prepare("SELECT interview_log FROM interview_sheet WHERE id = :id FOR UPDATE");
        $stmt->execute([':id' => $baseId]);
        $baseInterview = $stmt->fetch(PDO::FETCH_ASSOC);

        $baseInterviewLogs = $baseInterview ? json_decode($baseInterview['interview_log'], true) : [];
        if (!is_array($baseInterviewLogs)) $baseInterviewLogs = [];

        if (!empty($cleanIntegrateIds)) {
            $placeholders = implode(',', array_fill(0, count($cleanIntegrateIds), '?'));
            $stmt = $pdo->prepare("SELECT interview_log FROM interview_sheet WHERE id IN ($placeholders)");
            $stmt->execute($cleanIntegrateIds);
            $mergeInterviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($mergeInterviews as $row) {
                $logs = json_decode($row['interview_log'], true);
                if (is_array($logs)) {
                    $baseInterviewLogs = array_merge($baseInterviewLogs, $logs);
                }
            }
        }

        $updatedInterviewJson = json_encode($baseInterviewLogs, JSON_UNESCAPED_UNICODE);

        // ★ 担当者を決定 (新しく選択された担当者がいればそれ、なければ元の担当者)
        $staffToInsert = $newStaff !== '' ? $newStaff : ($baseRecord['in_charge_user'] ?? '');

        if ($baseInterview) {
            $stmt = $pdo->prepare("UPDATE interview_sheet SET interview_log = :log WHERE id = :id");
            $stmt->execute([':log' => $updatedInterviewJson, ':id' => $baseId]);
        } else {
            // ★ INSERT文に staff を追加
            $stmt = $pdo->prepare("INSERT INTO interview_sheet (id, interview_log) VALUES (:id, :log)");
            $stmt->execute([':id' => $baseId, ':log' => $updatedInterviewJson]);
        }

        // ------------------------------------------
        // 4. call_sheet テーブルのログ結合 (JSON配列)
        // ------------------------------------------
        $stmt = $pdo->prepare("SELECT call_log FROM call_sheet WHERE id = :id FOR UPDATE");
        $stmt->execute([':id' => $baseId]);
        $baseCall = $stmt->fetch(PDO::FETCH_ASSOC);

        $baseCallLogs = $baseCall ? json_decode($baseCall['call_log'], true) : [];
        if (!is_array($baseCallLogs)) $baseCallLogs = [];

        if (!empty($cleanIntegrateIds)) {
            $placeholders = implode(',', array_fill(0, count($cleanIntegrateIds), '?'));
            $stmt = $pdo->prepare("SELECT call_log FROM call_sheet WHERE id IN ($placeholders)");
            $stmt->execute($cleanIntegrateIds);
            $mergeCalls = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($mergeCalls as $row) {
                $logs = json_decode($row['call_log'], true);
                if (is_array($logs)) {
                    $baseCallLogs = array_merge($baseCallLogs, $logs);
                }
            }
        }

        $updatedCallJson = json_encode($baseCallLogs, JSON_UNESCAPED_UNICODE);

        if ($baseCall) {
            $stmt = $pdo->prepare("UPDATE call_sheet SET call_log = :log WHERE id = :id");
            $stmt->execute([':log' => $updatedCallJson, ':id' => $baseId]);
        } else {
            // ★ INSERT文に staff を追加
            $stmt = $pdo->prepare("INSERT INTO call_sheet (id, shop, staff, name, status, reserved_status, call_log) VALUES (:id, '', :staff, '', '','', :log)");
            $stmt->execute([':id' => $baseId, ':staff' => $staffToInsert, ':log' => $updatedCallJson]);
        }

        // データベースに確定
        $pdo->commit();

        // 更新された最新のマスターデータを返却
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
          COALESCE(show_dashboard, 0) AS trash,
          COALESCE(show_dashboard, 0) AS show_dashboard,
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
