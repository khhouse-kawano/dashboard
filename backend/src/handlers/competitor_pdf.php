<?php

/**
 * 他社資料一覧（header/CompetitorMaterials.tsx）。
 *
 * ⚠️⚠️ **backend-express/src/features/competitorPdf.ts と対になっている。**
 *   ⚠️ 通常は ② が応答する。⚠️ **ここは ② が落ちたときのフォールバック。**
 *   ⚠️ ⚠️ **応答の形（列名・別名）を1文字も違えないこと。**
 *     ⚠️ 違うと、② が落ちた日だけ画面が空になる。
 *
 * ⚠️⚠️ **2026-09-21 に competitor_pdf を「1ファイル1行」に作り替えた。**
 *   旧: 顧客1人につき1行。`pdf_path` に JSON 配列。
 *   新: no / id / name / path / staff / company / category の1ファイル1行。
 *   ⚠️ 2026-09-21_competitor_pdf_one_row_per_file.sql を先に流すこと。
 *
 * ⚠️ 移植前は「PDF」「店舗」「顧客（master_data 全件）」を丸ごと返し、
 *   画面側で突き合わせていた。⚠️ **顧客は24,000件あり無駄が大きい**ので
 *   SQL で結合する形に変えてある。
 */

/**
 * 資料の一覧。
 *
 * ⚠️⚠️ **顧客は3事業ぶんある。** `competitor_pdf.id` は
 *   master_data / master_data_kaeru / master_data_resale のいずれかを指す。
 *   ⚠️ id は3テーブルで重複しない。
 *   ⚠️ ⚠️ **注文だけを見ると、建売・中古の資料が「顧客名なし」になる。**
 *
 * ⚠️ `LEFT JOIN` にすること。⚠️ **顧客が消えていても資料は一覧に出す。**
 */
$sql_pdf = "
  SELECT
    p.no,
    p.id,
    COALESCE(p.name, '')     AS file_name,
    COALESCE(p.path, '')     AS pdf_url,
    COALESCE(p.staff, '')    AS staff,
    COALESCE(p.company, '')  AS company,
    COALESCE(p.category, '') AS category,
    p.created,
    COALESCE(c.customer_contacts_name, '') AS customer_name,
    COALESCE(c.in_charge_store, '')        AS shop_name,
    COALESCE(c.in_charge_user, '')         AS in_charge_user,
    COALESCE(c.status, '')                 AS status,
    COALESCE(s.brand, '')                  AS brand,
    COALESCE(s.division, '')               AS division,
    COALESCE(s.section, '')                AS section
  FROM competitor_pdf p
  LEFT JOIN (
    SELECT id, customer_contacts_name, in_charge_store, in_charge_user, status FROM master_data
    UNION ALL
    SELECT id, customer_contacts_name, in_charge_store, in_charge_user, status FROM master_data_kaeru
    UNION ALL
    SELECT id, customer_contacts_name, in_charge_store, in_charge_user, status FROM master_data_resale
  ) c ON c.id = p.id
  LEFT JOIN shop_list s ON s.shop = c.in_charge_store
  ORDER BY p.no DESC
";
$stmt_pdf = $pdo->prepare($sql_pdf);
$stmt_pdf->execute();
$response_pdf = $stmt_pdf->fetchAll(PDO::FETCH_ASSOC);

/**
 * 他社名の候補。
 *
 * ⚠️ 一覧から他社名を直せるようにするために返す。
 *   ⚠️ 既存53件のうち11件は `company` が空のまま移行した（判断できなかったもの）。
 */
$sql_maker = "SELECT label, letter FROM house_maker ORDER BY letter, label";
$stmt_maker = $pdo->prepare($sql_maker);
$stmt_maker->execute();
$response_maker = $stmt_maker->fetchAll(PDO::FETCH_ASSOC);

$result = [
    "pdf" => $response_pdf,
    "maker" => $response_maker,
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
