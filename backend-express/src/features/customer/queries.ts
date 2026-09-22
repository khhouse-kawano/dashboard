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
      -- ⚠️ 2026-09-22 追加。⚠️ **ホームページ反響かどうかの判定に使う。**
      --   ⚠️ CustomerTrendKaeru.tsx と同じ判定にするため（利用者の指示）。
      --   ⚠️ ⚠️ **① の customer_spec.php にも同じ行を足してあること。**
      COALESCE(hp_campaign, '') as hp_campaign,
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
const BUDGET_SQL: Record<CustomerCategory, string> = {
  order: `SELECT * FROM budget WHERE response_medium = 0 AND section = ?`,

  /**
   * ⚠️⚠️ **建売は「実績のある店舗」の販促費だけを見る**（2026-09-16 の指示）。
   *
   *   ⚠️ `section = 'spec'` だけでは、**反響を1件も持たない店舗**の広告費まで
   *     合計に乗る。⚠️ 分母（反響数）に対して分子（販促費）だけが増えるので
   *     **単価が実際より高く出る。**
   *
   *   ⚠️ 実データで落ちるのは次の5つ（2026-09-16 時点）。
   *       かえる鹿児島店   88件  12,673,423
   *       買い:中古リノベ 453件   6,738,032
   *       かえる宮崎店 / 大分店 / 熊本店  計19件  145,501
   *     ⚠️ 合計 282,481,113 → **262,924,157**（−19,556,956／−6.9%）。
   *
   * ⚠️⚠️ **`NOT IN` ではなく `IN` で書くこと。**
   *   ⚠️ `in_charge_store` には NULL と空文字が混ざっており、
   *     `NOT IN` だと比較結果が UNKNOWN になって**1行も返らない**
   *     （実際に検証中これを踏んだ）。
   *   ⚠️ 下では NULL と空文字を先に除いている。
   *
   * ⚠️ 列名は `in_charge_shop` ではなく **`in_charge_store`**。
   */
  spec: `
    SELECT * FROM budget
     WHERE response_medium = 0
       AND section = ?
       AND shop IN (
         SELECT DISTINCT in_charge_store
           FROM master_data_kaeru
          WHERE show_dashboard = 1
            AND in_charge_store IS NOT NULL
            AND in_charge_store <> ''
       )`,
};

export const customerSql = (category: CustomerCategory) => ({
  shop: SHOP_SQL[category],
  section: SECTION_SQL,
  customer: CUSTOMER_SQL[category],
  medium: MEDIUM_SQL[category],
  budget: BUDGET_SQL[category],
  division: DIVISION[category],
  budgetSection: BUDGET_SECTION[category],
});
