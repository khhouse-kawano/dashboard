<?php

/**
 * Anthropic API を呼び出すための共通関数。
 *
 * Composer を導入していない構成のため、PHP標準の cURL 拡張を直接使う。
 * 呼び出し側は復号済みのAPIキーを渡すが、この中でキーをログに出してはいけない。
 */

const ANTHROPIC_BASE_URL   = 'https://api.anthropic.com';
const ANTHROPIC_VERSION    = '2023-06-01';
const ANTHROPIC_TIMEOUT    = 120; // 秒。分析系は時間がかかるため長めに取る

/**
 * Anthropic API へリクエストを送る。
 *
 * @param string      $apiKey 復号済みのAPIキー
 * @param string      $method 'GET' または 'POST'
 * @param string      $path   例: '/v1/models'
 * @param array|null  $body   POST時の本文（連想配列。JSONに変換して送る）
 *
 * 戻り値のキー:
 *   ok          … 通信が成立し 2xx が返ったか
 *   status      … HTTPステータス（通信自体が失敗した場合は 0）
 *   data        … レスポンスのJSONをデコードしたもの
 *   error       … 利用者に見せてよいエラーメッセージ（成功時は null）
 *   duration_ms … 所要時間
 *
 * @return array{ok: bool, status: int, data: array|null, error: string|null, duration_ms: int}
 */
function anthropicRequest(string $apiKey, string $method, string $path, ?array $body = null): array
{
    $startedAt = microtime(true);

    $headers = [
        'x-api-key: ' . $apiKey,
        'anthropic-version: ' . ANTHROPIC_VERSION,
        'content-type: application/json',
    ];

    $ch = curl_init(ANTHROPIC_BASE_URL . $path);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => ANTHROPIC_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_CUSTOMREQUEST  => $method,
        // 証明書の検証は必ず有効のままにすること（無効化は中間者攻撃を許す）
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];
    if ($body !== null) {
        $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
    }
    curl_setopt_array($ch, $options);

    $raw       = curl_exec($ch);
    $status    = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    // curl_close() は PHP 8.0 以降なにもしない no-op で、8.5 で非推奨になった。
    // ハンドルは変数がスコープを抜けた時点で解放される。
    unset($ch);

    $durationMs = (int)round((microtime(true) - $startedAt) * 1000);

    // 通信そのものが失敗した場合（DNS・タイムアウト・証明書エラーなど）
    if ($raw === false) {
        return [
            'ok'          => false,
            'status'      => 0,
            'data'        => null,
            'error'       => 'Anthropic への接続に失敗しました: ' . $curlError,
            'duration_ms' => $durationMs,
        ];
    }

    $data = json_decode($raw, true);

    if ($status >= 200 && $status < 300) {
        return [
            'ok'          => true,
            'status'      => $status,
            'data'        => is_array($data) ? $data : null,
            'error'       => null,
            'duration_ms' => $durationMs,
        ];
    }

    return [
        'ok'          => false,
        'status'      => $status,
        'data'        => is_array($data) ? $data : null,
        'error'       => anthropicErrorMessage($status, $data),
        'duration_ms' => $durationMs,
    ];
}

/**
 * HTTPステータスから、利用者に見せる日本語メッセージを組み立てる。
 * APIからの生のメッセージは開発者向けなので、必要な場合のみ添える。
 */
function anthropicErrorMessage(int $status, ?array $data): string
{
    $detail = $data['error']['message'] ?? '';

    // 残高不足は 400 で返ってくることがあり、メッセージでしか判別できない
    if ($detail !== '' && stripos($detail, 'credit balance') !== false) {
        return 'クレジット残高が不足しています。Console で購入してください。';
    }

    switch ($status) {
        case 400:
            return 'リクエストの内容が不正です。' . ($detail !== '' ? '（' . $detail . '）' : '');
        case 401:
            return 'APIキーが無効です。キーが失効しているか、誤って登録されています。';
        case 402:
            return 'クレジット残高が不足しています。Console で購入してください。';
        case 403:
            return 'このAPIキーには権限がありません。';
        case 404:
            return '指定されたエンドポイントが存在しません。';
        case 413:
            return '送信データが大きすぎます。分析対象を絞ってください。';
        case 429:
            return 'リクエストが集中しています。しばらく待って再実行してください。';
        default:
            if ($status >= 500) {
                return 'Anthropic 側で一時的な障害が発生しています。時間をおいて再実行してください。';
            }
            return 'APIエラーが発生しました（HTTP ' . $status . '）。'
                . ($detail !== '' ? '（' . $detail . '）' : '');
    }
}

