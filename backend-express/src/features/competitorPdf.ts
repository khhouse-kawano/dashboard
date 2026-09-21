import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 他社資料一覧（header/CompetitorMaterials.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/competitor_pdf.php`
 *
 * ⚠️⚠️ **参照のみ。** 書き込みは一切しない。
 *   ⚠️ アップロードは ① の `competitor_pdf_upload.php` に残す。
 *     ⚠️ ファイルの実体は ① の `uploads/competitors/` にあり、
 *       ⚠️ **② から ① のファイルシステムへは書けない。**
 *
 * ⚠️ ① に PHP ハンドラが実在するので、転送に失敗しても ① へ
 *   自動フォールバックして動く（`expressProxyExclusive` には入れない）。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **2026-09-21 に competitor_pdf を「1ファイル1行」に作り替えた。**
 *
 *   旧: 顧客1人につき1行。`pdf_path` に JSON 配列。
 *       ⚠️ 9,333行のうち ⚠️ **PDF があるのは32行だけ**で、残りは空行だった。
 *   新: no / id / name / path / staff / company / category の1ファイル1行。
 *
 *   ⚠️ これにより ⚠️ **カテゴリ → 他社 → PDF のフォルダ表示が
 *     SQL の GROUP BY だけで作れる。**
 *   ⚠️ 旧構造では ⚠️ **9,333行を毎回パースしないと1件も絞り込めなかった。**
 *
 * ⚠️⚠️ **移植元は「PDFの一覧」「店舗」「顧客」を丸ごと返していた。**
 *   ⚠️ 画面はそれを突き合わせてブランドと顧客名を出していた。
 *   ⚠️ ⚠️ **ここでは SQL で結合して返す。**
 *     ⚠️ 顧客は master_data だけで 24,000件あり、
 *       ⚠️ **PDF がある32件のために全件を送るのは無駄**である。
 *   ⚠️ ⚠️ **応答の形が変わっている。** 画面も合わせて作り替えてある。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface CompetitorPdfResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/**
 * 資料の一覧。
 *
 * ⚠️⚠️ **顧客は3事業ぶんある。** ⚠️ `competitor_pdf.id` は
 *   master_data / master_data_kaeru / master_data_resale のいずれかを指す。
 *   ⚠️ id は3テーブルで重複しない（2026-09-09 に実データで確認。交差0件）。
 *   ⚠️ ⚠️ **注文だけを見ると、建売・中古の資料が「顧客名なし」になる。**
 *
 * ⚠️ 店舗は `shop_list` から brand を引く。⚠️ 突合できないものは空でよい
 *   （画面は「未設定」として出す）。
 *
 * ⚠️ `LEFT JOIN` にすること。⚠️ **顧客が消えていても資料は一覧に出す**
 *   （ファイルの実体は残っているので、辿れなくなるほうが困る）。
 */
const LIST_SQL = `
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
`;

/**
 * 他社名の候補。
 *
 * ⚠️⚠️ **一覧から他社名を直せるようにするために返す。**
 *   ⚠️ 既存53件のうち11件は `company` が空のまま移行した（判断できなかったもの）。
 *   ⚠️ ⚠️ **顧客詳細を開かなくても直せる**ようにしておく。
 *
 * ⚠️ `house_maker` は競合他社のマスタ（379件）。⚠️ `label` が表示名である。
 */
const MAKER_SQL = "SELECT label, letter FROM house_maker ORDER BY letter, label";

export const runCompetitorPdf = async (): Promise<CompetitorPdfResult> => {
  const [pdf, maker] = await Promise.all([
    query<DynamicRow>(LIST_SQL),
    query<DynamicRow>(MAKER_SQL),
  ]);

  return { httpStatus: 200, body: { pdf, maker } };
};
