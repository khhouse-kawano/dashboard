/**
 * 店舗別動向（shopTrend/ShopTrendOrder.tsx / ShopTrendKaeru.tsx / ShopTrendResale.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **SELECT の列と別名は PHP から1文字も変えていない。**
 *   移植元:
 *     backend/src/handlers/shopTrendAction/shopTrend_order.php （category = 'order'）
 *     backend/src/handlers/shopTrendAction/shopTrend_spec.php  （category = 'spec' ＝建売）
 *     backend/src/handlers/shopTrendAction/shopTrend_used.php  （category = 'used' ＝中古）
 *
 * ⚠️ 3画面は「似ているが別物」である。**共通化しないこと。**
 *
 *                order              spec                used
 *   顧客テーブル master_data        master_data_kaeru   master_data_resale
 *   店舗         division のみ      + show_flag = 1     + show_flag = 1
 *   スタッフ     rank = 1           rank = 1            ⚠️ + section = '中古住宅専門店'
 *   媒体         medium_list        medium_kaeru        medium_resale
 *   販促費       section = 'order'  section = 'spec'    ⚠️ section = 'use'（used ではない）
 * ─────────────────────────────────────────────
 */

export type ShopTrendCategory = 'order' | 'spec' | 'used';

/** 事業区分。⚠️ used は「中古リノベ」 */
const DIVISION: Record<ShopTrendCategory, string> = {
  order: '注文事業',
  spec: '建売分譲事業',
  used: '中古リノベ',
};

/**
 * 販促費の section。
 * ⚠️⚠️ **used は 'use'。'used' ではない。**
 *   budget.section の実データは order / spec / use のみ（used は0件）。
 *   'used' で絞ると販促費が1件も取れず、画面の広告費がすべて0になる。
 */
const BUDGET_SECTION: Record<ShopTrendCategory, string> = {
  order: 'order',
  spec: 'spec',
  used: 'use',
};

/**
 * 担当営業。
 * ⚠️ used だけ `position` を取得し、かつ `section = '中古住宅専門店'` で絞る。
 *   order / spec は rank = 1 の全件。
 */
const STAFF_SQL: Record<ShopTrendCategory, string> = {
  order: `SELECT name, shop, section, sort, \`rank\`, period FROM staff_list WHERE \`rank\` = 1`,
  spec: `SELECT name, shop, section, sort, \`rank\`, period FROM staff_list WHERE \`rank\` = 1`,
  used: `SELECT name, shop, section, sort, \`rank\`, period, position
           FROM staff_list WHERE \`rank\` = 1 AND section = '中古住宅専門店'`,
};

/**
 * 店舗。
 * ⚠️ order だけ `show_flag` で絞っていない（PHP のまま）。
 *   揃えると order の店舗数が変わり、行数と集計が変わる。
 */
const SHOP_SQL: Record<ShopTrendCategory, string> = {
  order: `SELECT shop, section FROM shop_list WHERE division = ?`,
  spec: `SELECT shop, section FROM shop_list WHERE division = ? AND show_flag = 1`,
  used: `SELECT shop, section FROM shop_list WHERE division = ? AND show_flag = 1`,
};

const SECTION_SQL = `SELECT name FROM section_list WHERE division = ?`;

/**
 * 顧客一覧。
 *
 * ⚠️⚠️ **同じフェーズ列が事業ごとに別の意味で使われている。**
 *   例: step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
 *       order → contract（契約）
 *       spec  → application（申し込み）
 *       used  → contract_reform（リフォーム契約）
 *   列名から意味を推測せず、この対応表のとおりに扱うこと。
 *
 * ⚠️ used は `step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0` を
 *   **contract_sell と negotiation の2つの別名で返している**（PHP のまま）。
 *   重複しているが、フロントが両方の名前で読んでいる可能性があるため揃えない。
 */
const CUSTOMER_SQL: Record<ShopTrendCategory, string> = {
  order: `
    SELECT id,
      COALESCE(customer_contacts_name, '') as customer,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(in_charge_user, '') as staff,
      COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG , '')as contract,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
      COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
      COALESCE(reserved_interview, '') as reserved_interview,
      COALESCE(status , '') as status
      FROM master_data WHERE show_dashboard = 1`,

  spec: `
    SELECT id,
      COALESCE(customer_contacts_name, '') as customer,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(in_charge_user, '') as staff,
      COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '') as contract,
      COALESCE(step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '') as contract_broker,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as application,
      COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
      COALESCE(step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '') as obtain,
      COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
      COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
      COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
      COALESCE(reserved_interview, '') as reserved_interview,
      COALESCE(status , '') as status
      FROM master_data_kaeru WHERE show_dashboard = 1`,

  used: `
    SELECT id,
      COALESCE(customer_contacts_name, '') as customer,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(in_charge_user, '') as staff,
      COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '')as contact,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')as contract_reform,
      COALESCE(step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '')as contract_buy,
      COALESCE(step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '')as contract_sell,
      COALESCE(step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN, '')as valuation,
      COALESCE(step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '')as negotiation,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
      COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
      COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
      COALESCE(step_migration_item_01J82Z5F1WE8SKEES6VNN37B22, '') as appraisal,
      COALESCE(step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '') as negotiation_apo,
      COALESCE(contraction_contract_price, '') as profit,
      COALESCE(reserved_interview, '') as reserved_interview,
      COALESCE(status , '') as status
      FROM master_data_resale WHERE show_dashboard = 1`,
};

/**
 * 販促媒体。
 * ⚠️ order だけ列を2つに絞る（medium / list_medium）。
 *   spec / used は専用テーブルの全列（SELECT *）。
 */
const MEDIUM_SQL: Record<ShopTrendCategory, string> = {
  order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
  used: `SELECT * FROM medium_resale`,
};

/**
 * 販促費。
 * ⚠️ `response_medium = 0`（反響媒体ではないもの）で共通。
 *   section だけ事業で変わる（BUDGET_SECTION 参照）。
 */
const BUDGET_SQL = `SELECT * FROM budget WHERE response_medium = 0 AND section = ?`;

export const shopTrendSql = (category: ShopTrendCategory) => ({
  staff: STAFF_SQL[category],
  shop: SHOP_SQL[category],
  section: SECTION_SQL,
  customer: CUSTOMER_SQL[category],
  medium: MEDIUM_SQL[category],
  budget: BUDGET_SQL,
  division: DIVISION[category],
  budgetSection: BUDGET_SECTION[category],
});
