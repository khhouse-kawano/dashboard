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

if (!function_exists('portalInsertBatchOnDuplicate')) {
    /**
     * ON DUPLICATE KEY UPDATE でバルク upsert する。
     * $keyColumns に指定したカラムは UPDATE 句から除外する（重複判定の軸のため）。
     */
    function portalInsertBatchOnDuplicate(PDO $pdo, string $table, array $rows, array $keyColumns = []): array
    {
        $summary = ['processed' => 0, 'errors' => []];
        if (count($rows) === 0) {
            return $summary;
        }

        $cols = array_keys($rows[0]);
        $colSql = "`" . implode("`, `", $cols) . "`";

        $updateParts = [];
        foreach ($cols as $c) {
            if (!in_array($c, $keyColumns, true)) {
                $updateParts[] = "`$c` = VALUES(`$c`)";
            }
        }
        // 全カラムがキーの場合でも構文を成立させる
        if (count($updateParts) === 0) {
            $updateParts[] = "`{$cols[0]}` = VALUES(`{$cols[0]}`)";
        }

        $placeholders = [];
        $params = [];
        foreach ($rows as $i => $row) {
            $placeholders[] = "(" . implode(", ", array_map(fn($c) => ":" . $c . "_" . $i, $cols)) . ")";
            foreach ($cols as $c) {
                $params[":" . $c . "_" . $i] = $row[$c];
            }
        }

        $sql = "INSERT INTO `{$table}` ($colSql) VALUES "
            . implode(", ", $placeholders)
            . " ON DUPLICATE KEY UPDATE " . implode(", ", $updateParts);

        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $summary['processed'] = count($rows);
        } catch (Throwable $e) {
            $summary['errors'][] = $e->getMessage();
        }

        return $summary;
    }
}

if (!function_exists('portalInsertBatchIgnore')) {
    /**
     * INSERT IGNORE でバルク投入する。
     * inquiry_customer のように「既に同じ inquiry_id があれば何もしない」用途で使う。
     */
    function portalInsertBatchIgnore(PDO $pdo, string $table, array $rows): array
    {
        $summary = ['processed' => 0, 'errors' => []];
        if (count($rows) === 0) {
            return $summary;
        }

        $cols = array_keys($rows[0]);
        $colSql = "`" . implode("`, `", $cols) . "`";

        $placeholders = [];
        $params = [];
        foreach ($rows as $i => $row) {
            $placeholders[] = "(" . implode(", ", array_map(fn($c) => ":" . $c . "_" . $i, $cols)) . ")";
            foreach ($cols as $c) {
                $params[":" . $c . "_" . $i] = $row[$c];
            }
        }

        $sql = "INSERT IGNORE INTO `{$table}` ($colSql) VALUES " . implode(", ", $placeholders);

        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $summary['processed'] = $stmt->rowCount();
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
     * 生データテーブルへの upsert と inquiry_customer への取り込みをまとめて実行する。
     *
     * @param callable $toInquiry 1レコードを inquiry_customer 用の連想配列へ変換する。
     *                            取り込み対象外なら null を返す。
     */
    function portalRunBulkImport(
        PDO $pdo,
        array $rows,
        string $table,
        array $allowedColumns,
        array $keyColumns,
        callable $toInquiry
    ): array {
        $summary = ['processed' => 0, 'inquiry_inserted' => 0, 'errors' => []];
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

                $res = portalInsertBatchOnDuplicate($pdo, $table, $rawRows, $keyColumns);
                $inquiryRes = portalInsertBatchIgnore($pdo, 'inquiry_customer', $inquiryRows);

                if (!empty($res['errors']) || !empty($inquiryRes['errors'])) {
                    $pdo->rollBack();
                    $summary['errors'] = array_merge(
                        $summary['errors'],
                        $res['errors'],
                        $inquiryRes['errors']
                    );
                } else {
                    $pdo->commit();
                    $summary['processed'] += $res['processed'];
                    $summary['inquiry_inserted'] += $inquiryRes['processed'];
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
