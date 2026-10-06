# 2026-10-06 月次日報（daily_report）の軽量化（v2.2.167）

## 依頼（ReadMeClaude.md）
- `request: 'daily_report'` がメモリ容量を超えて DB からの応答が返らない。フロント・バックエンドを軽量化
- `targetDivision` の初期値を `'注文事業'` にし、変わるたびにリクエスト
- master_data / master_data_kaeru / master_data_resale は事業に応じて1表だけ返す
- interview_sheet / call_sheet は shop_list の division が一致する店舗の顧客だけ返す
- shop が抜けている顧客は、実装前にマスタ3表と ID を突合して shop を入れる

## 確認した回答
- 実装先: ⚠️ **① PHP のまま軽量化**（⚠️ Express 化はしていない。`daily_report` は ② に未登録）
- 月で絞る: ⚠️ **事業と月の両方で絞る**
- 「全事業部」: ⚠️ **なくす**

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend/src/handlers/` | `daily_report.php` | ⚠️ 全面書き換え。`division` / `month` を受け、1事業 × 1か月分だけ返す |
| `frontend/src/components/header/` | `DailyReports.tsx` | `targetDivision` 初期値、取得の useEffect（事業・月で取り直し）、「全事業部」削除 |
| `backend/scripts/sql/` | ⚠️ 新規 `2026-10-06_fill_sheet_shop.sql` | call_sheet / interview_sheet の空の shop をマスタの担当店舗で埋める（⚠️ ローカル投入済み） |
| `backend/scripts/sql/` | `2026-10-06_update_log_2.2.167.sql` | 文言に日報の修正を追記（⚠️ ローカルは UPDATE で揃え済み） |
| `docs/` | `deploy-v2.2.167.md` | 手順3〜5 を追加 |

## 調査（ローカルDB）
- 旧応答: ⚠️ **58.2MB**（call_log 36MB、interview_log 8.6MB、マスタ3表 約4万行）。⚠️ memory_limit 256M で本番が落ちる量。
- 事業だけで絞ると建売分譲事業の call_log が 19.7MB 残る → 月でも絞ることにした。
- shop が空: call_sheet 1,658 / interview_sheet 3,595（⚠️ ほぼかえるの顧客）。マスタ3表の間で id の重複は無し、master_data_resale 内に重複 id が1件。
- ⚠️ ログの day の書き方が揃っていない（⚠️ 1行の中でも混在）:
  `"day":"2026-09-01"` ／ `"day": "2025/06/29"`（⚠️ コロンの後に空白）／ `"day":"2025\/06\/01"`
  → 最初 LIKE `"day":"` 決め打ちにしたら中古リノベ 2025-06 で3件取りこぼした。⚠️ REGEXP に変更して解消。

## 結果（ローカル）

| 事業 | 月 | 応答 | 時間 |
|---|---|---|---|
| 旧（全件） | — | 58.2MB | 4〜7秒 |
| 注文事業 | 2026-09 | 841KB | 0.26秒 |
| 注文事業 | 2026-10 | 123KB | 0.19秒 |
| 建売分譲事業 | 2026-09 | 563KB | 0.31秒 |
| 中古リノベ | 2026-09 | 164KB | 0.15秒 |

- ⚠️ 画面の集計処理（aggregatedData）を写したスクリプトで、旧応答と新応答を ⚠️ **3事業 × 3か月（2026-09 / 2026-10 / 2025-06）** 比較 → ⚠️ **全て一致**（店舗別・スタッフ別・項目別の件数）。
- 不正な値（事業が空、`2026-13`、`master_data; DROP`）は 400。
- `php -l` 通過（PHP 8.2）。フロント build `main.06d387c9.js`。
- fill_sheet_shop.sql: call_sheet 空 1,658 → 566、interview_sheet 空 3,595 → 3,054。
  ⚠️ 表どうしを直接 JOIN する書き方では5分以上かかったため、⚠️ 主キー付きの一時テーブル経由に変更（約1.3秒）。

