<?php

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../core/bulk_upsert.php';

/**
 * 【PG HOUSE九州】資料請求メールからの反響を取り込む。
 *
 * ```
 * Gmail ─(GAS)→ sync の Express ─(postGateway 'pgh_order')→ ここ → inquiry_customer
 * ```
 *
 * ⚠️ 送り元: projects/sync の src/services/runPghCatalog.ts
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **受け口テーブル（*_db）を作っていない。**
 *   ⚠️ SUUMO などのポータルは、ポータル側の生データを残すために `suumo_db` を持つ。
 *   ⚠️ ⚠️ **こちらはメール本文そのものを `remarks` に入れてある**ので、
 *     ⚠️ 生データを別に持つ意味が薄い。⚠️ **テーブルを1つ増やさない判断。**
 *   ⚠️ そのため `portalRunBulkImport()` は使わず、`portalInsertNewOnly()` を直接呼ぶ。
 *
 * ⚠️⚠️ **`inquiry_customer` には `inquiry_id` の一意キーが無い**（PRIMARY は `id` だけ）。
 *   ⚠️ ⚠️ **`INSERT IGNORE` では重複を防げない。**
 *   ⚠️ `portalInsertNewOnly()` が「既にある鍵を SELECT してから入れる」ので、
 *     ⚠️ **必ずこれを通すこと。**
 *
 * ⚠️⚠️ **値の組み立ては sync 側（Express）がやる。** ここは**列を絞って入れるだけ。**
 *   ⚠️ 媒体名・住所の分け方・カナ変換を変えるときは sync を直す。
 *   ⚠️ ⚠️ **ただし列の顔ぶれを増やすときは、下の許可リストも直すこと。**
 *     ⚠️ ここに無い列は**黙って捨てられる。**
 * ─────────────────────────────────────────────
 */

/**
 * `inquiry_customer` に入れてよい列。
 *
 * ⚠️ 送られてきても、⚠️ **ここに無いものは入れない。**
 *   ⚠️ 外から任意の列を書き込まれないようにするため。
 * ⚠️ ⚠️ **`sync` / `delete_flag` などの運用フラグは受け取らない。**
 *   ⚠️ 既定値のまま「未同期」で入るのが正しい。
 */
$allowedColumns = [
    'inquiry_id',
    'inquiry_date',
    'medium',
    'response_medium',
    'first_name',
    'last_name',
    'first_name_kana',
    'last_name_kana',
    'mobile',
    'mail',
    'zip',
    'pref',
    'building',
    'brand',
    'shop',
    'hp_campaign',
    'remarks',
];

$rows = portalReadBulkPayload('pgh_order');

$summary = ['processed' => 0, 'skipped' => 0, 'errors' => []];
$batchSize = 500;

foreach (array_chunk($rows, $batchSize) as $chunk) {
    $inquiryRows = [];

    foreach ($chunk as $row) {
        if (!is_array($row)) {
            continue;
        }
        // ⚠️ NOT NULL の列があるため、空文字のまま入れる（null にしない）
        $filtered = portalNormalizeRow(portalFilterAllowed($row, $allowedColumns, ''), false);

        // ⚠️⚠️ **鍵の無い行は入れない。** 重複排除ができず、毎回増え続けるため
        if (trim((string)($filtered['inquiry_id'] ?? '')) === '') {
            continue;
        }
        $inquiryRows[] = $filtered;
    }

    if (count($inquiryRows) === 0) {
        continue;
    }

    try {
        $pdo->beginTransaction();
        $res = portalInsertNewOnly($pdo, 'inquiry_customer', $inquiryRows, 'inquiry_id');

        if (!empty($res['errors'])) {
            $pdo->rollBack();
            $summary['errors'] = array_merge($summary['errors'], $res['errors']);
        } else {
            $pdo->commit();
            $summary['processed'] += $res['processed'];
            $summary['skipped']   += $res['skipped'];
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $summary['errors'][] = $e->getMessage();
    }
}

header('Content-Type: application/json; charset=utf-8');
// ⚠️ skipped は「既に取り込み済みだった件数」。⚠️ **エラーではない。**
//   ⚠️ GAS は1日ぶんを毎回送るため、平常時は skipped のほうが大きくなる。
echo json_encode([
    'ok'       => empty($summary['errors']),
    'inserted' => $summary['processed'],
    'skipped'  => $summary['skipped'],
    'errors'   => $summary['errors'],
], JSON_UNESCAPED_UNICODE);
