<?php
/**
 * PGハウスのサンクスメール送信バッチ（GAS: runPGMail）用。
 *
 * ⚠️⚠️ **呼び出し元は GAS（Google Apps Script）であり、このリポジトリに無い。**
 *   `UrlFetchApp.fetch()` に `muteHttpExceptions: true` が付いているため、
 *   **GAS側は HTTP ステータスでは例外を出さない**。例外になるのは
 *   `JSON.parse()` だけである。
 *   → ⚠️⚠️ **このファイルは、何があっても必ず JSON を返すこと。**
 *     Fatal error で本文が空になると、GAS 側は
 *     「APIからのユーザー取得に失敗しました。」というメールを出す。
 *
 * $data['id'] が無ければ一覧取得、あれば送信済みフラグの更新。
 */

$id = $data['id'] ?? '';

if (!$id) {
    /**
     * ⚠️ 2026-10-02 まで、この一覧取得側には try/catch が無かった。
     *   そのため DB が一時的に落ちた・混雑した場合に PDOException が
     *   そのまま Fatal error になり、本番は display_errors が切ってあるので
     *   **本文が空のまま 200 が返っていた**。
     *   GAS は `JSON.parse("")` で落ち、原因の分からないエラーメールだけが届いていた。
     */
    try {
        /**
         * ⚠️ 2026-10-02 に `note <> 'mail'`（送信済みの除外）を追加した。
         *   それまでは全件を返しており、**1,334件・174KB のうち未送信は 0 件**だった。
         *   GAS 側も `user.note === 'mail'` でスキップしていたので動作は同じだが、
         *   レコードが増え続けるため毎回の転送量だけが膨らんでいた。
         *
         * ⚠️ `note` は NOT NULL なので `<> 'mail'` で NULL 行が落ちる心配はない。
         *   （NULL 許容に変えた場合は `(note IS NULL OR note <> 'mail')` にすること）
         *
         * ⚠️ `medium = 'ホームページ反響'` のときだけ `reserved_date` を必須にしている。
         *   来場予約のサンクスメールは予約が入っている人にしか出さないため。
         */
        $sql_customer = "SELECT id, first_name, last_name, mail, note, medium
            FROM inquiry_customer
            WHERE brand LIKE '%PG%'
            AND note <> 'mail'
            AND (medium = 'タウンライフ' OR medium = 'HOME\'S' OR medium = 'カゴスマ' OR (medium = 'ホームページ反響' AND reserved_date <> ''));";

        $stmt_customer = $pdo->prepare($sql_customer);
        $stmt_customer->execute();
        $response_customer = $stmt_customer->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($response_customer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    } catch (PDOException $e) {
        error_log('Catalog Mail Fetch Error: ' . $e->getMessage());

        /**
         * ⚠️⚠️ **配列ではなくオブジェクトを返す。**
         *   GAS 側は `Array.isArray()` で弾いて1件も送らずに終わる。
         *   ⚠️ 空配列 `[]` を返すと「対象0件で正常終了」と区別が付かないので返さない。
         */
        http_response_code(500);
        echo json_encode(
            ['status' => 'error', 'message' => '対象者の取得に失敗しました。'],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        exit;
    }
}

try {
    $sql_customer = "UPDATE inquiry_customer SET note = 'mail' WHERE id = ?;";
    $stmt_customer = $pdo->prepare($sql_customer);
    $stmt_customer->execute([$id]);

    $result = [
        "status" => 'success',
    ];
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (PDOException $e) {
    error_log('Mail Update Error: ' . $e->getMessage());

    $result = [
        "status" => 'error',
    ];

    // ⚠️ ここは 2026-10-02 時点で従来どおり 200 で返している。
    //   GAS は更新側の応答を見ていないため、挙動を変えない判断にした。
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