## 補足
- ⚠️ 「全事業部」をなくしたため、`DailyReports.tsx` の `!targetDivision && !targetShop` の分岐（事業別の行）は通らなくなった。指示に無いため消していない。
- staff_list は画面が使う列だけ・`report = 1` だけを返すようにした（⚠️ 以前は `SELECT *` でメールアドレス等も返していた）。

## コード

### backend/src/handlers/daily_report.php（全文）
```php
<?php
/**
 * 月次日報（frontend/src/components/header/DailyReports.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **1つの事業 × 1か月分だけを返す**（v2.2.167）。
 *
 *   以前は master_data 3表・call_sheet・interview_sheet を**全件**返しており、
 *   本番でメモリ上限を超えて応答が返らなくなった（ローカルでもログだけで約45MB）。
 *   ⚠️ **全件を返す形に戻してはならない。**
 *
 *   受け取るもの: { request: 'daily_report', division: '注文事業', month: '2026-10' }
 *   画面は事業か月を変えるたびに取り直す。
 *
 * ⚠️ call_sheet / interview_sheet は **shop で事業を判定する。** shop が空の行は
 *   どの事業にも入らない（2026-10-06_fill_sheet_shop.sql でマスタから埋めた）。
 * ⚠️ ログは**その月の分だけ**に削って返す。画面は日付で集計するだけなので結果は変わらない。
 * ⚠️ 返す形（キー名・call_log が JSON 文字列であること）は以前と同じにしてある。
 * ─────────────────────────────────────────────
 */
ini_set('memory_limit', '256M');

/**
 * 事業 → 反響を取るマスタと列。
 *
 * ⚠️ 列は以前の UNION ALL と同じ（⚠️ 第二面談・契約の列は事業ごとに違う）。
 * ⚠️ authority は画面がログイン中の事業（shopName）で絞るのに使う。
 */
$DIVISION_SOURCES = [
    '注文事業' => [
        'authority'   => 'order',
        'table'       => 'master_data',
        'appointment' => 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        'contract'    => 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    ],
    '建売分譲事業' => [
        'authority'   => 'spec',
        'table'       => 'master_data_kaeru',
        'appointment' => 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        'contract'    => 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
    ],
    '中古リノベ' => [
        'authority'   => 'used',
        'table'       => 'master_data_resale',
        'appointment' => 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
        'contract'    => 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    ],
];

/**
 * shop_list の店舗名 → call_sheet / interview_sheet に入っている元の名前。
 *
 * ⚠️ DailyReports.tsx の shopMapping の逆。⚠️ 片方だけ直すと中古リノベの行動量が消える。
 */
$RAW_SHOP_NAMES = [
    '中古住宅専門店' => ['買い:中古リノベ'],
    '不動産企画係'   => ['買い:ポータル', '売り:ポータル'],
];

$division = is_string($data['division'] ?? null) ? $data['division'] : '';
$month    = is_string($data['month'] ?? null) ? $data['month'] : '';

// ⚠️ 事業はテーブル名・列名に使うため、一覧にある値以外は受けない
if (!isset($DIVISION_SOURCES[$division]) || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => '事業または月の指定が正しくありません'], JSON_UNESCAPED_UNICODE);
    exit;
}

$source = $DIVISION_SOURCES[$division];
[$year, $mon] = explode('-', $month);

// マスタの日付は 2026/10/01 と 2026-10-01 が混在する
$dateLikeDash  = "{$year}-{$mon}-%";
$dateLikeSlash = "{$year}/{$mon}/%";

// ログ（JSON）の day をその月で拾う正規表現（行の絞り込み用。⚠️ 最終判定は PHP 側で行う）。
// ⚠️⚠️ 書き方が揃っていない。⚠️ 1つの行の中でも混ざっている:
//   "day":"2026-10-01" ／ "day": "2026/10/01"（⚠️ コロンの後に空白）／ "day":"2026\/10\/01"
//   ⚠️ LIKE で "day":" 決め打ちにすると空白ありの行を取りこぼす（2026-10-06 に中古リノベで3件ずれた）。
// ⚠️ プレースホルダで渡すので SQL のエスケープは掛からない。`\\\\` は正規表現の `\\`（= バックスラッシュ1文字）
$logRegexp = '"day"[[:space:]]*:[[:space:]]*"' . $year . '(-|\\\\?/)' . $mon . '(-|\\\\?/)';

// ---------------------------------------------------------------------
// 反響（その事業のマスタ1表。⚠️ その月の日付を1つでも持つ行だけ）
// ---------------------------------------------------------------------
$dateColumns = [
    'register'    => 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
    'interview'   => 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    'appointment' => $source['appointment'],
    'contract'    => $source['contract'],
];
$monthConditions = [];
$monthParams = [];
foreach ($dateColumns as $column) {
    $monthConditions[] = "{$column} LIKE ? OR {$column} LIKE ?";
    $monthParams[] = $dateLikeDash;
    $monthParams[] = $dateLikeSlash;
}
$selectDates = [];
foreach ($dateColumns as $alias => $column) {
    $selectDates[] = "{$column} AS {$alias}";
}

$sql_response = "SELECT
    ? AS authority,
    in_charge_store AS shop,
    in_charge_user AS staff,
    sales_promotion_name AS medium,
    " . implode(",\n    ", $selectDates) . "
FROM {$source['table']}
WHERE " . implode(' OR ', $monthConditions);
$stmt_response = $pdo->prepare($sql_response);
$stmt_response->execute(array_merge([$source['authority']], $monthParams));
$response_response = $stmt_response->fetchAll(PDO::FETCH_ASSOC);

// ---------------------------------------------------------------------
// 店舗・スタッフ（⚠️ 画面の事業の選択肢は shop_list から作るので全店舗を返す）
// ---------------------------------------------------------------------
$stmt_shop = $pdo->prepare("SELECT id, brand, shop, division, section, area, report_flag FROM shop_list");
$stmt_shop->execute();
$response_shop = $stmt_shop->fetchAll(PDO::FETCH_ASSOC);

// ⚠️ 画面が使う列だけ（⚠️ メールアドレスなどは返さない）
$stmt_staff = $pdo->prepare(
    "SELECT id, name, shop, section, period, status, report, position FROM staff_list WHERE report = 1"
);
$stmt_staff->execute();
$response_staff = $stmt_staff->fetchAll(PDO::FETCH_ASSOC);

// その事業の店舗（⚠️ 元の名前も含める）
$divisionShops = [];
foreach ($response_shop as $shop) {
    if ($shop['division'] !== $division || (int)$shop['report_flag'] !== 1) continue;
    $divisionShops[] = $shop['shop'];
    foreach ($RAW_SHOP_NAMES[$shop['shop']] ?? [] as $raw) $divisionShops[] = $raw;
}
$divisionShops = array_values(array_unique($divisionShops));

/**
 * call_sheet / interview_sheet から、その事業の店舗・その月のログだけを取る。
 *
 * ⚠️ fetchAll せず1行ずつ読み、その月のログだけを残す（⚠️ メモリ対策の本体）。
 * ⚠️ 画面が使う day / action / staff だけを残す（⚠️ note は長いので返さない）。
 * ⚠️ 返す形は以前と同じ { shop, <ログ列>: JSON文字列 }。
 */
$fetchMonthLogs = function (string $table, string $logColumn) use ($pdo, $divisionShops, $logRegexp, $month): array {
    if (count($divisionShops) === 0) return [];

    $shopHolders = implode(',', array_fill(0, count($divisionShops), '?'));
    $stmt = $pdo->prepare(
        "SELECT shop, {$logColumn} FROM {$table} WHERE shop IN ({$shopHolders}) AND {$logColumn} REGEXP ?"
    );
    $stmt->execute(array_merge($divisionShops, [$logRegexp]));

    $prefix = $month . '-';
    $rows = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $logs = json_decode($row[$logColumn] ?? '', true);
        if (!is_array($logs)) continue;

        $kept = [];
        foreach ($logs as $log) {
            if (!is_array($log)) continue;
            $day = str_replace('/', '-', (string)($log['day'] ?? ''));
            if (strpos($day, $prefix) !== 0) continue;
            $kept[] = [
                'day'    => $day,
                'action' => $log['action'] ?? null,
                'staff'  => $log['staff'] ?? null,
            ];
        }
        if (count($kept) === 0) continue;

        $rows[] = [
            'shop'     => $row['shop'],
            $logColumn => json_encode($kept, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
    }
    return $rows;
};

$result = [
    "response"  => $response_response,
    "call"      => $fetchMonthLogs('call_sheet', 'call_log'),
    "interview" => $fetchMonthLogs('interview_sheet', 'interview_log'),
    "shop"      => $response_shop,
    "staff"     => $response_staff,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
```

