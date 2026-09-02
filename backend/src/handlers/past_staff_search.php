<?php

/**
 * 過去に担当した営業名で顧客を絞り込む。
 *
 * リクエスト例:
 *   { "request": "past_staff_search", "staff": "的場" }
 *   ヘッダ: Token: <staff.api_token>
 *
 * レスポンス:
 *   { "status": "ok", "ids": ["01K6...", ...] }
 *
 * ─────────────────────────────────────────────
 * なぜサーバー側で検索するのか
 *
 *   以前は database_spec.php が call_sheet と interview_sheet を丸ごと返し
 *   （ログ本文だけで約30MB）、ブラウザ側で部分一致を取っていた。
 *   この2テーブルを載せるだけで PHP の memory_limit を超え、
 *   建売分譲の顧客一覧が Fatal error で返らなくなっていた。
 *
 *   実際に必要なのは「該当する顧客のID」だけなので、検索をサーバーに移し、
 *   database_spec.php からログの返却をやめた。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 生テキストの部分一致（call_log LIKE '%名前%'）では取りこぼす。
 *   ログ内の日本語はエスケープされて保存されている行が多く
 *   （call_sheet 15,480行中 11,395行）、そのままでは名前が一致しない。
 *   実測では「的場 雄大」で生テキスト一致 392件に対し、
 *   JSON_SEARCH 経由なら 446件（12%多い）が正しく取れる。
 *   JSON_SEARCH は値を戻してから比較するため、保存形式の違いに影響されない。
 *
 * ⚠️ 添字を展開して1要素ずつ JSON_EXTRACT する書き方（core/gift.php の手法）は
 *   ここでは使わないこと。ログの最大要素数は call_log で102あり、
 *   2テーブル合わせて約420万回の展開が発生して1回の検索に28秒かかった。
 *   JSON_SEARCH は1行1回で済み、同じ結果が0.5秒で返る。
 */

require_once __DIR__ . '/../core/authz.php';

try {
    requireStaff($pdo, $headers);

    $staff = trim((string)($data['staff'] ?? ''));

    // 空検索で全件返すと絞り込みの意味が無いうえに重い。
    // 呼び出し側は検索語が空のときこのAPIを呼ばないが、直接叩かれた場合に備える。
    if ($staff === '') {
        echo json_encode(['status' => 'ok', 'ids' => []], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // JSON_SEARCH の検索文字列は LIKE と同じワイルドカードを解釈する。
    // 画面上は「名前の部分一致」なので、% や _ を打たれても文字として扱う。
    $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $staff);
    $pattern = '%' . $escaped . '%';

    // call_sheet と interview_sheet の両方を見る。
    // 以前のフロント側の実装は interview_sheet の行から call_log を読もうとしており
    // （interview_sheet に call_log 列は無い）、面談ログは事実上検索されていなかった。
    //
    // '$[*].staff' を指定することで、対応記録の担当者名だけを見る。
    // ログ本文（note）に名前が出てくるだけの顧客は拾わない。
    $sql = "
        SELECT DISTINCT cs.id AS id
          FROM call_sheet cs
         WHERE cs.id <> ''
           AND JSON_SEARCH(cs.call_log, 'one', ?, NULL, '$[*].staff') IS NOT NULL
        UNION
        SELECT DISTINCT iv.id AS id
          FROM interview_sheet iv
         WHERE iv.id <> ''
           AND JSON_SEARCH(iv.interview_log, 'one', ?, NULL, '$[*].staff') IS NOT NULL
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$pattern, $pattern]);

    echo json_encode(
        ['status' => 'ok', 'ids' => $stmt->fetchAll(PDO::FETCH_COLUMN)],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );

} catch (Throwable $e) {
    http_response_code(500);
    error_log('past_staff_search failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '過去担当者の検索に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