/**
 * APIキーが有効かどうかを確認する。
 *
 * モデル一覧の取得を使う。トークンを消費しないため課金は発生しない。
 */
function anthropicVerifyKey(string $apiKey): array
{
    return anthropicRequest($apiKey, 'GET', '/v1/models?limit=1');
}

/**
 * 100万トークンあたりの単価（USD）。
 * 料金改定があった場合はここを更新する。
 */
const ANTHROPIC_PRICING = [
    'claude-opus-5'    => ['input' => 5.00, 'output' => 25.00],
    'claude-sonnet-5'  => ['input' => 3.00, 'output' => 15.00],
    'claude-haiku-4-5' => ['input' => 1.00, 'output' => 5.00],
];

/**
 * 使用トークン数から概算コスト（USD）を求める。
 * 未知のモデルの場合は null を返す（誤った金額を記録しないため）。
 */
function anthropicEstimateCost(string $model, int $inputTokens, int $outputTokens): ?float
{
    if (!isset(ANTHROPIC_PRICING[$model])) {
        return null;
    }
    $rate = ANTHROPIC_PRICING[$model];

    return round(
        $inputTokens  / 1_000_000 * $rate['input'] +
        $outputTokens / 1_000_000 * $rate['output'],
        5
    );
}

/**
 * Messages API を呼び出して推論を実行する。**ここから課金が発生する。**
 *
 * @param string $system    役割・制約の指示
 * @param string $userText  分析対象のデータなど
 * @param string $model     モデルID
 * @param int    $maxTokens 出力の上限。上限に達すると途中で切れるため小さくしすぎない
 * @param string     $effort    'low' | 'medium' | 'high' | 'xhigh' | 'max'
 *                              思考の深さと消費トークンを左右する。コスト調整はここで行う
 * @param array|null $schema    JSON Schema を渡すと、その形に従ったJSONだけを返させる
 *                              （構造化出力）。additionalProperties:false と required は必須。
 */
function anthropicCreateMessage(
    string $apiKey,
    string $system,
    string $userText,
    string $model = 'claude-opus-5',
    int $maxTokens = 8000,
    string $effort = 'medium',
    ?array $schema = null
): array {
    $outputConfig = ['effort' => $effort];

    if ($schema !== null) {
        $outputConfig['format'] = [
            'type'   => 'json_schema',
            'schema' => $schema,
        ];
    }

    return anthropicRequest($apiKey, 'POST', '/v1/messages', [
        'model'      => $model,
        'max_tokens' => $maxTokens,
        // Claude が必要に応じて思考の深さを自動調整する
        'thinking'   => ['type' => 'adaptive'],
        'output_config' => $outputConfig,
        'system'     => $system,
        'messages'   => [
            ['role' => 'user', 'content' => $userText],
        ],
    ]);
}

/**
 * 構造化出力のレスポンスをデコードする。
 * スキーマに従ったJSONがテキストブロックに文字列として入っているため、
 * 取り出してからデコードする必要がある。
 */
function anthropicExtractJson(?array $data): ?array
{
    $text = anthropicExtractText($data);
    if ($text === '') {
        return null;
    }

    $decoded = json_decode($text, true);
    return is_array($decoded) ? $decoded : null;
}

/**
 * レスポンスの content 配列から、テキストブロックだけを連結して取り出す。
 * content には thinking など他の種類のブロックも混ざるため、型で絞る必要がある。
 */
function anthropicExtractText(?array $data): string
{
    if ($data === null || !isset($data['content']) || !is_array($data['content'])) {
        return '';
    }

    $parts = [];
    foreach ($data['content'] as $block) {
        if (($block['type'] ?? '') === 'text' && isset($block['text'])) {
            $parts[] = $block['text'];
        }
    }
    return implode('', $parts);
}
