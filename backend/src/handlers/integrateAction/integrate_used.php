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
        // 安全対策: 複数のテーブルを同時に更新するため、トランザクションを開始
        $pdo->beginTransaction();

        // ------------------------------------------
        // 1. master_data_kaeru テーブルの更新
        // ------------------------------------------
        $stmt = $pdo->prepare("UPDATE master_data_resale SET integration = '1' WHERE id = :id");
        $stmt->execute([':id' => $baseId]);

        if (!empty($integrateIds)) {
            $placeholders = implode(',', array_fill(0, count($integrateIds), '?'));
            $stmt = $pdo->prepare("UPDATE master_data_resale SET show_dashboard = '0' WHERE id IN ($placeholders)");
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
