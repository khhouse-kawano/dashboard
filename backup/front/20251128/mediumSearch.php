<?php
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);
$shop = $data['shop'];
$startMonth = $data['startMonth'];
$endMonth = $data['endMonth'];
$rank = $data['rank'];
$medium = $data['medium'];

// データベース接続 (PDO)
    // // ローカルデータベース接続 (PDO)
    // $dsn = 'mysql:host=127.0.0.1;port=3306;dbname=owners_house;charset=utf8';
    // $db_user = 'root';
    // $db_password = '';

    // 本番サーバーデータベース接続 (PDO)
    $dsn = 'mysql:host=localhost:3306;dbname=xs200571_kawano;charset=utf8';
    $db_user = 'xs200571_kawano';
    $db_password = '4081kawano';

// 対象となる媒体リスト
$mediums = [
    "全媒体",
    "チラシ",
    "フリーペーパー",
    "ハガキDM",
    "SUUMO",
    "HOME'S",
    "athome",
    "カゴスマ",
    "イエタッタ",
    "持ち家計画",
    "インターネット検索",
    "SNS広告",
    "バス広告",
    "看板",
    "CM/ラジオ",
    "紹介",
    "建築現場を見て",
    "ヒーローショーを見て",
    "タウンライフ",
    "公式LINE",
    "メタ住宅展示場",
    "住まいづくりフェア",
    "おうちづくりフェスタ"
];

$placeholders = rtrim(str_repeat('?,', count($mediums)), ',');

