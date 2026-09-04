<?php

declare(strict_types=1);

/**
 * ポータル反響のバルク取り込み用の共通ヘルパー。
 *
 * 既存の handlers/*.php は同等の関数を各ファイルに複製しているが、
 * 挙動を変えないため既存ファイルには手を入れず、新規ハンドラのみがこのファイルを利用する。
 */

if (!function_exists('portalFilterAllowed')) {
    /**
     * 許可カラムのみを抽出し、欠けているカラムは $default で埋める。
     * 注文事業の *_db は NOT NULL カラムを含むため、既定値に空文字を渡して使う。
     */
    function portalFilterAllowed(array $row, array $allowed, $default = null): array
    {
        $out = [];
        foreach ($allowed as $col) {
            $out[$col] = array_key_exists($col, $row) ? $row[$col] : $default;
        }
        return $out;
    }
}

if (!function_exists('portalNormalizeRow')) {
    /**
     * 前後空白と Excel 由来の先頭シングルクォートを除去する。
     * $nullifyEmpty が true のときのみ空文字を NULL に変換する
     * （注文事業の *_db は NOT NULL カラムを含むため false で使う）。
     */
    function portalNormalizeRow(array $row, bool $nullifyEmpty = true): array
    {
        foreach ($row as $k => $v) {
            if ($v === null) {
                $row[$k] = $nullifyEmpty ? null : '';
                continue;
            }
            if (is_string($v)) {
                $v = trim($v);
                if ($v !== '' && $v[0] === "'") {
                    $v = ltrim($v, "'");
                }
            }
            $row[$k] = ($v === '' && $nullifyEmpty) ? null : $v;
        }
        return $row;
    }
}

if (!function_exists('portalReadBulkPayload')) {
    /**
     * gateway から渡された {request, data[]} を検証して data を返す。
     * 検証に失敗した場合は JSON を出力して処理を終了する。
     */
    function portalReadBulkPayload(string $expectedRequest): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'message' => 'No input received']);
            exit;
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            http_response_code(400);
            echo json_encode([
                'ok' => false,
                'message' => 'Invalid JSON',
                'json_error' => json_last_error_msg()
            ]);
            exit;
        }

        $rows = $payload['data'] ?? null;
        if (($payload['request'] ?? null) !== $expectedRequest || !is_array($rows)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'message' => 'Invalid request or data missing']);
            exit;
        }

        return $rows;
    }
}

if (!function_exists('portalExistingKeys')) {
    /**
     * すでにテーブルに存在するキーを1クエリでまとめて取得する。
     *
     * ⚠️⚠️ **完全一致で照合すること。**
     *   移植元の旧APIは `WHERE id_suumo LIKE '%{$id}%'` という部分一致で、
     *   `123` が `1234` にも当たって別人を「既存」と誤判定していた。
     *
     * @param string[] $keys 照合したい値
     * @return array<string,true> 存在した値をキーに持つ連想配列（in_array より速い）
     */
    function portalExistingKeys(PDO $pdo, string $table, string $keyColumn, array $keys): array
    {
        $found = [];
        if (count($keys) === 0) {
            return $found;
        }

        // ⚠️ プレースホルダ数には上限があるため分割する。
        //   1回の取り込みは500件単位だが、将来増やされても壊れないようにしておく。
        foreach (array_chunk($keys, 500) as $chunk) {
            $placeholders = implode(', ', array_fill(0, count($chunk), '?'));
            $sql = "SELECT `{$keyColumn}` FROM `{$table}` WHERE `{$keyColumn}` IN ({$placeholders})";

            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_values($chunk));

            foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $value) {
                $found[(string)$value] = true;
            }
        }

        return $found;
    }
}

