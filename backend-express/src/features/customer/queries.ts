/**
 * 販促媒体別ランキング（customer/CustomerOrder.tsx / CustomerKaeru.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **shop/queries.ts と同じ内容にしてある**（2026-09-14 の指示「shop を踏襲」）。
 *   画面の違いは**行が店舗か販促媒体か**だけで、必要なデータは同じである。
 *   ⚠️ KPI の判定もフロント側で shop と同じものを使う。食い違うと
 *     店舗ランキングと媒体ランキングで合計が合わなくなる。
 *
 * ⚠️⚠️ **移植元の PHP には誤りが2つあった。ここでは直してある。**
 *
 *   ① `customer_spec.php` は建売で
 *        step_migration_item_01J82Z5F1RR18Z792C7KZS88QG を `contract` として取っていた。
 *      ⚠️ **建売ではこの列は `application`（申込み）である。**
 *        契約は 01JP74NGRTT95X4Z8AQZ2QK2PW（＋仲介 01JV6AVXQMJY6XR4STWCHNKVE0）。
 *        ⚠️ つまり**契約数として申込み数が出ていた。**
 *
 *   ② `customer_spec.php` の販促費は `WHERE response_medium = 0` だけで
 *      **事業で絞っていなかった**。建売の画面に注文事業の広告費まで乗るため、
 *      単価が実際より高く出る。⚠️ `section = 'spec'` を付けた。
 *
 *   ⚠️ ① の PHP も同じ形に直してある。**片方だけ直さないこと。**
 *
 * ⚠️ `used`（中古）は無い。CustomerRouter.tsx が order / spec しか出さない。
 *   ⚠️ ① の customer.php は used も許可しているが、②には登録しない。
 * ─────────────────────────────────────────────
 */

export type CustomerCategory = 'order' | 'spec';

/** 事業区分 */
const DIVISION: Record<CustomerCategory, string> = {
  order: '注文事業',
  spec: '建売分譲事業',
};

/** 販促費の section */
const BUDGET_SECTION: Record<CustomerCategory, string> = {
  order: 'order',
  spec: 'spec',
};

/**
 * 店舗。
 * ⚠️ order は `area` も返す（絞り込みに使う）。spec は使っていない。
 * ⚠️ spec は `show_flag = 1` で絞る（他の建売画面と揃える）。
 */
const SHOP_SQL: Record<CustomerCategory, string> = {
  order: `SELECT shop, section, area FROM shop_list WHERE division = ?`,
  spec: `SELECT shop, section FROM shop_list WHERE division = ? AND show_flag = 1`,
};

const SECTION_SQL = `SELECT name FROM section_list WHERE division = ?`;

/**
 * 顧客一覧。
 *
 * ⚠️⚠️ **同じフェーズ列が事業ごとに別の意味を持つ。** 列名から推測しないこと。
 *   step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
 *     order → contract（契約）
 *     spec  → application（申し込み）
 *
 * ⚠️ 列と別名は shop/queries.ts と揃えてある。フロントの KPI 判定を
 *   ShopOrder / ShopKaeru と共通の考え方にするため。
 */
const CUSTOMER_SQL: Record<CustomerCategory, string> = {
  order: `
    SELECT id,
      COALESCE(customer_contacts_name, '') as customer,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(in_charge_user, '') as staff,
      COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as contract,
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
      COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
      COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
      COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
      COALESCE(reserved_interview, '') as reserved_interview,
      COALESCE(status , '') as status
      FROM master_data_kaeru WHERE show_dashboard = 1`,
};

/**
 * 販促媒体。
 *
 * ⚠️ order は medium_list（フロントが `list_medium === 1` で絞る）。
 * ⚠️⚠️ **spec は medium_kaeru の全件をそのまま行にする**
 *   （2026-09-14 に利用者が明言。ShopTrendKaeru.tsx と同じ扱い）。
 *   ⚠️ 以前 CustomerKaeru.tsx は `list_medium === 1` で絞っていたが、
 *     **medium_kaeru に `list_medium` 列は存在しない。**
 *     `undefined === 1` は常に false になり、**販促媒体の行が1つも
 *     出ていなかった**（表は「総反響」だけ）。エラーは出ない。
 */
const MEDIUM_SQL: Record<CustomerCategory, string> = {
  order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
};

/**
 * 販促費。
 * ⚠️ **事業で絞ること。** 移植元の customer_spec.php は絞っておらず、
 *   建売の画面に注文事業の広告費まで乗っていた（単価が高く出る）。
 */
const BUDGET_SQL = `SELECT * FROM budget WHERE response_medium = 0 AND section = ?`;

export const customerSql = (category: CustomerCategory) => ({
  shop: SHOP_SQL[category],
  section: SECTION_SQL,
  customer: CUSTOMER_SQL[category],
  medium: MEDIUM_SQL[category],
  budget: BUDGET_SQL,
  division: DIVISION[category],
  budgetSection: BUDGET_SECTION[category],
});