### DailyReports.tsx — `targetDivision` と取得の useEffect（修正後）
```tsx
     * 表示する事業（v2.2.167）。⚠️ **空（全事業部）にはしない。**
     * ⚠️ サーバーは1つの事業 × 1か月分だけを返す（⚠️ 全件だとメモリ上限を超えて応答が返らない）。
     * ⚠️ ログイン中の事業が決まっていればそこから開く。決まっていなければ注文事業。
     */
    const [targetDivision, setTargetDivision] = useState(() => authorityMapping[shopName || ''] ?? '注文事業');
    const [targetShop, setTargetShop] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [responseList, setResponseList] = useState<ResponseInfo[]>([]);
    const [callList, setCallList] = useState<CallInfo[]>([]);
    const [interviewList, setInterviewList] = useState<InterviewInfo[]>([]);
    const [shopList, setShopList] = useState<ShopInfo[]>([]);
    const [staffList, setStaffList] = useState<StaffInfo[]>([]);

    // ⚠️ ログイン中の事業が後から分かったとき（AuthContext の読み込み待ち）はそちらに合わせる
    useEffect(() => {
        const filteredDivision = authorityMapping[shopName || ''] ?? '';
        if (filteredDivision) setTargetDivision(filteredDivision);
    }, [shopName]);

    /**
     * 日報データ（v2.2.167）。⚠️ **事業か月が変わるたびに取り直す。**
     * ⚠️ サーバー（daily_report.php）はその事業の店舗・その月のログだけを返す。
     * ⚠️ 切り替えが続いたときに古い応答で上書きしないよう alive で捨てる。
     */
    useEffect(() => {
        let alive = true;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', {
                    request: 'daily_report',
                    division: targetDivision,
                    month: targetMonth,
                });
                if (!alive) return;
                if (response.data) {
                    const filteredResponse = (response.data.response || [])
                        .filter((r: ResponseInfo) => (!shopName || shopName === 'all') ? true : r.authority === shopName)
                        .map((r: ResponseInfo) => {
                            if (r.shop && shopMapping[r.shop]) {
                                return { ...r, shop: shopMapping[r.shop] };
                            }
                            return r;
                        });
                    setResponseList(filteredResponse);
                    setCallList(response.data.call || []);
                    setInterviewList(response.data.interview || []);
                    
                    setShopList((response.data.shop || []).filter((s: ShopInfo) => Number(s.report_flag) === 1));
                    const responseStaff = (response.data.staff || []).filter((s: StaffInfo) => Number(s.report) === 1)
                        .sort((a: StaffInfo, b: StaffInfo) => {
                            const positionA = positions.indexOf(a.position) !== -1 ? positions.indexOf(a.position) : 6;
                            const positionB = positions.indexOf(b.position) !== -1 ? positions.indexOf(b.position) : 6;
                            return positionA - positionB;
                        });
                    setStaffList(responseStaff || []);
                }
            } catch (error) {
                console.error("日報データの取得に失敗しました:", error);
            } finally {
                if (alive) setIsLoading(false);
            }
        };
        fetchData();
        return () => { alive = false; };
    }, [category, shopName, targetDivision, targetMonth]);
```

