/**
 * 広告費シミュレーター（header/BudgetSimulator.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-14 に作り直した。移植ではなく差し替えである。**
 *   移植元の `backend/src/handlers/budget_simulator.php` は
 *   契約数と目標だけを返しており、単価の算出に必要な列が無かった。
 *     ・`sales_promotion_name`（販促媒体）… 媒体別の集計に要る
 *     ・`interview` / `appointment` / `screening` … 来場・次アポの判定に要る
 *     ・`master_data_kaeru` … コメントアウトされていた
 *   ⚠️ ① の PHP も同じ内容へ書き換えてある。**片方だけ直さないこと。**
 *
 * ⚠️⚠️ **KPI の判定は shop/ShopOrder.tsx・ShopKaeru.tsx と同じにすること。**
 *   ここが食い違うと、同じ期間・同じ店舗なのに店舗ランキングと
 *   シミュレーターで数字が合わず、どちらが正しいか分からなくなる。
 *   ⚠️ 判定そのものは**フロントで行う**（あちらと同じコードを使うため）。
 *     サーバーは行を返すだけで、集計はしない。
 *
 * ⚠️ 顧客IDや氏名は返していない。画面に出さないためで、
 *   ⚠️ 数万行を返す API なので**列を増やすと素直に重くなる。**
 *   2026-09-11 に別の request が 17MB・120秒で切れた例がある。
 * ─────────────────────────────────────────────
 */

export type BudgetDivision = 'order' | 'spec';

/** 事業区分。⚠️ 画面の targetDivision と対応する */
const DIVISION: Record<BudgetDivision, string> = {
  order: '注文事業',
  spec: '建売分譲事業',
};

/**
 * 販促費の section。
 * ⚠️ shopTrend では used が 'use' だが、ここは order / spec だけなので素直。
 */
const BUDGET_SECTION: Record<BudgetDivision, string> = {
  order: 'order',
  spec: 'spec',
};

/**
 * 店舗。
 * ⚠️ `report_flag` では絞らない。旧 PHP は絞っていたが、
 *   店舗ランキング（ShopOrder / ShopKaeru）が絞っていないため、
 *   揃えないと**同じ条件で店舗数が違う**という分かりにくい差になる。
 * ⚠️ spec だけ `show_flag = 1`（他の建売画面と同じ）。
 */
const SHOP_SQL: Record<BudgetDivision, string> = {
  order: `SELECT id, brand, shop, section, area, division
            FROM shop_list WHERE division = ?`,
  spec: `SELECT id, brand, shop, section, area, division
           FROM shop_list WHERE division = ? AND show_flag = 1`,
};

const SECTION_SQL = `SELECT name FROM section_list WHERE division = ?`;

/**
 * 顧客。
 *
 * ⚠️⚠️ **同じフェーズ列が事業ごとに別の意味を持つ。** 列名から推測しないこと。
 *   step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
 *     order → contract（契約）
 *     spec  → application（申し込み）
 *
 * ⚠️ 別名は shop/queries.ts と揃えてある。フロントの KPI 判定を
 *   ShopOrder / ShopKaeru と共通化するため。
 */
const CUSTOMER_SQL: Record<BudgetDivision, string> = {
  order: `
    SELECT
      COALESCE(in_charge_store, '') as shop,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
      COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
      COALESCE(status, '') as status
      FROM master_data WHERE show_dashboard = 1`,
  spec: `
    SELECT
      COALESCE(in_charge_store, '') as shop,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as application,
      COALESCE(step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW, '') as contract,
      COALESCE(step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0, '') as contract_broker,
      COALESCE(status, '') as status
      FROM master_data_kaeru WHERE show_dashboard = 1`,
};

/**
 * 販促費。
 * ⚠️ `response_medium = 0`（反響媒体ではないもの）で共通。
 *   section だけ事業で変わる。
 * ⚠️ `medium` を返すこと。媒体別の広告費を出すのに要る。
 */
const BUDGET_SQL = `
  SELECT shop, medium, budget_period, budget_value
    FROM budget
   WHERE response_medium = 0 AND section = ?
`;

export const budgetSimulatorSql = (division: BudgetDivision) => ({
  shop: SHOP_SQL[division],
  section: SECTION_SQL,
  customer: CUSTOMER_SQL[division],
  budget: BUDGET_SQL,
  division: DIVISION[division],
  budgetSection: BUDGET_SECTION[division],
});
