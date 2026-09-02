<?php

$id = $data['id'] ?? null;
$newData = $data['data'] ?? [];

if (!$id) {
    die(json_encode(['status' => 'error', 'message' => 'IDがありません']));
}

// brokerage_listings の更新を許可するカラム。
// ここに無いキーは黙って捨てられるため、カラムを追加した際はここにも追加すること。
// 除外しているのは internal_id / id / created_at / updated_at の4つのみ
// （id は WHERE キーとして別扱い、残りは DB が自動採番・自動更新する）。
$allowedColumns = [
    // 共通
    'kind', 'no', 'note', 'staff', 'category', 'phase', 'show_dashboard',
    // 物件・所在
    'addr', 'addr1', 'addr2', 'property', 'targetProperty', 'propName',
    // 金額
    'price', 'budget', 'fee', 'feeManual',
    // 顧客・反響元
    'seller', 'buyer', 'customer', 'name', 'source', 'portal', 'contact', 'phone', 'mail',
    // 媒介台帳
    'freq', 'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus',
    'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate',
    // 商談
    'type', 'priority', 'dealId', 'dealNo', 'ledgerId', 'ledgerNo', 'extId',
    'subStaff', 'subRatio', 'coBroker', 'delivery',
    // リード（追客）
    'reason', 'timing', 'endReason', 'callDates', 'nextDate', 'nextNote',
    'receivedDate', 'connectDate', 'visitDate', 'viewDate', 'baikaiDate',
    'contactDate', 'contractDate', 'settleDate', 'followDate',
    'inputDate', 'renewDate', 'applicationDate',
    // 買取再販
    'status', 'costs', 'targetGp',
    'buyPrice', 'buyBuilding', 'buySellerReg', 'buyStockAsset',
    'taxCheckDate', 'buyContractDate', 'buySettleDate',
    'listPrice', 'listDate',
    'sellPrice', 'sellBuilding', 'sellStaff', 'sellContractDate', 'sellSettleDate',
    // 監査ログ・通知
    'at', 'to', 'from', 'field', 'label', 'entity', 'entityId', 'entityNo',
    'title', 'body', 'read', 'by', 'data', 'updatedAt',
    // 論理削除（物理削除はしない）
    'deleted_at', 'deleted_by',
    // 契約書の下書き
    'docDraft', 'docDraftAt', 'docDraftBy',
    // 外部DB連携
    'master_data_id', 'property_db_id', 'property_db_name',
    // Supabase 由来の原本 JSON
    'raw_data',
];

// 配列・オブジェクトで渡ってくるカラム（DB上は JSON 文字列で保持する）。
// フロント側が JSON.stringify を忘れても壊れないよう、ここで吸収する。
$jsonColumns = ['callDates', 'costs', 'coBroker', 'data', 'raw_data', 'docDraft'];

// UPSERT用の配列
$columns = ['`id`'];         // INSERTの列名 (idは必須)
$placeholders = ['?'];       // INSERTの値(?)
$updateParts = [];           // ON DUPLICATE KEY UPDATE 用の配列
$bindParams = [$id];         // PDOに渡す実データ

foreach ($allowedColumns as $col) {
    if (array_key_exists($col, $newData)) {
        // ① INSERT部分の構築
        $columns[] = "`$col`";
        $placeholders[] = "?";
        
        // ② UPDATE部分の構築 (VALUES(col) でINSERTに渡した値を再利用します)
        $updateParts[] = "`$col` = VALUES(`$col`)";
        
        // ③ データのバインド (空文字はnull化)
        $val = $newData[$col] === '' ? null : $newData[$col];

        // 配列・オブジェクトのまま渡された JSON カラムは文字列化する。
        // PDO は配列をバインドできず「Array to string conversion」で壊れるため。
        if ($val !== null && is_array($val) && in_array($col, $jsonColumns, true)) {
            $val = json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        // 真偽値は tinyint(1) の 0/1 に寄せる
        if (is_bool($val)) {
            $val = $val ? 1 : 0;
        }

        $bindParams[] = $val;
    }
}

if (count($columns) === 1) {
    die(json_encode(['status' => 'success', 'message' => '更新データなし'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

// 💡 魔法のUPSERTクエリ
// INSERT INTO table (id, col1, col2) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE col1 = VALUES(col1), col2 = VALUES(col2)
$sql = "INSERT INTO `brokerage_listings` (" . implode(', ', $columns) . ") 
        VALUES (" . implode(', ', $placeholders) . ") 
        ON DUPLICATE KEY UPDATE " . implode(', ', $updateParts);

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($bindParams);

    // 更新後の1行。呼び出し側が楽観的更新の整合性を取るために使う。
    $sql_row = "SELECT * FROM brokerage_listings WHERE `id` = ?";
    $stmt_row = $pdo->prepare($sql_row);
    $stmt_row->execute([$id]);
    $response_row = $stmt_row->fetch(PDO::FETCH_ASSOC) ?: null;

    // light=true のときは全件返却を省略する。
    // 全件は 1,200 行 × 100 列超あり、セル単位のインライン編集で毎回返すと重い。
    // 既存の呼び出し元（DatabaseBroker 等）は light を送らないため従来どおり全件を受け取る。
    if (!empty($data['light'])) {
        echo json_encode(['status' => 'success', 'row' => $response_row], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // 最新のデータを取得して返す (既存コードのまま)
    $sql_brokerage = "SELECT * FROM brokerage_listings";
    $stmt_brokerage = $pdo->prepare($sql_brokerage);
    $stmt_brokerage->execute();
    $response_brokerage = $stmt_brokerage->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['status' => 'success', 'row' => $response_row, 'brokerage' => $response_brokerage], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (PDOException $e) {
    // 例外メッセージをそのまま返すと SQL 構造が漏れるため、詳細はサーバーログにのみ残す。
    error_log('[broker_update] id=' . $id . ' : ' . $e->getMessage());
    http_response_code(500);
    die(json_encode(['status' => 'error', 'message' => '更新に失敗しました'], JSON_UNESCAPED_UNICODE));
}