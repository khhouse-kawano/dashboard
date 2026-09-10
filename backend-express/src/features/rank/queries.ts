/**
 * ランク管理（RankOrder / RankKaeru / RankResale）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **SELECT の列と別名は PHP から1文字も変えていない。**
 *   移植元:
 *     backend/src/handlers/rankAction/rank_order.php  （category = 'order'）
 *     backend/src/handlers/rankAction/rank_spec.php   （category = 'spec' ＝建売）
 *     backend/src/handlers/rankAction/rank_used.php   （category = 'used' ＝中古）
 *
 *   別名（as）はフロントの型（Customer）にそのまま対応している。
 *   1つ変えただけで画面の集計が静かに 0 になる。
 *
 * ⚠️ 3事業でテーブルが違う。
 *     order … master_data
 *     spec  … master_data_kaeru
 *     used  … master_data_resale
 *
 * ⚠️ 同じフェーズ列が事業ごとに**別の意味**で使われている。
 *   例: step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
 *       order → contract（契約）
 *       spec  → application（申し込み）
 *       used  → contract（リフォーム契約）
 *   列名から意味を推測せず、この対応表のとおりに扱うこと。
 * ─────────────────────────────────────────────
 */

export type RankCategory = 'order' | 'spec' | 'used';

/** 事業ごとの顧客テーブル */
export const RANK_TABLE: Record<RankCategory, string> = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
};

/** 事業ごとの shop_list.division */
const DIVISION: Record<RankCategory, string> = {
  order: '注文事業',
  spec: '建売分譲事業',
  used: '中古リノベ',
};

/**
 * 担当営業。
 *
 * ⚠️ order だけ `khg_id` を取得する（rank_order.php のみ）。
 *   spec / used は取っていない。フロントが使っていないため揃えていないが、
 *   ここを勝手に揃えると PHP との差分比較が合わなくなる。
 */
const STAFF_SQL: Record<RankCategory, string> = {
  order: `SELECT name, shop, section, sort, memo, period, khg_id, position
            FROM staff_list WHERE rank = 1`,
  spec: `SELECT name, shop, section, sort, period, position, memo
           FROM staff_list WHERE rank = 1`,
  used: `SELECT name, shop, section, sort, period, position, memo
           FROM staff_list WHERE rank = 1`,
};

/**
 * 店舗。
 *
 * ⚠️ used だけ `division` を取得していない（rank_used.php のみ）。
 *   PHP に合わせる。
 */
const SHOP_SQL: Record<RankCategory, string> = {
  order: `SELECT shop, section, division FROM shop_list WHERE division = ?`,
  spec: `SELECT shop, section, division FROM shop_list WHERE division = ?`,
  used: `SELECT shop, section FROM shop_list WHERE division = ?`,
};

const SECTION_SQL = `SELECT name FROM section_list WHERE division = ?`;

/**
 * 顧客一覧。
 *
 * ⚠️ spec だけ `AND in_charge_store <> ''` が付く（rank_spec.php のみ）。
 *   担当店舗が未設定の建売顧客を集計から外す運用。外すと件数が変わる。
 */
const CUSTOMER_SQL: Record<RankCategory, string> = {
  order: `
    SELECT id,
           customer_contacts_name as customer,
           in_charge_store as shop,
           in_charge_user as staff,
           first_interviewed_user as prev_staff,
           customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
           step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
           step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
           step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
           step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
           step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
           status,
           rank_period
      FROM master_data
     WHERE show_dashboard = 1`,

  spec: `
    SELECT id,
           customer_contacts_name as customer,
           in_charge_store as shop,
           in_charge_user as staff,
           customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
           step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract,
           step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z as contact,
           step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_broker,
           step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
           step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as application,
           step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
           step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG as tour,
           step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
           step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
           step_migration_item_01J95TGVT725CV1Z4HTWB22DAV as obtain,
           status,
           rank_period
      FROM master_data_kaeru
     WHERE show_dashboard = 1 AND in_charge_store <> ''`,

  used: `
    SELECT id,
           customer_contacts_name as customer,
           in_charge_store as shop,
           in_charge_user as staff,
           customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
           step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
           step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract_apply,
           step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_lead,
           step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
           step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
           step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
           step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
           contraction_contract_price as budget_total,
           contract_land_application_date as budget_reform,
           contract_building_application_date as budget_apply,
           status,
           rank_period
      FROM master_data_resale
     WHERE show_dashboard = 1`,
};

const ACHIEVEMENT_SQL = `SELECT category, name, period, value FROM company_achievement`;
const EXPECTED_SQL = `SELECT * FROM contract_expected`;

/**
 * ランク更新後に返す顧客一覧。
 *
 * ⚠️⚠️ **初期表示（CUSTOMER_SQL）とは列が違う。** 移植元
 *   rank_{cat}_update_rank.php の SELECT は列が少なく、
 *   screening / appointment / tour などを**返していない**。
 *
 *   フロントは `setCustomerList(response.data.newCustomers)` で
 *   一覧を丸ごと差し替えるため、ランクを変えた直後だけ
 *   次アポ数や事前審査数が 0 になる（⚠️ 既存の不具合）。
 *   移植では挙動を変えないためそのまま写している。
 *   直すなら CUSTOMER_SQL を返すようにするが、画面の集計値が
 *   変わるので別途の判断が必要。
 *
 * ⚠️ order だけ prev_staff を返す（PHP と同じ）。
 */
const UPDATED_CUSTOMER_SQL: Record<RankCategory, string> = {
  order: `
    SELECT id,
           customer_contacts_name as customer,
           in_charge_store as shop,
           in_charge_user as staff,
           first_interviewed_user as prev_staff,
           customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
           step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
           step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
           step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
           status,
           rank_period
      FROM master_data
     WHERE show_dashboard = 1`,

  spec: `
    SELECT id,
           customer_contacts_name as customer,
           in_charge_store as shop,
           in_charge_user as staff,
           customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
           step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
           step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
           step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
           status,
           rank_period
      FROM master_data_kaeru
     WHERE show_dashboard = 1`,

  used: `
    SELECT id,
           customer_contacts_name as customer,
           in_charge_store as shop,
           in_charge_user as staff,
           customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
           step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
           step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
           step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
           status,
           rank_period
      FROM master_data_resale
     WHERE show_dashboard = 1`,
};

/**
 * ランクを保存する列。
 * ⚠️ 3事業とも同じ列（customized_input_01J82Z5F366ZQ897PXWF6H5ZAM）。
 */
export const RANK_COLUMN = 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM';

export const rankSql = (category: RankCategory) => ({
  staff: STAFF_SQL[category],
  shop: SHOP_SQL[category],
  section: SECTION_SQL,
  customer: CUSTOMER_SQL[category],
  achievement: ACHIEVEMENT_SQL,
  expected: EXPECTED_SQL,
  updatedCustomer: UPDATED_CUSTOMER_SQL[category],
  division: DIVISION[category],
});
