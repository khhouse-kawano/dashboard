<?php

// ============================================================================
// data.json / app_state.json の一括取り込み
//
//   data.json      : Supabase records の書き出し [{id, kind, data:{...}}]
//   app_state.json : Supabase app_state の書き出し [{key, data:{...}}]
//
//   どちらも `id` / `key` をキーにした UPSERT で取り込む。
//   **DELETE は行わない。** JSON に無い行は DB に残る。
//   本番で誤って全消しにならないよう、意図的に削除機能を持たせていない。
//
// 実行方法
//   CLI（推奨）: php addTale.php
//   Web        : POST { "request":"addTale", "confirm":"IMPORT" }
//
//   Web から実行するときに confirm を必須にしているのは、URL を叩いただけで
//   本番データが一括上書きされる事故を防ぐため。
// ============================================================================

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    // index.php 経由の場合 $data にリクエストボディが入っている
    $confirm = $data['confirm'] ?? null;
    if ($confirm !== 'IMPORT') {
        http_response_code(400);
        echo json_encode(
            ['status' => 'error', 'message' => '取り込みを実行するには confirm:"IMPORT" が必要です'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
}

// ----------------------------------------------------------------------------
// 1. DB 接続
//    index.php 経由なら core/db.php が作った $pdo をそのまま使う。
//    CLI から直接叩いたときだけ、環境変数を読んで自前で接続する。
//    接続情報をこのファイルに直書きしない（本番の認証情報がリポジトリに入るため）。
// ----------------------------------------------------------------------------
//
//    CLI での接続情報の指定方法（上から優先）
//      1. コマンドライン引数   php addTale.php --host=localhost --db=名 --user=名
//      2. 環境変数             DB_HOST=... DB_NAME=... php addTale.php
//      3. .env ファイル        APP_ENV_FILE=/path/to/.env php addTale.php
//                              または backend/.env に置けば自動で読まれる
//
//    本番(XServer)の .htaccess の SetEnv は **Web リクエストにしか効かない**。
//    CLI では環境変数が空のままなので、上のいずれかで明示的に渡す必要がある。
if (!isset($pdo) || !($pdo instanceof PDO)) {
    // --key=value 形式の引数を拾う
    $options = [];
    if ($isCli && isset($argv)) {
        foreach (array_slice($argv, 1) as $arg) {
            if (preg_match('/^--([A-Za-z_][A-Za-z0-9_-]*)=(.*)$/s', $arg, $m)) {
                $options[$m[1]] = $m[2];
            }
        }
    }

    // --env=... が指定されていれば、env.php より先に読み込み先を固定する
    if (isset($options['env']) && $options['env'] !== '') {
        putenv('APP_ENV_FILE=' . $options['env']);
    }

    require_once __DIR__ . '/../core/env.php';

    // 引数 → 環境変数 の順に採用する
    $pick = function ($optionKey, $envKey) use ($options) {
        if (isset($options[$optionKey]) && $options[$optionKey] !== '') {
            return $options[$optionKey];
        }
        $value = getenv($envKey);
        return ($value === false || $value === '') ? null : $value;
    };

    $host = $pick('host', 'DB_HOST');
    $dbname = $pick('db', 'DB_NAME');
    $user = $pick('user', 'DB_USER');
    $pass = $pick('pass', 'DB_PASS');

    // パスワードだけは対話入力もできるようにする。
    // コマンドラインに書くとシェル履歴と ps の出力に残るため。
    // stream_isatty() は PHP 7.2 以降。無い環境では posix_isatty で代替する
    $isTty = function_exists('stream_isatty')
        ? @stream_isatty(STDIN)
        : (function_exists('posix_isatty') ? @posix_isatty(STDIN) : false);

    if ($pass === null && $isCli && $isTty) {
        fwrite(STDOUT, 'DBパスワード: ');
        @shell_exec('stty -echo 2>/dev/null');
        $pass = rtrim((string) fgets(STDIN), "\r\n");
        @shell_exec('stty echo 2>/dev/null');
        fwrite(STDOUT, "\n");
    }

    if (!$host || !$dbname || !$user) {
        $missing = [];
        if (!$host) $missing[] = 'DB_HOST (--host)';
        if (!$dbname) $missing[] = 'DB_NAME (--db)';
        if (!$user) $missing[] = 'DB_USER (--user)';

        $message = "接続情報が不足しています: " . implode(', ', $missing) . "\n\n"
            . "指定方法のいずれかを使ってください:\n"
            . "  1) php addTale.php --host=localhost --db=DB名 --user=ユーザー名\n"
            . "     （--pass を省略するとパスワードを聞かれます）\n"
            . "  2) DB_HOST=... DB_NAME=... DB_USER=... DB_PASS=... php addTale.php\n"
            . "  3) php addTale.php --env=/path/to/.env\n\n"
            . ".htaccess の SetEnv は Web リクエスト専用で、CLI には効きません。\n";
        fwrite(STDERR, $message);
        exit(1);
    }

    try {
        $pdo = new PDO("mysql:host={$host};dbname={$dbname};charset=utf8mb4", $user, (string) $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        fwrite(STDERR, 'DB接続エラー: ' . $e->getMessage() . "\n");
        exit(1);
    }

    out("接続先: {$user}@{$host}/{$dbname}");
}

$tableName = 'brokerage_listings';

// ----------------------------------------------------------------------------
// 2. 取り込みを許可するカラム
//    ここに無いキーは無視される（raw_data には原本が残るので情報は失われない）。
//    テーブルにカラムを追加したら、ここと broker_update.php の両方に追加すること。
// ----------------------------------------------------------------------------
$allowedColumns = [
    // 共通
    'kind', 'id', 'no', 'freq', 'note', 'staff', 'category', 'phase', 'priority', 'type',
    // 物件・所在
    'addr1', 'addr2', 'addr', 'property', 'targetProperty', 'propName',
    // 金額
    'price', 'budget', 'fee', 'feeManual',
    // 顧客・反響元
    'portal', 'seller', 'buyer', 'customer', 'name', 'source', 'contact', 'phone', 'mail',
    // 媒介台帳
    'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus',
    'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate',
    // 商談・紐付け
    'endReason', 'ledgerNo', 'ledgerId', 'extId', 'dealId', 'dealNo',
    'subStaff', 'subRatio', 'coBroker', 'delivery',
    // 日付
    'receivedDate', 'connectDate', 'contactDate', 'visitDate', 'viewDate', 'baikaiDate',
    'contractDate', 'settleDate', 'followDate', 'inputDate', 'renewDate',
    'applicationDate', 'nextDate', 'nextNote',
    // 追客
    'callDates', 'reason', 'timing',
    // 買取再販
    'status', 'costs', 'targetGp',
    'buyPrice', 'buyBuilding', 'buySellerReg', 'buyStockAsset',
    'taxCheckDate', 'buyContractDate', 'buySettleDate',
    'listPrice', 'listDate',
    'sellPrice', 'sellBuilding', 'sellStaff', 'sellContractDate', 'sellSettleDate',
    // 監査ログ・通知
    'at', 'to', 'from', 'field', 'label', 'entity', 'entityId', 'entityNo',
    'title', 'body', 'read', 'by', 'data', 'updatedAt',
    // 契約書の下書き
    'docDraft', 'docDraftAt', 'docDraftBy',
    // 表示制御・論理削除
    'show_dashboard', 'deleted_at', 'deleted_by',
    // 外部DB連携
    'master_data_id', 'property_db_id', 'property_db_name',
    // 原本
    'raw_data',
];
$allowedSet = array_flip($allowedColumns);

// DATE 型のカラム。'最終買取へ' のような自由入力が混ざっていると
// Strict Mode で INSERT ごと失敗するため、日付として読めない値は NULL にする。
$dateColumns = array_flip([
    'reinsDate', 'contractDate', 'priceRevDate', 'lastReportDate', 'followDate',
    'settleDate', 'contactDate', 'visitDate', 'connectDate', 'receivedDate',
    'viewDate', 'inputDate', 'renewDate', 'baikaiDate', 'nextDate', 'expiry',
    'taxCheckDate', 'buyContractDate', 'buySettleDate', 'listDate',
    'sellContractDate', 'sellSettleDate',
]);

// 数値カラム。ledger の no に "to" が入っている等の実データがあるため、
// 数値として読めない値は NULL にして取り込みを止めない。
$intColumns = array_flip([
    'no', 'price', 'budget', 'fee', 'subRatio', 'entityNo', 'targetGp',
    'buyPrice', 'buyBuilding', 'listPrice', 'sellPrice', 'sellBuilding',
    'feeManual', 'expiryFix', 'buyStockAsset', 'read', 'show_dashboard',
]);

// ----------------------------------------------------------------------------
// 3. ヘルパー
// ----------------------------------------------------------------------------
$warnings = [];

/** 出力（CLI はプレーンテキスト、Web は改行タグ付き） */
function out($message)
{
    echo $message . (PHP_SAPI === 'cli' ? "\n" : "<br>\n");
}

/** JSON ファイルを読んで配列で返す。読めなければ処理を止める。 */
function loadJson($path)
{
    if (!is_file($path)) {
        out("ファイルが見つかりません: {$path}");
        return [];
    }
    $decoded = json_decode((string) file_get_contents($path), true);
    if (!is_array($decoded)) {
        out("JSONのデコードに失敗しました: {$path}");
        return [];
    }
    // 単一オブジェクトで書かれていても配列として扱えるようにする
    return isset($decoded[0]) || $decoded === [] ? $decoded : [$decoded];
}

// ----------------------------------------------------------------------------
// 4. brokerage_listings の取り込み
// ----------------------------------------------------------------------------
$records = loadJson(__DIR__ . '/data.json');
out('data.json: ' . count($records) . ' 件を読み込みました');

$inserted = 0;
$skipped = 0;

if ($records) {
    // 1件ずつコミットすると 1,000 件超で遅く、途中で落ちると中途半端な状態になる。
    // 全体を1トランザクションにまとめ、失敗したら丸ごと巻き戻す。
    $pdo->beginTransaction();

    try {
        foreach ($records as $item) {
            $id = $item['id'] ?? null;
            if (!$id) {
                $skipped++;
                $warnings[] = 'id が無いレコードを飛ばしました';
                continue;
            }

            $payload = is_array($item['data'] ?? null) ? $item['data'] : [];

            // records の id / kind を正とする（data 側と食い違っても外側を優先）
            $row = [
                'id' => $id,
                'kind' => $item['kind'] ?? ($payload['kind'] ?? null),
                // 個別カラムに受け皿が無いフィールドが増えても復元できるよう原本を持つ
                'raw_data' => $payload ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            ];

            foreach ($payload as $key => $value) {
                if ($key === 'id' || $key === 'kind') {
                    continue;
                }
                if (!isset($allowedSet[$key])) {
                    continue;   // 対応カラム無し。raw_data には残っている
                }

                if ($value === '' || $value === null) {
                    $row[$key] = null;
                    continue;
                }

                if (isset($dateColumns[$key])) {
                    // 'YYYY-MM-DD' または 'YYYY-MM-DDTHH:mm' の先頭10文字だけ採用
                    if (preg_match('/^(\d{4}-\d{2}-\d{2})/', (string) $value, $m)) {
                        $row[$key] = $m[1];
                    } else {
                        $row[$key] = null;
                        $warnings[] = "{$id}.{$key}: 日付として読めない値を NULL にしました（" . (string) $value . '）';
                    }
                    continue;
                }

                if (isset($intColumns[$key])) {
                    if (is_bool($value)) {
                        $row[$key] = $value ? 1 : 0;
                    } elseif (is_numeric($value)) {
                        $row[$key] = $value + 0;
                    } else {
                        $row[$key] = null;
                        $warnings[] = "{$id}.{$key}: 数値として読めない値を NULL にしました（" . (string) $value . '）';
                    }
                    continue;
                }

                if (is_array($value) || is_object($value)) {
                    // callDates / costs / coBroker / data など。JSON 文字列で保持する
                    $row[$key] = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } elseif (is_bool($value)) {
                    $row[$key] = $value ? 1 : 0;
                } else {
                    $row[$key] = $value;
                }
            }

            // アロー関数 fn() は PHP 7.4 以降なので、古い CLI でも動くよう foreach で組み立てる
            $columns = array_keys($row);
            $escaped = [];
            $holders = [];
            $updates = [];
            foreach ($columns as $column) {
                $escaped[] = "`{$column}`";
                $holders[] = ":{$column}";
                // id は突合キーなので更新対象から外す
                if ($column !== 'id') {
                    $updates[] = "`{$column}` = VALUES(`{$column}`)";
                }
            }

            $sql = sprintf(
                'INSERT INTO `%s` (%s) VALUES (%s) ON DUPLICATE KEY UPDATE %s',
                $tableName,
                implode(', ', $escaped),
                implode(', ', $holders),
                implode(', ', $updates)
            );

            $stmt = $pdo->prepare($sql);
            $stmt->execute($row);
            $inserted++;
        }

        $pdo->commit();
        out("brokerage_listings: {$inserted} 件を登録/更新しました（スキップ {$skipped} 件）");
    } catch (PDOException $e) {
        $pdo->rollBack();
        out('brokerage_listings の取り込みに失敗したため、すべて巻き戻しました: ' . $e->getMessage());
        if ($isCli) {
            exit(1);
        }
        exit;
    }
}

// ----------------------------------------------------------------------------
// 5. app_state の取り込み
// ----------------------------------------------------------------------------
$states = loadJson(__DIR__ . '/app_state.json');
$stateCount = 0;

if ($states) {
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO `app_state` (`key`, `data`) VALUES (:key, :data)
             ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)'
        );

        foreach ($states as $state) {
            $key = $state['key'] ?? null;
            if (!$key || !isset($state['data'])) {
                continue;
            }
            $stmt->execute([
                'key' => $key,
                'data' => json_encode($state['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
            $stateCount++;
        }

        out("app_state: {$stateCount} 件を登録/更新しました");
    } catch (PDOException $e) {
        out('app_state の取り込みに失敗しました: ' . $e->getMessage());
    }
}

// ----------------------------------------------------------------------------
// 6. 警告のまとめ
//    同じ理由の警告が大量に出ても読めるよう、先頭20件だけ表示する。
// ----------------------------------------------------------------------------
if ($warnings) {
    out('--- 警告 ' . count($warnings) . ' 件 ---');
    foreach (array_slice($warnings, 0, 20) as $warning) {
        out('  ' . $warning);
    }
    if (count($warnings) > 20) {
        out('  ... 他 ' . (count($warnings) - 20) . ' 件');
    }
}

out('全ての処理が完了しました。');
