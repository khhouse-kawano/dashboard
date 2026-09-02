<?php

/**
 * 市況分析：KHG の着工棟数
 *
 * 注文と建売でデータソースが違う。統合できない理由は下記。
 *
 *   注文 … contract_customer（契約者単位）
 *          契約してから着工するので、契約者一覧に着工日が揃う（充足率 94%）。
 *
 *   建売 … kaeru_building（物件単位）
 *          「着工 → 完成 → 販売」の順で進むため、未販売の着工物件は
 *          契約者一覧に存在しない。実際 contract_customer の建売行で
 *          着工日が入っているのは 11.7% しかなく、分子として使えない。
 *
 * 除外の考え方
 *   注文 … status = '解約' を除く。解約は着工に至らない。
 *   建売 … sales_status = 'キャンセル' を除く。
 *          category = '中古'（用途コード4の中古再販）も除く。新設着工ではないため、
 *          e-Stat の分譲着工を分母にしたシェアの分子にはならない。
 *          モデルハウスは実際に着工しているので含める。
 */

require_once __DIR__ . '/../core/market.php';

// ---------------------------------------------------------------------------
// 注文
//   address は「鹿児島市中山」のような建築地。市区町村の前方一致で
//   突合するため、そのまま返してフロントで判定する。
// ---------------------------------------------------------------------------
$sqlOrder = "
    SELECT
      '注文'                        AS category,
      DATE_FORMAT(constructionDate, '%Y-%m-%d') AS constructionDate,
      pref,
      address,
      staff,
      shop,
      section
    FROM contract_customer
    WHERE category = '注文'
      AND status <> '解約'
      AND constructionDate IS NOT NULL
    ORDER BY constructionDate";

// ---------------------------------------------------------------------------
// 建売
//   area は市区町村そのものが入っているので、areaKey は不要（郡接頭辞が無い）。
//   ただし表記を他テーブルとそろえるため同じ式を通しておく。
// ---------------------------------------------------------------------------
$areaKey = marketAreaKeyExpr('area');

$sqlSpec = "
    SELECT
      '建売'                        AS category,
      DATE_FORMAT(constructionDate, '%Y-%m-%d') AS constructionDate,
      pref,
      area,
      {$areaKey}                    AS areaKey,
      staff,
      sales_status                  AS salesStatus,
      progress_status               AS progressStatus
    FROM kaeru_building
    WHERE category = '建売'
      AND sales_status <> 'キャンセル'
      AND constructionDate IS NOT NULL
    ORDER BY constructionDate";

try {
    $fetch = static function (PDO $pdo, string $sql): array {
        $stmt = $pdo->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    };

    marketRespond([
        'order' => $fetch($pdo, $sqlOrder),
        'spec'  => $fetch($pdo, $sqlSpec),
    ]);
} catch (PDOException $e) {
    marketFail('market_construction', $e);
}
