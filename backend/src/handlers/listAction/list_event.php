<?php

$function = $data['function'] ?? '';

if ($function && $function === 'load') {

    $sql_summary = "SELECT * FROM event_db";
    $stmt_summary = $pdo->prepare($sql_summary);
    $stmt_summary->execute();
    $response_summary = $stmt_summary->fetchAll(PDO::FETCH_ASSOC);

    $sql_staff =  "SELECT * FROM staff_list";
    $stmt_staff = $pdo->prepare($sql_staff);
    $stmt_staff->execute();
    $response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

    // 店舗。
    //
    // ⚠️⚠️ **担当店舗を選び直すために返す**（2026-09-28 追加）。
    //   ⚠️ event_db.shop が空の予約があり、⚠️ **そのままでは同期できなかった。**
    //
    // ⚠️ 絞り込み（report_flag = 1）と並び替えは**フロントがやる**
    //   （⚠️ `filterReportShops` / `sortShops`。⚠️ **規則を2箇所に置かない**）。
    // ⚠️ ⚠️ **`id` と `division` を必ず含めること。** `sortShops` が見ている。
    $sql_shop = "SELECT id, brand, shop, section, area, division, report_flag FROM shop_list";
    $stmt_shop = $pdo->prepare($sql_shop);
    $stmt_shop->execute();
    $response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

    // ⚠️⚠️ **キーの顔ぶれは ② の backend-express/src/features/list/event.ts と揃えること。**
    //   ⚠️ `list` は ② へ転送される。⚠️ **片方だけ足すと、②が応答したときに店舗が出ない。**
    $result = [
        "summary" => $response_summary,
        "staff" => $response_staff,
        "shop" => $response_shop
    ];

    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

if ($function && $function === 'update') {

    $id = $data['id'] ?? null;

    if (!$id) {
        echo json_encode(['status' => 'error', 'message' => 'IDが指定されていません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 更新を許可するカラムのホワイトリスト。
    //
    // ⚠️⚠️ **2026-09-07 に大幅に絞った。**
    //   来場予約がLPのフォームから直接届くようになったため、氏名・連絡先以外は
    //   **来場者本人が入力した原本**である。社内で書き換えると
    //   「本当は何と入力されたのか」が分からなくなる。
    //   誤りがあれば remarks に書くか、顧客へ取り込んでから顧客情報側で直す。
    //
    //   name / phone / mail … 受付で誤記に気づいたときに直す必要があるため残す
    //   check_in_time       … QRの読み取り（受付）で記録するため必須
    //   check_out_time      … 退場時刻。受付運用で使う
    //   remarks             … 社内メモ。原本ではないので自由に書ける
    //   sync                … 顧客への取り込み済みフラグ
    //
    // ⚠️ ここに列を戻すときは EventList.tsx 側の入力欄も合わせること。
    //   片方だけ変えると、画面では編集できるのに保存されない（無言で消える）。
    $allowed_columns = [
        'name', 'phone', 'mail',
        'check_in_time', 'check_out_time', 'remarks', 'sync'
    ];

    $update_fields = [];
    $params = [':id' => $id];

    // 送られてきたデータの中に、許可されたカラム名が存在するかチェック
    foreach ($allowed_columns as $column) {
        if (array_key_exists($column, $data)) {
            $update_fields[] = "{$column} = :{$column}";
            $params[":{$column}"] = $data[$column];
        }
    }

    // 更新対象のデータがない場合は処理を終了
    if (empty($update_fields)) {
        echo json_encode(['status' => 'error', 'message' => '更新するデータがありません'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // カンマ区切りでSET句を作成 (例: "name = :name, remarks = :remarks")
    $set_clause = implode(', ', $update_fields);
    
    $sql = "UPDATE event_db SET {$set_clause} WHERE id = :id";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        echo json_encode(['status' => 'success', 'message' => '更新が完了しました'], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        // エラーハンドリング
        echo json_encode(['status' => 'error', 'message' => 'DBエラー: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    
    exit;
}
