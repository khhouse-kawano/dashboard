<?php

/**
 * 移植済みリクエストを ② VPS の Express へ転送する。
 *
 * ─────────────────────────────────────────────
 * なぜ ① から ② へ転送するのか（フロントを ② に向けないのか）
 *
 *   フロントを直接 ② に向けると、② が落ちた瞬間にダッシュボード全体が
 *   止まる。移植済みが1件で185件が転送という比率でも、通り道が ② なので
 *   全部が止まる。単一障害点が増える。
 *
 *   ① を入口のままにすれば
 *     ・切り戻しはこのファイルの許可リストを空にするだけ（数秒）
 *     ・CORS の設定変更が不要（ブラウザから見た通信先は今と同じ）
 *     ・② が落ちても、下のフォールバックで ① 自身の処理に切り替わる
 *
 *   移植が大半終わった段階で、フロントを ② に向ける方式へ移ればよい。
 *   その時点なら余分な1往復も解消できる。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 転送に失敗したら ① 自身のPHPで処理する（自動フォールバック）。
 *   そのため「同じ処理が2回実行されうる」。
 *   **書き込みを行うリクエストを許可リストに入れてはならない。**
 *   ② が処理を完了した直後に応答が失われると、① でも実行されて
 *   二重登録・二重更新になる。
 */

// ---------------------------------------------------------------------------
// 転送先
//
// ⚠️ ② VPS のゲートウェイURL。① 自身のURLを書くと無限ループになる。
//   .htaccess の SetEnv で上書きできる（環境ごとに変えたい場合）。
// ---------------------------------------------------------------------------
const EXPRESS_API_URL_DEFAULT = 'https://api.khg-marketing.info/api/gateway';

/**
 * ② へ転送する request の許可リスト。
 *
 * ⚠️ **参照のみのリクエストだけを書くこと。** 上記の二重実行の理由による。
 *
 * ⚠️ ここを空配列にすれば全リクエストが ① 自身の処理に戻る。
 *   移植で問題が起きたときの切り戻しは、該当行をコメントアウトするだけ。
 *
 * @return string[]
 */
function expressProxyRequests(): array
{
    return [
        // 2026-09-02 移植。いずれも ② のコンテナ内で差分比較を行い、
        // バイト単位で一致することを確認済み
        'menu',
        'header',
        'update_log',
        'callStatusList',

        // 2026-09-02 移植。KPI分析の参照系のみ。
        //
        // ⚠️ kpi_analyze（Claude API呼び出し＋INSERT）と
        //   kpi_analysis_delete（DELETE）は**絶対に追加しないこと。**
        //   自動フォールバックにより二重課金・履歴の二重INSERTが起きる。
        //
        // ⚠️ これらは ② 側で auth: 'master' を宣言しているため、
        //   Token ヘッダの引き継ぎ（下の forwardToExpress）が必須。
        'kpi_filter_master',
        'kpi_analysis_list',
        'kpi_analysis_get',
    ];
}

/**
 * この request を ② へ転送すべきか。
 */
function shouldProxyToExpress(string $request): bool
{
    // 明示的に無効化できる逃げ道。障害時に .htaccess へ1行足せば全停止できる
    if (getenv('EXPRESS_PROXY_DISABLED') === '1') {
        return false;
    }

    // ⚠️ ファイルアップロード（multipart/form-data）は転送しない。
    //   $_POST 経由で受けたデータにファイル本体が含まれず、
    //   転送先で処理できないため。
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'multipart/form-data') !== false) {
        return false;
    }

    // ⚠️ ② から ① へ転送されてきたリクエストを、再び ② へ返さない。
    //   ② のゲートウェイは未実装のリクエストを ① へ転送する仕組みを持つため、
    //   この判定が無いと ① ⇄ ② で無限ループになる。
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $forwardedBy = $headers['X-Forwarded-By'] ?? $headers['x-forwarded-by'] ?? '';
    if ($forwardedBy !== '') {
        return false;
    }

    return in_array($request, expressProxyRequests(), true);
}

/**
 * ② へ転送する。
 *
 * 成功したらレスポンスをそのまま出力して true を返す。
 * 失敗したら何も出力せず false を返す（呼び出し側が ① の処理を続行する）。
 *
 * ⚠️ レスポンスは素通しする。JSONをパースして組み直すと、
 *   数値の型や日付の形式が変わってフロントが壊れる。
 */
function forwardToExpress(array $data): bool
{
    $url = getenv('EXPRESS_API_URL');
    if ($url === false || $url === '') {
        $url = EXPRESS_API_URL_DEFAULT;
    }

    $headers = ['Content-Type: application/json'];

    // 認証情報を引き継ぐ。
    //
    // ⚠️ これを落とすと、② 側で auth: 'staff' / 'master' を宣言している
    //   エンドポイントが必ず 401 になる。転送する側の必須処理。
    $incoming = function_exists('getallheaders') ? getallheaders() : [];

    $token = $incoming['Token'] ?? $incoming['token'] ?? '';
    if ($token !== '') {
        $headers[] = 'Token: ' . $token;
    }

    // ⚠️ フロント（utils/apiClient.ts）が送る Authorization は '4081Kokubu' という
    //   固定文字列で、認証情報ではない（① でも検証していない）。
    //   ② 側は 'Bearer xxx' の形のときだけ認証情報として扱うため、
    //   そのまま引き継いでも誤認証は起きない。
    //   将来 Bearer を使う経路（MCP など）を通すための備えとして渡しておく。
    $authorization = $incoming['Authorization'] ?? $incoming['authorization'] ?? '';
    if ($authorization !== '') {
        $headers[] = 'Authorization: ' . $authorization;
    }

    // ② 側でループ検知に使う。これが付いていると ② は ① へ転送し返さない
    $headers[] = 'X-Forwarded-By: xserver-php';

    $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        error_log('express_proxy: リクエストのJSON化に失敗しました');
        return false;
    }

    $ch = curl_init($url);
    if ($ch === false) {
        error_log('express_proxy: curl_init に失敗しました');
        return false;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        // ⚠️ 接続タイムアウトは短く、全体は長く。
        //   ② が落ちている場合は接続段階で失敗するため、3秒で見切れば
        //   フォールバックまでの待ち時間が最小になる。
        //   一方、正常に繋がった後の重い集計は待つ必要がある。
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 120,
        // ⚠️ 証明書の検証を無効化しないこと。中間者攻撃を検知できなくなる
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    // 接続できなかった／タイムアウトした
    if ($response === false) {
        error_log("express_proxy: 転送に失敗しました（{$error}）。① の処理に切り替えます");
        return false;
    }

    // ⚠️ 5xx はフォールバックする。② 側の障害（DB接続不能など）であり、
    //   ① なら処理できる可能性がある。
    //   4xx はフォールバックしない。リクエスト内容の誤りは ① でも同じ結果になり、
    //   隠すとバグの発見が遅れる。
    if ($status >= 500) {
        error_log("express_proxy: 転送先が {$status} を返しました。① の処理に切り替えます");
        return false;
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Handled-By: express');
    echo $response;

    return true;
}
