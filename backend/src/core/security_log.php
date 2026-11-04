<?php

/**
 * セキュリティログ（security_log）を ① で書く（v2.2.242 新規）。
 *
 * ─────────────────────────────────────────────
 *   表 : backend/scripts/sql/2026-11-04_security_log.sql
 *   ② 側の同じ処理 : backend-express/src/features/securityLog.ts（⚠️ まとめ方・列の長さを揃えること）
 *   画面 : frontend/src/components/header/system/SecurityLog.tsx（読むのは ② の security_log_list）
 *
 * ⚠️⚠️ **ここで失敗しても本来の処理を止めない。** 例外は握って error_log にだけ残す。
 * ⚠️ message にパスワード・トークン・メールアドレス・お客様の情報を入れないこと。
 * ⚠️ 失敗の連打（SECURITY_LOG_AGGREGATE の種類）は「同じ種類・IP・request・人・1分」を1行にまとめる。
 * ─────────────────────────────────────────────
 */

/** まとめる種類（⚠️ ② の AGGREGATE_EVENTS と同じ） */
const SECURITY_LOG_AGGREGATE = ['auth_failed', 'forbidden', 'bad_request', 'unknown_request'];

/** 古い行を消す日数と、書くときに掃除する確率（⚠️ ② と同じ） */
const SECURITY_LOG_KEEP_DAYS = 180;
const SECURITY_LOG_CLEANUP_ONE_IN = 500;

/** 長さで切る（⚠️ 表の列の長さ。⚠️ 改行などの制御文字は空白に） */
function securityLogText($value, int $max): string
{
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string)$value) ?? '';
    return mb_substr(trim($text), 0, $max);
}

/** IP の形をしているときだけ返す（⚠️ ヘッダーの値は利用者が自由に書けるため） */
function securityLogIp($value): string
{
    $ip = trim((string)$value);
    return filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
}

/**
 * 接続元。
 * ⚠️ ② から転送されてきたとき（X-Forwarded-By: express-gateway）は、② が渡す X-Client-IP を接続元にし、
 *   直接つないできた相手（② の IP）を via_ip に残す。⚠️ ip と via_ip が違えば中継されている。
 *   ⚠️ 名乗りは偽れるので、via_ip（REMOTE_ADDR。偽れない）を必ず一緒に残す。
 */
function securityLogClient(): array
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $remote = securityLogIp($_SERVER['REMOTE_ADDR'] ?? '');
    $forwardedBy = (string)($headers['X-Forwarded-By'] ?? $headers['x-forwarded-by'] ?? '');
    $claimed = securityLogIp($headers['X-Client-IP'] ?? $headers['x-client-ip'] ?? '');
    $viaGateway = $forwardedBy !== '' && $claimed !== '';
    $referer = (string)($_SERVER['HTTP_REFERER'] ?? '');
    $path = $referer === '' ? '' : (string)(parse_url($referer, PHP_URL_PATH) ?? '');
    return [
        'ip' => $viaGateway ? $claimed : $remote,
        'via_ip' => $viaGateway ? $remote : '',
        'user_agent' => securityLogText($_SERVER['HTTP_USER_AGENT'] ?? '', 255),
        'path' => securityLogText($path, 255),
    ];
}

/**
 * 1件書く。
 *
 * @param array $event event（必須）・status・request・roll・staff（staff の行）・message
 * @param PDO|null $pdo 無ければ $GLOBALS['pdo']（db.php が作る）
 */
function securityLog(array $event, ?PDO $pdo = null): void
{
    $pdo = $pdo ?? ($GLOBALS['pdo'] ?? null);
    if (!($pdo instanceof PDO)) return;

    try {
        $client = securityLogClient();
        $type = securityLogText($event['event'] ?? '', 32);
        $staff = is_array($event['staff'] ?? null) ? $event['staff'] : [];
        $staffId = isset($staff['id']) ? (int)$staff['id'] : null;
        $request = securityLogText($event['request'] ?? ($GLOBALS['request'] ?? ''), 100);
        $data = $GLOBALS['data'] ?? [];
        $roll = securityLogText($event['roll'] ?? (is_array($data) && is_scalar($data['roll'] ?? null) ? $data['roll'] : ''), 100);
        // ⚠️ まとめる鍵（⚠️ 1分は DB の NOW() で区切る。② と同じ並び）
        $key = in_array($type, SECURITY_LOG_AGGREGATE, true)
            ? implode('|', ['php', $type, $client['ip'], $request, $roll, (string)($staffId ?? '')])
            : '';

        $stmt = $pdo->prepare(
            "INSERT INTO security_log
               (occurred_at, last_at, count, server, event, status, request, roll, staff_id, staff_name, ip, via_ip, user_agent, path, message, bucket)
             VALUES (NOW(), NOW(), 1, 'php', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     IF(? = '', NULL, SHA1(CONCAT(?, '|', DATE_FORMAT(NOW(), '%Y%m%d%H%i')))))
             ON DUPLICATE KEY UPDATE count = count + 1, last_at = NOW()"
        );
        $stmt->execute([
            $type,
            isset($event['status']) ? (int)$event['status'] : null,
            $request,
            $roll,
            $staffId,
            securityLogText($staff['name'] ?? '', 100),
            $client['ip'],
            $client['via_ip'],
            $client['user_agent'],
            $client['path'],
            securityLogText($event['message'] ?? '', 500),
            $key,
            $key,
        ]);

        if (random_int(1, SECURITY_LOG_CLEANUP_ONE_IN) === 1) {
            $pdo->exec('DELETE FROM security_log WHERE occurred_at < NOW() - INTERVAL ' . SECURITY_LOG_KEEP_DAYS . ' DAY LIMIT 5000');
        }
    } catch (Throwable $e) {
        error_log('security_log: 書き込みに失敗しました（' . $e->getMessage() . '）');
    }
}

/**
 * PHP の致命的エラー（キャッチされない例外を含む）を server_error として残す。⚠️ index.php で1回だけ呼ぶ。
 * ⚠️ 応答の中身は変えない（記録するだけ）。
 */
function securityLogRegisterFatalHandler(): void
{
    register_shutdown_function(static function (): void {
        $error = error_get_last();
        if ($error === null || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) return;
        // ⚠️ メッセージにはファイルの場所が入るので、ファイル名と行だけにする（⚠️ サーバーのパスを残さない）
        $first = strtok((string)$error['message'], "\n");
        securityLog([
            'event' => 'server_error',
            // ⚠️ 実際に返したステータス（⚠️ PHP の致命的エラーは、何もしなければ 200 のまま返る）
            'status' => http_response_code() ?: null,
            'message' => basename((string)$error['file']) . ':' . $error['line'] . ' ' . preg_replace('#(/[^\s:]+)+/#', '', (string)$first),
        ]);
    });
}
