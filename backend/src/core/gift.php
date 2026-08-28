<?php

/**
 * ギフト進呈可否の判定。
 *
 * 顧客一覧（注文事業・建売分譲）で顧客名の先頭に信号機のようなドットを出すための判定。
 *   グリーン（gift = 1）… ギフト進呈可
 *   レッド  （gift = 0）… ギフト進呈不可
 *
 * ─────────────────────────────────────────────
 * 進呈可の条件（4つすべてを満たすこと）
 *   ① in_charge_user が入っており、かつ「管理」を含まない
 *      「KH大分店 管理」「グループ管理」「企業 管理者」などは担当者が未割当の
 *      プレースホルダで、実在の担当者ではない（master_data で約19,000件が該当）。
 *   ② 反響取得日（step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99）が入っている
 *   ③ interview_sheet の同一IDの interview_log に、
 *      action = '初回面談' かつ note が記入済みの要素が1つ以上ある
 *      ⚠️ 同じ要素の中で両方成立していること。配列全体で別々に存在するだけでは不可。
 *   ④ family_info に同一IDの行があり、family_info が入っている
 * ─────────────────────────────────────────────
 *
 * ⚠️ この判定は注文事業と建売分譲の両方で同じものを使う。
 *   ロジックを各ハンドラに直接書くと、片方だけ直されて画面ごとに色が違う状態になる。
 *   条件を変えるときは必ずこのファイルだけを直すこと。
 *
 * ⚠️ 実測（2026-08時点）では建売分譲（master_data_kaeru）のグリーンは
 *   10,772件中15件しかない。family_info に紐づく建売の顧客が22件しかないためで、
 *   条件の間違いではない。family_info の登録が進めば自然に増える。
 *
 * ─────────────────────────────────────────────
 * なぜ ③ ④ を SQL の JOIN にしないのか（性能）
 *
 *   interview_sheet には id の索引が無い（PRIMARY は no のみ）。
 *   ③の判定結果（約2,273件）を導出テーブルにして master_data と id で結合すると、
 *   索引の無い TEXT 列どうしの総当たりになり、実測で顧客一覧の取得が
 *   65秒かかった（結合前は数秒）。
 *
 *   ③の判定そのものは単体で約1.6秒で終わる。そこで
 *     1. 条件を満たす id の一覧だけをそれぞれ1回のクエリで取る
 *     2. PHP の連想配列（ハッシュ）に載せる
 *     3. 顧客一覧の各行と突き合わせる
 *   という形にした。結合を無くしたことで全体が数秒に収まる。
 *
 *   将来 interview_sheet.id に索引を張れるなら SQL 側に寄せてもよい。
 *   その場合も条件の定義はこのファイルに残すこと。
 * ─────────────────────────────────────────────
 */

/**
 * 条件①②だけを判定する SELECT 用の列。
 *
 * どちらも顧客テーブル1つで判定できるため、結合を伴わず費用がかからない。
 * ③④はこの後 giftApplyToCustomers() が突き合わせる。
 *
 * 列名を gift にしていないのは、まだ4条件のうち2つしか見ていないため。
 * この値をそのまま画面に出すと「進呈可」を過大に表示してしまう。
 */
function giftBaseSelectSql(): string
{
    return "CASE WHEN COALESCE(in_charge_user, '') <> ''
                  AND COALESCE(in_charge_user, '') NOT LIKE '%管理%'
                  AND COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') <> ''
                 THEN 1 ELSE 0 END AS gift_base";
}

/**
 * 条件③を満たす顧客IDの集合を返す（id => true の連想配列）。
 *
 * interview_log は JSON 配列で、1要素が1件の面談記録。
 * 「同じ要素の中で action と note の両方が成立」を判定するため、
 * 配列の添字を展開してから突き合わせている。
 *
 * ⚠️ JSON_SEARCH では書けない。
 *   JSON_SEARCH は「action が一致する要素の note」を見に行けないため、
 *   action と note が別々の要素にあるだけの顧客まで拾ってしまう
 *   （実測: 要素単位 2,273件 に対して、配列全体では 9,109件 と4倍に膨らむ）。
 *
 * MySQL の JSON_TABLE があれば素直に書けるが MariaDB 10.11 は未対応。
 * 添字は 0〜31 まで展開する（interview_log の最大要素数は実測16）。
 */
function giftInterviewIds(PDO $pdo): array
{
    $sql = "WITH RECURSIVE seq AS (
                SELECT 0 AS i
                UNION ALL
                SELECT i + 1 FROM seq WHERE i < 31
            )
            SELECT DISTINCT iv.id
              FROM interview_sheet iv
              JOIN seq ON seq.i < JSON_LENGTH(iv.interview_log)
             WHERE JSON_UNQUOTE(JSON_EXTRACT(iv.interview_log, CONCAT('$[', seq.i, '].action'))) = '初回面談'
               AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(iv.interview_log, CONCAT('$[', seq.i, '].note'))), '') <> ''";

    $ids = $pdo->query($sql)->fetchAll(PDO::FETCH_COLUMN);

    // 突き合わせは連想配列のキー参照で行う（in_array だと顧客数×ID数の総当たりになる）
    return array_fill_keys($ids, true);
}

/** 条件④を満たす顧客IDの集合を返す（id => true の連想配列） */
function giftFamilyIds(PDO $pdo): array
{
    $ids = $pdo->query(
        "SELECT DISTINCT id FROM family_info WHERE COALESCE(family_info, '') <> ''"
    )->fetchAll(PDO::FETCH_COLUMN);

    return array_fill_keys($ids, true);
}

/**
 * 顧客一覧の各行に gift（1 = 進呈可 / 0 = 不可）を付ける。
 *
 * 各行は giftBaseSelectSql() で得た gift_base（条件①②の結果）と id を持っている必要がある。
 * gift_base は中間値なので、gift を確定させたらレスポンスから外す
 * （画面に2つ渡すと、どちらを見ればよいのか分からなくなる）。
 *
 * ⚠️ 参照渡しで受け取り、その場で書き換える。
 *   顧客一覧は注文事業で24,000件・建売で10,000件あり、値渡しにすると
 *   書き換えの時点で配列全体が複製される。実測ではこの複製だけで
 *   PHP の memory_limit（128MB）を超えて Fatal error になった。
 *   戻り値を返さないのは、複製を避ける意図を呼び出し側にも明示するため。
 *
 * @param array $customers 顧客一覧（id と gift_base を含む行の配列）。その場で書き換わる
 */
function giftApplyToCustomers(PDO $pdo, array &$customers): void
{
    $interviewIds = giftInterviewIds($pdo);
    $familyIds    = giftFamilyIds($pdo);

    foreach ($customers as &$customer) {
        $id = $customer['id'] ?? '';

        $customer['gift'] = ((int)($customer['gift_base'] ?? 0) === 1
            && isset($interviewIds[$id])
            && isset($familyIds[$id])) ? 1 : 0;

        unset($customer['gift_base']);
    }
    // foreach の参照が最後の要素に残り続けるため、明示的に切る。
    // これを忘れると、以降の $customer への代入が配列の末尾を書き換えてしまう。
    unset($customer);
}
