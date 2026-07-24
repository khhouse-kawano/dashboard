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

        // ------------------------------------------
        // ★新規追加: ベースと統合対象のデータを取得
        // ------------------------------------------
        // 1. ベース（統合先）の現在データを取得
        $stmt = $pdo->prepare("SELECT * FROM master_data_kaeru WHERE id = :id");
        $stmt->execute([':id' => $baseId]);
        $baseRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$baseRecord) {
            throw new Exception("統合先(ベース)のデータが存在しません。");
        }

        // 2. 統合対象（統合元）のデータを取得
        $integrateRecords = [];
        if (!empty($integrateIds)) {
            $placeholders = implode(',', array_fill(0, count($integrateIds), '?'));
            $stmt = $pdo->prepare("SELECT * FROM master_data_resale WHERE id IN ($placeholders)");
            $stmt->execute($integrateIds);
            $integrateRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // ------------------------------------------
        // ★新規追加: 項目ごとの重複排除＆データ引き継ぎロジック
        // ------------------------------------------
        // ①と②のカラム名のペア定義
        $fieldPairs = [
            ['customer_contacts_name', 'customer_contacts_name_2'],
            ['customer_contacts_name_kana', 'customer_contacts_name_kana_2'],
            ['customer_contacts_email', 'extra_address_info'], // メアド
            ['customer_contacts_phone_number', 'customer_contacts_mobile_phone_number'], // 電話番号
            ['sales_promotion_name', 'sales_promotion_name_2']
        ];

        // UPDATE用のクエリパーツとバインド値を格納する配列
        $updateQueryParts = ["integration = '1'"];
        $updateValues = [':id' => $baseId];

        // 比較用：全角・半角スペースを除去する関数（TypeScriptのアロー関数のようなもの）
        $normalize = function ($str) {
            return str_replace([' ', ' ', "\t", "\n", "\r"], '', (string)$str);
        };

        foreach ($fieldPairs as $pair) {
            $col1 = $pair[0];
            $col2 = $pair[1];

            // ベースの現在の値と、比較用のスペース除去済み値
            $val1 = $baseRecord[$col1] ?? '';
            $val2 = $baseRecord[$col2] ?? '';
            $norm1 = $normalize($val1);
            $norm2 = $normalize($val2);

            foreach ($integrateRecords as $rec) {
                // 統合元の①と②の値
                $intVals = [$rec[$col1] ?? '', $rec[$col2] ?? ''];

                foreach ($intVals as $intVal) {
                    $intNorm = $normalize($intVal);
                    if ($intNorm === '') continue; // データが無ければスキップ

                    // 重複チェック: ベースの①にも②にも同じデータが「無い」場合のみ処理
                    if ($intNorm !== $norm1 && $intNorm !== $norm2) {
                        // 空いているスロット（①または②）にデータを格納
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

        // ------------------------------------------
        // 1. master_data_kaeru テーブルの更新
        // ------------------------------------------
        // 動的に生成したSET句でベース行をUPDATE
        $setClause = implode(', ', $updateQueryParts);
        $stmt = $pdo->prepare("UPDATE master_data_resale SET $setClause WHERE id = :id");
        $stmt->execute($updateValues);

        // 統合された側のフラグ更新
        if (!empty($integrateIds)) {
            $placeholders = implode(',', array_fill(0, count($integrateIds), '?'));
            $stmt = $pdo->prepare("UPDATE master_data_kaeru SET show_dashboard = '0' WHERE id IN ($placeholders)");
            $stmt->execute($integrateIds);
        }
        // ------------------------------------------
        // 2. interview_sheet テーブルのログ結合 (longtext型 JSON配列)
        // ------------------------------------------
        $stmt = $pdo->prepare("SELECT interview_log FROM interview_sheet WHERE id = :id");
        $stmt->execute([':id' => $baseId]);
        $baseInterview = $stmt->fetch(PDO::FETCH_ASSOC);

        $baseInterviewLogs = $baseInterview ? json_decode($baseInterview['interview_log'], true) : [];
        if (!is_array($baseInterviewLogs)) $baseInterviewLogs = [];

        if (!empty($integrateIds)) {
            $placeholders = implode(',', array_fill(0, count($integrateIds), '?'));
            $stmt = $pdo->prepare("SELECT interview_log FROM interview_sheet WHERE id IN ($placeholders)");
            $stmt->execute($integrateIds);
            $mergeInterviews = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($mergeInterviews as $row) {
                $logs = json_decode($row['interview_log'], true);
                if (is_array($logs)) {
                    $baseInterviewLogs = array_merge($baseInterviewLogs, $logs);
                }
            }
        }

        $updatedInterviewJson = json_encode($baseInterviewLogs, JSON_UNESCAPED_UNICODE);
        if ($baseInterview) {
            $stmt = $pdo->prepare("UPDATE interview_sheet SET interview_log = :log WHERE id = :id");
            $stmt->execute([':log' => $updatedInterviewJson, ':id' => $baseId]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO interview_sheet (id, interview_log) VALUES (:id, :log)");
            $stmt->execute([':id' => $baseId, ':log' => $updatedInterviewJson]);
        }

        // ------------------------------------------
        // 3. call_sheet テーブルのログ結合 (text型 JSON配列)
        // ------------------------------------------
        $stmt = $pdo->prepare("SELECT call_log FROM call_sheet WHERE id = :id");
        $stmt->execute([':id' => $baseId]);
        $baseCall = $stmt->fetch(PDO::FETCH_ASSOC);

        $baseCallLogs = $baseCall ? json_decode($baseCall['call_log'], true) : [];
        if (!is_array($baseCallLogs)) $baseCallLogs = [];

        if (!empty($integrateIds)) {
            $placeholders = implode(',', array_fill(0, count($integrateIds), '?'));
            $stmt = $pdo->prepare("SELECT call_log FROM call_sheet WHERE id IN ($placeholders)");
            $stmt->execute($integrateIds);
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
            $stmt = $pdo->prepare("INSERT INTO call_sheet (id, shop, name, status, call_log) VALUES (:id, '', '', '', :log)");
            $stmt->execute([':id' => $baseId, ':log' => $updatedCallJson]);
        }

        // すべての処理が成功したため、データベースに確定
        $pdo->commit();

        // ------------------------------------------
        // 4. 最新の全顧客データを再取得してフロントに返却
        // ------------------------------------------
        $sql_customer = "SELECT
  id,
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(
  DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
  DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
  ''
  ) AS register,
  COALESCE(sales_promotion_name, '') AS medium,
  COALESCE(status, '') AS status,
  COALESCE(rank_period, '') AS rank_period,
  COALESCE(call_status, '') AS call_status,
  COALESCE(category, '') AS category,
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(show_dashboard, 0) AS trash,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(property_name, '') AS property_name,
  COALESCE(property_tour_name, '') AS property_tour_name,
  COALESCE(introduction_person_category, '') AS introduction_person_category,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  COALESCE(customer_contacts_email, '') AS mail,
  COALESCE(integration, '') AS integration FROM master_data_resale;";
        $stmt_customer = $pdo->prepare($sql_customer);
        $stmt_customer->execute();
        $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'status'   => 'success',
            'message' => '名寄せ・統合処理が正常に完了しました。',
            'customer' => $response_customer
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) { // ★ 修正2: Exception を Throwable に変更し、DB以外の致命的エラーも捕捉
        $pdo->rollBack();

        echo json_encode([
            'status'  => 'error',
            'message' => '統合処理中にエラーが発生したため、変更をロールバックしました: ' . $e->getMessage(),
            'line'    => $e->getLine() // どこでエラーが起きたかも特定しやすくする
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
} else {
    // ★ デバッグ用: もしリクエスト条件に合致しなかったら、ここを通る
    echo json_encode(['status' => 'error', 'message' => 'リクエストが integrate ではない、またはデータが不足しています。'], JSON_UNESCAPED_UNICODE);
    exit;
}
