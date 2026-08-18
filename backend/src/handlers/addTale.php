<?php
// ==========================================
// 1. PDO接続設定（ご自身の環境に合わせて記述してください）
// ==========================================
$host = 'mariadb-db';
$dbname = 'local_db';
$user = 'local_user';
$pass = 'local_password';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    die("DB接続エラー: " . $e->getMessage());
}

// 対象のテーブル名（指示通り borkerage_listings としていますが、brokerage_listings の場合は修正してください）
$tableName = 'brokerage_listings';

// ==========================================
// 2. 許可されたカラム名リスト（ご提示いただいたリスト）
// ==========================================
$allowedColumns = [
    'kind', 'id', 'no', 'freq', 'note', 'addr1', 'addr2', 'addr', 'price', 'budget',
    'fee', 'feeManual', 'staff', 'portal', 'seller', 'customer', 'name', 'source',
    'contact', 'keyInfo', 'category', 'keyStatus', 'baikaiType', 'propStatus',
    'currentStatus', 'type', 'phase', 'priority', 'property', 'targetProperty',
    'endReason', 'ledgerNo', 'extId', 'dealId', 'reinsDate', 'contractDate',
    'priceRevDate', 'lastReportDate', 'followDate', 'settleDate', 'contactDate',
    'visitDate', 'connectDate', 'receivedDate', 'viewDate', 'inputDate', 'renewDate',
    'callDates', 'created_at', 'updated_at', 'master_data_id', 'property_db_id',
    'property_db_name', 'show_dashboard', 'phone', 'mail', 'applicationDate',
    'by', 'data', 'buyer', 'dealNo', 'delivery', 'propName', 'updatedAt',
    'baikaiDate', 'nextDate', 'nextNote'
];

// ==========================================
// 3. JSONデータの受け取り
// ==========================================
$jsonString = file_get_contents(__DIR__ . '/data.json');
$jsonData = json_decode($jsonString, true);

if (!$jsonData) {
    die("JSONデータのデコードに失敗しました。");
}

if (!isset($jsonData[0])) {
    $jsonData = [$jsonData];
}

// ==========================================
// 4. データのフラット化とテーブルへの登録
// ==========================================
foreach ($jsonData as $item) {
    $flatData = [];

    // ① "data" の中身などをフラット化
    foreach ($item as $key => $value) {
        if ($key === 'data' && is_array($value)) {
            foreach ($value as $dataKey => $dataValue) {
                $flatData[$dataKey] = $dataValue;
            }
        } else {
            $flatData[$key] = $value;
        }
    }

    $filteredData = [];

    // ② 許可されたカラムだけを抽出し、型に合わせて値を整形する
    foreach ($flatData as $k => $v) {
        if (!in_array($k, $allowedColumns)) {
            continue; // テーブルに存在しないキーは無視
        }

        if ($v === '') {
            // 空文字はNULLに変換（date型やint型の Strict Mode 対策）
            $filteredData[$k] = null;
        } elseif (is_array($v) || is_object($v)) {
            // 配列やオブジェクトはJSON文字列に変換（callDatesなどの制約対策）
            $filteredData[$k] = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } elseif (is_bool($v)) {
            // boolean は tinyint用に 1 / 0 に変換
            $filteredData[$k] = $v ? 1 : 0;
        } else {
            $filteredData[$k] = $v;
        }
    }

    if (empty($filteredData)) {
        continue;
    }

    // ③ INSERT文の構築
    $columns = array_keys($filteredData);
    $escapedColumns = array_map(function($col) { return "`" . $col . "`"; }, $columns);
    $placeholders = array_map(function($col) { return ":" . $col; }, $columns);

    // ※既に同じIDが存在する場合は上書き（UPDATE）するように ON DUPLICATE KEY UPDATE を使用しています
    $updateClauses = array_map(function($col) { return "`$col` = VALUES(`$col`)"; }, $columns);

    $sql = sprintf(
        "INSERT INTO `%s` (%s) VALUES (%s) ON DUPLICATE KEY UPDATE %s",
        $tableName,
        implode(', ', $escapedColumns),
        implode(', ', $placeholders),
        implode(', ', $updateClauses)
    );

    // ④ クエリの実行
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($filteredData);
        echo "ID: " . ($filteredData['id'] ?? '不明') . " の登録/更新が完了しました。<br>\n";
    } catch (PDOException $e) {
        echo "ID: " . ($filteredData['id'] ?? '不明') . " のエラー: " . $e->getMessage() . "<br>\n";
    }
}

echo "全ての処理が完了しました。\n";