if (!function_exists('portalRequiredColumns')) {
    /**
     * NOT NULL かつ既定値の無いカラムと、その穴埋め用の値を返す。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **sql_mode への依存を断つためのもの。**
     *
     *   inquiry_customer には NOT NULL・既定値なしのカラムが 42 本あるが、
     *   ハンドラが指定するのは 13〜15 本しかない。
     *   これが通っているのは ① レンタルサーバーの sql_mode が
     *   **非 strict** で、足りない値を MySQL が黙って補っているからである。
     *
     *   サーバー設定が変わった瞬間に
     *     SQLSTATE[HY000]: General error: 1364 Field 'pg_id' doesn't have a default value
     *   で**取り込みが全件失敗する。**（ローカルの MariaDB は strict のため実際に再現する）
     *
     *   ここで明示的に埋めておけば、どちらの設定でも同じ結果になる。
     *   埋める値は非 strict 時に MySQL が入れるものと同じ（text→'' / 数値→0）なので、
     *   本番の既存データとの一貫性も保たれる。
     * ─────────────────────────────────────────────
     *
     * @return array<string,mixed> カラム名 => 穴埋め値
     */
    function portalRequiredColumns(PDO $pdo, string $table): array
    {
        // テーブル定義は取り込み中に変わらない。1リクエストにつき1回だけ引く
        static $cache = [];
        if (isset($cache[$table])) {
            return $cache[$table];
        }

        $sql = "SELECT COLUMN_NAME, DATA_TYPE
                  FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = ?
                   AND IS_NULLABLE = 'NO'
                   AND COLUMN_DEFAULT IS NULL
                   AND EXTRA NOT LIKE '%auto_increment%'";

        $defaults = [];
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$table]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
                $type = strtolower((string)$col['DATA_TYPE']);
                $isNumeric = in_array(
                    $type,
                    ['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'decimal', 'float', 'double'],
                    true
                );
                $defaults[(string)$col['COLUMN_NAME']] = $isNumeric ? 0 : '';
            }
        } catch (Throwable $e) {
            // ⚠️ 取得できなくても取り込みは止めない。
            //   非 strict の本番では今までどおり動く（穴埋めが無いだけ）。
            error_log("portalRequiredColumns: {$table} の列情報を取得できませんでした: " . $e->getMessage());
        }

        $cache[$table] = $defaults;
        return $defaults;
    }
}

if (!function_exists('portalInsertNewOnly')) {
    /**
     * 未登録のレコードだけを INSERT する（存在確認方式）。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **これがポータル取り込みの重複対策の本体である。**
     *
     *   以前は `INSERT IGNORE` / `ON DUPLICATE KEY UPDATE` を使っていたが、
     *   これらは**UNIQUEキーが無いと何も無視しない。**
     *   対象5テーブルはいずれも PRIMARY(id) しか持たないため、
     *   実行のたびに全件がそのまま追加されていた。
     *
     *   この方式は UNIQUEキーに依存しないため、
     *   **重複データを掃除する前でも適用できる**（DDLとの循環を断てる）。
     * ─────────────────────────────────────────────
     *
     * ⚠️ **チャンク内の重複も畳む。** 同じCSVに同じIDが複数行含まれることがあり
     *   （本番の homes_db で実際に発生した）、DB側の存在確認だけでは防げない。
     *   先に現れた行を採用する。
     *
     * ⚠️ 既存レコードは**更新しない。** ポータル側で値が変わっても反映されない。
     *   これは意図した仕様（案A）である。理由は portalRunBulkImport のコメント参照。
     */
    function portalInsertNewOnly(PDO $pdo, string $table, array $rows, string $keyColumn): array
    {
        $summary = ['processed' => 0, 'skipped' => 0, 'errors' => []];
        if (count($rows) === 0) {
            return $summary;
        }

        // 1) チャンク内の重複を先に畳む（先勝ち）
        $unique = [];
        foreach ($rows as $row) {
            $key = trim((string)($row[$keyColumn] ?? ''));
            if ($key === '' || isset($unique[$key])) {
                continue;
            }
            $unique[$key] = $row;
        }

        if (count($unique) === 0) {
            return $summary;
        }

        // 2) DBに既にあるものを除く
        try {
            $existing = portalExistingKeys($pdo, $table, $keyColumn, array_keys($unique));
        } catch (Throwable $e) {
            $summary['errors'][] = '既存レコードの確認に失敗: ' . $e->getMessage();
            return $summary;
        }

        $newRows = [];
        foreach ($unique as $key => $row) {
            if (isset($existing[$key])) {
                continue;
            }
            $newRows[] = $row;
        }

        $summary['skipped'] = count($rows) - count($newRows);

        if (count($newRows) === 0) {
            return $summary;
        }

        // 3) NOT NULL・既定値なしのカラムを埋める（sql_mode に依存させないため）
        //
        // ⚠️ ハンドラが指定していない列だけを補う。指定済みの値は上書きしない。
        $required = portalRequiredColumns($pdo, $table);
        if (count($required) > 0) {
            foreach ($newRows as $i => $row) {
                foreach ($required as $col => $fill) {
                    if (!array_key_exists($col, $row)) {
                        $newRows[$i][$col] = $fill;
                    }
                }
            }
        }

        // 4) 残ったものだけを INSERT
        //
        // ⚠️ INSERT IGNORE にしないこと。自前で重複を除いた後なので、
        //   ここで起きるエラーは桁あふれや型不一致といった**本物の異常**である。
        //   IGNORE にすると黙って捨てられ、取り込み漏れに気づけなくなる。
        $cols = array_keys($newRows[0]);
        $colSql = "`" . implode("`, `", $cols) . "`";

        $placeholders = [];
        $params = [];
        foreach ($newRows as $i => $row) {
            $placeholders[] = "(" . implode(", ", array_map(fn($c) => ":" . $c . "_" . $i, $cols)) . ")";
            foreach ($cols as $c) {
                $params[":" . $c . "_" . $i] = $row[$c] ?? null;
            }
        }

        $sql = "INSERT INTO `{$table}` ($colSql) VALUES " . implode(", ", $placeholders);

        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $summary['processed'] = count($newRows);
        } catch (Throwable $e) {
            $summary['errors'][] = $e->getMessage();
        }

        return $summary;
    }
}