try {
    $pdo = new PDO($dsn, $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // SQLクエリを構築
    $sql = "SELECT
    medium,
    COUNT(register) AS register_count,
    COUNT(CASE WHEN reserve LIKE '%20%' THEN 1 END) AS reserve_count,
    COUNT(CASE WHEN status = '契約済み' THEN 1 END) AS contract_count,
    COUNT(CASE WHEN rank = 'Aランク' THEN 1 END) AS rankA_count,
    COUNT(CASE WHEN rank = 'Bランク' THEN 1 END) AS rankB_count,
    COUNT(CASE WHEN rank = 'Cランク' THEN 1 END) AS rankC_count,
    COUNT(CASE WHEN rank = 'Dランク' THEN 1 END) AS rankD_count,
    COUNT(CASE WHEN rank = 'Eランク' THEN 1 END) AS rankE_count,
    (SELECT SUM(budget_value) FROM budget WHERE budget.medium = customers.medium";

    if ($shop != null) {
        $shopSearch = $shop == "グループ全体" ? "" : $shop;
        $sql .= " AND budget.shop LIKE '%{$shopSearch}%'";
    }
    if( $startMonth != $endMonth ) {
        if ($startMonth != "" && $endMonth != "") {
            $startDate = $startMonth . '/01'; // 例: '2025/01/01'
            
            // endMonthをyyyy/MM/01形式に変換し、次の月の1日前の日付を計算
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $sql .= " AND budget.budget_period BETWEEN '{$startDate}' AND '{$endDate}'";
        } elseif ($startMonth == "" && $endMonth != "") {
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $sql .= " AND budget.budget_period  BETWEEN '2025/01/01' AND '{$endDate}'";
        }
         } else {
            if ($startMonth != "" && $endMonth != "") {
            $sql .= " AND budget.budget_period  LIKE '%{$startMonth}%'";
        }}

    $sql .= ") AS total_budget
    FROM
        customers
    WHERE
        medium IN ($placeholders)";

    if( $startMonth != $endMonth ) {
        if ($startMonth != "" && $endMonth != "") {
            $startDate = $startMonth . '/01'; // 例: '2025/01/01'
            
            // endMonthをyyyy/MM/01形式に変換し、次の月の1日前の日付を計算
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $sql .= " AND register BETWEEN '{$startDate}' AND '{$endDate}'";
        } elseif ($startMonth == "" && $endMonth != "") {
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $sql .= " AND register BETWEEN '2025/01/01' AND '{$endDate}'";
        }
         } else {
            if ($startMonth != "" && $endMonth != "") {
            $sql .= " AND register LIKE '%{$startMonth}%'";
        }}
    if ($shop != null) {
        $shopSearch = $shop == "グループ全体" ? "" : $shop;
        $sql .= " AND shop LIKE '%{$shopSearch}%'";
    }
    if ($rank != null) {
        $sql .= " AND rank LIKE '%{$rank}%'";
    }
    if ($medium != null) {
        $mediumSearch = str_replace("'", "''", $medium);
        $sql .= " AND medium LIKE '%{$mediumSearch}%'";
    }

    // GROUP BY を追加
    $sql .= " GROUP BY medium";

    // ORDER BY を追加
    $orderClauses = [];
    if ($data['registerSort'] != "") {
        $orderClauses[] = "register_count {$data['registerSort']}";
    }
    if ($data['reserveSort'] != "") {
        $orderClauses[] = "reserve_count {$data['reserveSort']}";
    }
    if ($data['contractSort']  != "") {
        $orderClauses[] = "contract_count {$data['contractSort']}";
    }
    if (!empty($orderClauses)) {
        $sql .= " ORDER BY " . implode(', ', $orderClauses);
    } else {
        $sql .= " ORDER BY register_count DESC";
    }

    // SQLクエリの実行
    $stmt = $pdo->prepare($sql);
    $stmt->execute($mediums);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);


    // 全媒体合計クエリを追加
    if( $medium == ""){$totalSql = "SELECT
            '全媒体合計' AS medium,
                COUNT(register) AS register_count,
                COUNT(CASE WHEN reserve LIKE '%20%' THEN 1 END) AS reserve_count,
                COUNT(CASE WHEN status = '契約済み' THEN 1 END) AS contract_count,
                COUNT(CASE WHEN rank = 'Aランク' THEN 1 END) AS rankA_count,
                COUNT(CASE WHEN rank = 'Bランク' THEN 1 END) AS rankB_count,
                COUNT(CASE WHEN rank = 'Cランク' THEN 1 END) AS rankC_count,
                COUNT(CASE WHEN rank = 'Dランク' THEN 1 END) AS rankD_count,
                COUNT(CASE WHEN rank = 'Eランク' THEN 1 END) AS rankE_count,
                (SELECT SUM(budget_value) FROM budget";

    $totalConditions = [];
    if ($shop != null) {
        $shopSearch = $shop == "グループ全体" ? "" : $shop;
        $totalConditions[] = " budget.shop LIKE '%{$shopSearch}%' ";
    }

    if( $startMonth != $endMonth ) {
        if ($startMonth != "" && $endMonth != "") {
            $startDate = $startMonth . '/01'; // 例: '2025/01/01'
            
            // endMonthをyyyy/MM/01形式に変換し、次の月の1日前の日付を計算
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $totalConditions[] =  " budget.budget_period BETWEEN '{$startDate}' AND '{$endDate}'";
        } elseif ($startMonth == "" && $endMonth != "") {
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $totalConditions[] =  " budget.budget_period BETWEEN '2025/01/01' AND '{$endDate}'";
        }
         } else {
            if ($startMonth != "" && $endMonth != "") {
            $totalConditions[] =  " budget.budget_period LIKE '%{$startMonth}%'";
        }}
    if (count($totalConditions) > 0) {
            $totalSql .= " WHERE " . implode(' AND ', $totalConditions);
    }

    $totalSql .=") AS total_budget
            FROM
                customers";

    // 全媒体合計の条件を追加
    $conditions = [];
    if ($shop != null) {
        $shopSearch = $shop == "グループ全体" ? "" : $shop;
        $conditions[] = " shop LIKE '%{$shopSearch}%'";
    }
    if ($rank != null) {
        $rankSearch = $rank;
        $conditions[] = "rank LIKE '%{$rankSearch}%'";
    }
    if ($medium != null) {
        $mediumSearch = str_replace("'", "''", $medium);
        $conditions[] = "medium LIKE '%{$mediumSearch}%'";
    }
    if( $startMonth != $endMonth ) {
        if ($startMonth != "" && $endMonth != "") {
            $startDate = $startMonth . '/01'; // 例: '2025/01/01'
            
            // endMonthをyyyy/MM/01形式に変換し、次の月の1日前の日付を計算
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $conditions[] =  " register BETWEEN '{$startDate}' AND '{$endDate}'";
        } elseif ($startMonth == "" && $endMonth != "") {
            $date = DateTime::createFromFormat('Y/m', $endMonth);
            $date->modify('last day of this month');
            $endDate = $date->format('Y/m/d'); 
        
            $conditions[] =  " register BETWEEN '2025/01/01' AND '{$endDate}'";
        }
         } else {
            if ($startMonth != "" && $endMonth != "") {
            $conditions[] =  " register LIKE '%{$startMonth}%'";
        }}

    // 条件がある場合に WHERE を追加
    if (count($conditions) > 0) {
        $totalSql .= " WHERE " . implode(' AND ', $conditions);
    }

    $total_stmt = $pdo->prepare($totalSql);
    $total_stmt->execute();
    $total_customers = $total_stmt->fetchAll(PDO::FETCH_ASSOC);

    // 全媒体合計を結果にマージ
    $customers = array_merge($total_customers, $customers);
}

    // 結果の計算
    foreach ($customers as &$customer) {
        $customer['reserve_per'] = $customer['register_count'] != 0 && $customer['reserve_count'] != 0
            ? round(100 * ($customer['reserve_count'] / $customer['register_count']), 1)
            : 0;

        $customer['contract_per'] = $customer['reserve_count'] != 0 && $customer['contract_count'] != 0
            ? round(100 * ($customer['contract_count'] / $customer['reserve_count']),  1)
            : 0;
        
        $customer['total_budget'] = $customer['total_budget'] == null ? 0 : $customer['total_budget'];
        
        $customer['register_cost'] = $customer['total_budget'] != 0 && $customer['register_count'] != 0
        ? number_format(round(($customer['total_budget'] / $customer['register_count']), 0))
        : 0;
        
        $customer['reserve_cost'] = $customer['total_budget'] != 0 && $customer['reserve_count'] != 0
            ? number_format(round(($customer['total_budget'] / $customer['reserve_count']), 0))
            : 0;

        $customer['contract_cost'] = $customer['total_budget'] != 0 && $customer['contract_count'] != 0
            ? number_format(round(($customer['total_budget'] / $customer['contract_count']), 0))
            : 0;

        $customer['total_budget'] = $customer['total_budget'] == null ? '0' : number_format($customer['total_budget']);
    }

    // デバッグのためのログ出力
    error_log(json_encode($customers));

    // 結果をJSON形式で出力
    echo json_encode($customers);
} catch (PDOException $e) {
    // エラーハンドリング
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