### DailyReports.tsx — 事業の select（修正後）
```tsx
                        {monthOptions.map(month => <option key={month} value={month}>{month.replace('-', '年')}月</option>)}
                    </select>

                    <select
                        className="form-select form-select-sm shadow-sm"
                        style={{ width: 'auto', cursor: 'pointer', minWidth: '130px' }}
                        value={targetDivision}
                        onChange={e => {
                            setTargetDivision(e.target.value);
                            setTargetShop('');
                        }}
                    >
                        {/* ⚠️ 「全事業部」は無い（v2.2.167。⚠️ 全事業を一度に取ると応答が返らない） */}
                        {divisions.map(div => <option key={div} value={div}>{div}</option>)}
                    </select>
```

### backend/scripts/sql/2026-10-06_fill_sheet_shop.sql（全文）
```sql
-- =====================================================================
-- call_sheet / interview_sheet の空の shop を、マスタの担当店舗で埋める（v2.2.167）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ **全文を1回で流すこと**
--   （一時テーブルは同じ接続の中でしか見えない。分けて流すと UPDATE が空振りする）。
-- ⚠️⚠️ **本番データの書き換え。** 流す前に「① 確認」だけを先に流して件数を控えること。
--
-- 目的: 月次日報（daily_report）を「事業の店舗」で絞って返すようにしたため、
--   shop が空の行は**どの事業にも入らず、日報から消える。** 先に埋めておく。
--
-- ⚠️ 埋めるのは **shop が空の行だけ**。入っている行は触らない。
-- ⚠️ マスタ側の担当店舗（in_charge_store）も空なら埋めない（そのまま残る）。
-- ⚠️ 同じ id がマスタに複数あり担当店舗が食い違うものは埋めない
--   （2026-10-06 時点で master_data_resale に重複 id が1件ある）。
-- ⚠️ id はマスタ3表の間で重複しない（2026-10-06 にローカルで確認）。
--
-- ⚠️⚠️ 各表の id は TEXT でインデックスが無い。表どうしを直接 JOIN すると
--   ローカルでも5分以上かかった（phpMyAdmin ではタイムアウトする）。
--   そのため id に主キーを付けた一時テーブルを経由する。
--
-- ローカル（2026-10-06）: call_sheet 空 1,658 → 566 ／ interview_sheet 空 3,595 → 3,054
-- =====================================================================

-- ① 確認（流す前）: shop が空の行数
SELECT 'call_sheet 空', COUNT(*) FROM call_sheet WHERE TRIM(shop) = ''
UNION ALL
SELECT 'interview_sheet 空', COUNT(*) FROM interview_sheet WHERE TRIM(shop) = '';

-- id → 担当店舗（マスタ3表）。⚠️ 担当店舗が1つに決まる id だけ
DROP TEMPORARY TABLE IF EXISTS tmp_customer_store;
CREATE TEMPORARY TABLE tmp_customer_store (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  store VARCHAR(255) NOT NULL
) DEFAULT CHARSET = utf8mb4;

INSERT INTO tmp_customer_store (id, store)
SELECT id, MAX(store) FROM (
  SELECT id, TRIM(in_charge_store) AS store FROM master_data
  WHERE TRIM(IFNULL(in_charge_store, '')) <> ''
  UNION ALL
  SELECT id, TRIM(in_charge_store) FROM master_data_kaeru
  WHERE TRIM(IFNULL(in_charge_store, '')) <> ''
  UNION ALL
  SELECT id, TRIM(in_charge_store) FROM master_data_resale
  WHERE TRIM(IFNULL(in_charge_store, '')) <> ''
) s
WHERE CHAR_LENGTH(id) <= 191
GROUP BY id
HAVING COUNT(DISTINCT store) = 1;

UPDATE call_sheet c
JOIN tmp_customer_store m ON m.id = c.id
SET c.shop = m.store
WHERE TRIM(c.shop) = '';

UPDATE interview_sheet c
JOIN tmp_customer_store m ON m.id = c.id
SET c.shop = m.store
WHERE TRIM(c.shop) = '';

DROP TEMPORARY TABLE IF EXISTS tmp_customer_store;

-- ② 確認（流した後）: shop が空の行数（⚠️ ① より減っていること）
SELECT 'call_sheet 空', COUNT(*) FROM call_sheet WHERE TRIM(shop) = ''
UNION ALL
SELECT 'interview_sheet 空', COUNT(*) FROM interview_sheet WHERE TRIM(shop) = '';
```
