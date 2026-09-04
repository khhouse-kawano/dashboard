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
 * ② へ転送する許可リスト。
 *
 * 書き方は3通り。用途に応じて使い分ける。
 *
 *   'menu'                   … request だけで判定する（roll / category を問わない）
 *   'property:suumo'         … request と roll が一致したときだけ
 *   'database:gift:order'    … request / roll / category がすべて一致したときだけ
 *
 * ⚠️ **roll で分岐するハンドラは、移植した roll だけを書くこと。**
 *   request だけで書くと、未移植の roll も ② へ送られる。
 *   ② は未登録として 502 を返し、① が自動フォールバックするので動きはするが、
 *   **リクエストのたびに無駄な往復とエラーログが発生する**。
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

        // 2026-09-03 移植。roll = 'suumo' のみ。
        // ⚠️ 'property' と書かないこと。list / detail は未移植。
        'property:suumo',

        // 2026-09-03 移植。K-SNAP の参照系のみ。
        //
        // ⚠️ 'k-snap' は公開ギャラリー向け（owner を暗号化）。
        //   ② に KSNAP_OWNER_KEY / KSNAP_OWNER_IV が設定されていないと
        //   owner が空文字になり、顧客側の絞り込みが壊れる。
        //   鍵を消す・変える場合はこの行も外すこと。
        //
        // ⚠️ 以下は**絶対に追加しないこと。** 書き込み系のため、
        //   自動フォールバックで二重実行される。
        //     k-snap_update          … 画像アップロード（そもそも ② では動かない）
        //     k-snap_show            … UPDATE
        //     k-snap_customer_update … INSERT / UPDATE
        'k-snap',
        'k-snap_edit',
        'k-snap_load',
        'k-snap_customer',
        'kSnap',

        // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
        // request 形式へ移したもの。
        //
        // ⚠️ 公開ギャラリー（顧客向け）も使っている。
        //   認証を要求すると顧客側が止まる。
        'shop_list',

        // -----------------------------------------------------------------
        // 2026-09-03 新規。Instagram 公式アンバサダー管理。
        //
        // ⚠️⚠️ **移植ではなく、最初から Express のみで実装した機能である。**
        //   PHPハンドラが存在しないため、上記の「書き込み系を入れてはいけない」
        //   という制約が**当てはまらない。**
        //
        //   ① が自動フォールバックしても実行するPHPが無く、404 になるだけで
        //   二重実行にならない。そのため insert / update / sync も含めて
        //   request 名だけで許可してよい。
        //
        // ⚠️ 逆に、この機能に**PHPハンドラを作ってはいけない。**
        //   作った瞬間に二重実行の危険が生まれる。
        //
        // ⚠️ ② が落ちるとこの画面だけ動かなくなる（フォールバック先が無い）。
        //   他の画面には影響しない。
        // -----------------------------------------------------------------
        'ambassador_list',
        'inquiry_ambassador',
        'ambassador_master',

        // ⚠️ ambassador_inquiry（公開フォームからの反響受付）は**入れない。**
        //   フォームは ② を直接叩くため、① を経由しない。
        //   ここに入れても使われず、① 経由で叩ける口を増やすだけになる。
    ];
}

/**
 * 許可リストの1件が、今回のリクエストに一致するか。
 *
 * ⚠️ 部分一致にしないこと。'property' が 'property_db_update' に
 *   一致してしまうと、更新系が ② へ送られる。必ず区切りごとに比較する。
 */
function matchesProxyRule(string $rule, string $request, string $roll, string $category): bool
{
    $parts = explode(':', $rule);

    if (($parts[0] ?? '') !== $request) {
        return false;
    }
    // request だけの指定 → roll / category を問わない
    if (count($parts) === 1) {
        return true;
    }
    if (($parts[1] ?? '') !== $roll) {
        return false;
    }
    if (count($parts) === 2) {
        return true;
    }

    return ($parts[2] ?? '') === $category;
}

/**
 * この request を ② へ転送すべきか。
 *
 * @param array $data リクエストボディ。roll / category の判定に使う
 */
function shouldProxyToExpress(string $request, array $data): bool
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

    // ⚠️ 数値や null が来ても落ちないよう文字列に寄せる。
    //   ② の gateway/index.ts の asString() と同じ考え方。
    $roll = is_scalar($data['roll'] ?? null) ? (string)$data['roll'] : '';
    $category = is_scalar($data['category'] ?? null) ? (string)$data['category'] : '';

    foreach (expressProxyRequests() as $rule) {
        if (matchesProxyRule($rule, $request, $roll, $category)) {
            return true;
        }
    }

    return false;
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
