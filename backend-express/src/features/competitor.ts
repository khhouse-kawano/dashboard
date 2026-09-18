import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 競合サマリー（header/CompetitorSummary.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/competitor.php`
 *
 * ⚠️⚠️ **参照のみ。** 書き込みは一切しない。
 *   ⚠️ ① に PHP ハンドラが実在するので、転送に失敗しても ① へ
 *     自動フォールバックして動く（`expressProxyExclusive` には入れない）。
 *
 * ⚠️⚠️ **列と別名は移植元から1文字も変えないこと。**
 *   ⚠️ 画面が別名をそのまま使っている（`competitor` / `lost_competitor` など）。
 *   ⚠️ 読みやすい名前に変えると、**表が全部0件になる**（エラーは出ない）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * 店舗。
 * ⚠️ `report_flag = 1` で絞るのは移植元と同じ。画面は `section` で店舗を束ねる。
 */
const SHOP_SQL = `
  SELECT brand, shop, division, section, multi, report_flag
    FROM shop_list
   WHERE report_flag = 1
`;

const SECTION_SQL = 'SELECT division, name FROM section_list';

/**
 * 顧客一覧（注文事業）。
 *
 * ⚠️⚠️ **`customized_input_01JRF9CZSW65A151WR30NA4PB3` が
 *   `reason` と `lost_reason_detail` の2つの別名で出ている。**
 *   ⚠️ 移植元がそうなっている。⚠️ **画面は `lost_reason_detail` だけを使う。**
 *   ⚠️ 直したくなるが、⚠️ **応答の形が変わると ① との差分になる**ので残す。
 *
 * ⚠️⚠️ **2026-09-18 に勝因・敗因の5列を足した。**
 *   ⚠️ 契約列・失注列のモーダル（案件ごとのカード）で使う。
 *   ⚠️ ⚠️ **`master_data` にこれらの列が無いと `Unknown column` で画面が開かない。**
 *     ⚠️ v2.2.136 の `2026-09-17_master_data_win_lose.sql` を先に流すこと。
 *   ⚠️ ① の competitor.php にも**同じ5行を足してある。** 片方だけにしないこと。
 *
 * ⚠️ 移植元は `master_data` を全件返している。⚠️ **絞り込みは画面側**である
 *   （店舗・営業課・競合名）。⚠️ ここで絞ると画面の絞り込みと二重になる。
 */
const CONTRACT_SQL = `
  SELECT
    COALESCE(id, '') as id,
    COALESCE(in_charge_store, '') as shop,
    COALESCE(in_charge_user, '') as staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
    COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') as reason,
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') as reason_detail,
    COALESCE(customer_contacts_annual_income, '') as income,
    COALESCE(last_action_step_migration_item_name, '') as change_reason,
    COALESCE(competitors_text, '') as competitor,
    COALESCE(competitor_name, '') as lost_competitor,
    COALESCE(competitor_lost_contract_reason, '') as lost_reason,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') as lost_reason_detail,
    COALESCE(sales_promotion_name, '') as medium,
    COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
    COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
    COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
    COALESCE(status, '') as status,
    COALESCE(rank_period, '') as rank_period,
    COALESCE(customer_contacts_name, '') as customer,
    COALESCE(competitor_win_reason, '') as win_reason,
    COALESCE(competitor_price_gap, '') as price_gap,
    COALESCE(competitor_sales_person, '') as sales_person,
    COALESCE(competitor_countermeasure, '') as countermeasure,
    COALESCE(competitor_campaign, '') as rival_campaign
  FROM master_data
`;

const MAKER_SQL = 'SELECT * FROM house_maker';

export interface CompetitorResponse {
  shop: Record<string, unknown>[];
  section: Record<string, unknown>[];
  contract: Record<string, unknown>[];
  maker: Record<string, unknown>[];
}

export const runCompetitor = async (): Promise<CompetitorResponse> => {
  // ⚠️ 4つとも独立しているので並べて取る。移植元は直列だった
  const [shop, section, contract, maker] = await Promise.all([
    query<DynamicRow>(SHOP_SQL),
    query<DynamicRow>(SECTION_SQL),
    query<DynamicRow>(CONTRACT_SQL),
    query<DynamicRow>(MAKER_SQL),
  ]);

  return { shop, section, contract, maker };
};
