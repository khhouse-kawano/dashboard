<?php

/**
 * KPI分析の絞り込みUI（部門 → 課 → 店舗 → スタッフ）用のマスタ。
 *
 * リクエスト例:
 *   { "request": "kpi_filter_master" }
 *   ヘッダ: Token: <staff.api_token>
 *
 * 3段のカスケードを都度APIで引くと通信が増えるだけなので、
 * 対象になりうる店舗と担当者を1回で返し、絞り込み自体は画面側で行う。
 * 件数は店舗37件・担当者300件程度で、まとめて返しても軽い。
 *
 * ⚠️ ここで返すのはあくまで選択肢。実際に集計してよい範囲かどうかは
 *   kpi_analyze 側で kpiResolveScope() が再検証する。
 */

require_once __DIR__ . '/../core/authz.php';
require_once __DIR__ . '/../core/kpi.php';

try {
    // 分析本体と同じ権限にそろえる。ここだけ緩いと、
    // 誰がどの店舗に所属しているかの一覧が漏れる。
    requireMaster($pdo, $headers);

    // -----------------------------------------------------------------
    // 対象店舗
    //   report_flag = 1 …「全社報告用フォーマットの表示の有無」。
    //   これを分析対象の定義として使うことで、'KH全店舗' のような
    //   集計用ダミー行や運用を終えた店舗が選択肢に出てこない。
    // -----------------------------------------------------------------
    $divisions = array_map(
        static fn(array $d): string => $d['shop_division'],
        array_values(KPI_DIVISIONS)
    );

    // 同じ (division, section, shop) が複数行ある場合に選択肢が重複しないよう
    // GROUP BY でまとめる。DISTINCT + ORDER BY 非選択列は
    // ONLY_FULL_GROUP_BY で落ちるため使わない。
    $stmt = $pdo->prepare(
        "SELECT division, section, shop
           FROM shop_list
          WHERE division IN (" . implode(',', array_fill(0, count($divisions), '?')) . ")
            AND report_flag = 1
            AND shop    <> ''
            AND section <> ''
          GROUP BY division, section, shop
          ORDER BY MIN(brand_sort), MIN(id)"
    );
    $stmt->execute($divisions);
    $shops = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // -----------------------------------------------------------------
    // 担当者
    //   staff_list は配属年度（period）ごとに行が増えるため、
    //   同じ人が複数行に現れる。最新年度の在籍者だけを DISTINCT で取る。
    //   （market_master.php と同じ考え方）
    // -----------------------------------------------------------------
    $staff = $pdo->query(
        "SELECT name, shop, section
           FROM staff_list
          WHERE name <> ''
            AND shop <> ''
            AND period = (SELECT MAX(period) FROM staff_list
                           WHERE period <> ''
                             AND period <= CAST(YEAR(CURDATE()) AS CHAR))
          GROUP BY name, shop, section
          ORDER BY MIN(sort), MIN(id)"
    )->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'status' => 'ok',
        'shops'  => $shops,
        'staff'  => $staff,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('kpi_filter_master failed: ' . $e->getMessage());
    echo json_encode(
        ['status' => 'error', 'message' => '絞り込み条件の取得に失敗しました。'],
        JSON_UNESCAPED_UNICODE
    );
}