if (!function_exists('portalSplitName')) {
    /**
     * 氏名を区切り文字で姓・名に分割する。
     * 区切りが無い場合は [全体, ''] を返す（移植元の explode(...)[1] ?? '' と同じ挙動）。
     */
    function portalSplitName(?string $name, string $delimiter): array
    {
        $name = trim((string)$name);
        if ($name === '') {
            return ['', ''];
        }
        $parts = explode($delimiter, $name);
        return [$parts[0] ?? '', $parts[1] ?? ''];
    }
}

if (!function_exists('portalRunBulkImport')) {
    /**
     * 生データテーブルへの取り込みと inquiry_customer への取り込みをまとめて実行する。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **何回同じデータを送っても結果が変わらない（冪等）。**
     *
     *   これが最も重要な性質である。ポータル側は毎回「一覧の全件」を
     *   ダウンロードして送ってくるうえ、sync 側（postGateway.ts）は
     *   **タイムアウトでも最大3回まで再送する。**
     *   サーバーが挿入を終えた直後に応答が遅れると同じ500件が再び届くため、
     *   冪等でないと実行のたびに顧客が増え続ける。
     * ─────────────────────────────────────────────
     *
     * ⚠️ **既存レコードは更新しない（新規のみ INSERT）。**
     *   ポータル側で後から値が変わっても反映されない。これは意図した仕様。
     *
     *   理由: ALLGRIT は `date_allGrit`（LINE登録日）を**取り込んだ当日で
     *   上書きする**仕様のため（移植元の reloadAllgrit.js からの挙動）、
     *   既存行を更新すると **実行のたびに過去の反響日が今日へ書き換わる。**
     *   反響日は分析の基準になるため、これが壊れると集計が丸ごと狂う。
     *
     *   ⚠️ 副作用として、ポータル側でステータス（status_townlife 等）が
     *   更新されても *_db には反映されない。更新が必要になったら、
     *   日付列を除外したうえで UPDATE を足すこと。全列更新に戻してはいけない。
     *
     * @param string   $keyColumn  存在確認に使う *_db 側のカラム（id_suumo 等）
     * @param callable $toInquiry  1レコードを inquiry_customer 用の連想配列へ変換する。
     *                             取り込み対象外なら null を返す。
     */
    function portalRunBulkImport(
        PDO $pdo,
        array $rows,
        string $table,
        array $allowedColumns,
        string $keyColumn,
        callable $toInquiry
    ): array {
        $summary = [
            'processed'        => 0,
            'skipped'          => 0,
            'inquiry_inserted' => 0,
            'inquiry_skipped'  => 0,
            'errors'           => [],
        ];
        $batchSize = 500;

        foreach (array_chunk($rows, $batchSize) as $chunk) {
            $rawRows = [];
            $inquiryRows = [];

            foreach ($chunk as $row) {
                if (!is_array($row)) {
                    continue;
                }
                // *_db / inquiry_customer とも NOT NULL カラムを含むため空文字のまま投入する
                $rawRows[] = portalNormalizeRow(portalFilterAllowed($row, $allowedColumns, ''), false);

                $inquiry = $toInquiry($row);
                if (is_array($inquiry) && ($inquiry['inquiry_id'] ?? '') !== '') {
                    $inquiryRows[] = $inquiry;
                }
            }

            try {
                $pdo->beginTransaction();

                $res = portalInsertNewOnly($pdo, $table, $rawRows, $keyColumn);
                $inquiryRes = portalInsertNewOnly($pdo, 'inquiry_customer', $inquiryRows, 'inquiry_id');

                if (!empty($res['errors']) || !empty($inquiryRes['errors'])) {
                    // ⚠️ 生データと顧客はまとめて巻き戻す。
                    //   片方だけ入ると、次回の存在確認で「済んでいる」と判定され、
                    //   もう片方が永久に取り込まれない。
                    $pdo->rollBack();
                    $summary['errors'] = array_merge(
                        $summary['errors'],
                        $res['errors'],
                        $inquiryRes['errors']
                    );
                } else {
                    $pdo->commit();
                    $summary['processed']        += $res['processed'];
                    $summary['skipped']          += $res['skipped'];
                    $summary['inquiry_inserted'] += $inquiryRes['processed'];
                    $summary['inquiry_skipped']  += $inquiryRes['skipped'];
                }
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $summary['errors'][] = $e->getMessage();
            }
        }

        return $summary;
    }
}
