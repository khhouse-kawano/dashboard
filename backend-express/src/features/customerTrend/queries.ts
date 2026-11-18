/**
 * 販促媒体別動向（customerTrend/CustomerTrendOrder.tsx / CustomerTrendKaeru.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **SELECT の列と別名は PHP から変えていない。**
 *   移植元:
 *     backend/src/handlers/customerTrendAction/customerTrend_order.php （category = 'order'）
 *     backend/src/handlers/customerTrendAction/customerTrend_spec.php  （category = 'spec' ＝建売）
 *
 *   唯一の追加は shop の `multi` / `parent_shop`（併売店まとめ用）。
 *   ⚠️ ① の PHP にも同じ2列を足してある。足さないと 5xx でフォールバックした
 *     ときに**まとめが黙って効かなくなる**。
 *
 * ⚠️⚠️ **`used`（中古）は存在しない。**
 *   `customerTrendAction/customerTrend_used.php` は無く、
 *   `CustomerTrendResale.tsx` も中身が無いプレースホルダである。
 *   ① の customerTrend.php は `used` を許可カテゴリに入れているが、
 *   require するファイルが無いため**実際には 500 になる**。
 *   ここでは 400（無効なカテゴリです）を返す。⚠️ ② に登録するのは
 *   order / spec だけ。used を登録すると、壊れている経路を
 *   「動いているように見せる」ことになるので登録しない。
 *
 * ⚠️ shopTrend とは**別物**である。共通化しないこと。
 *   shopTrend … 行が「店舗」。歩留まりを店舗ごとに見る
 *   customerTrend … 行が「販促媒体」。歩留まりを媒体ごとに見る
 * ─────────────────────────────────────────────
 */

export type CustomerTrendCategory = 'order' | 'spec';

/** 事業区分 */
const DIVISION: Record<CustomerTrendCategory, string> = {
  order: '注文事業',
  spec: '建売分譲事業',
};

/**
 * 担当営業。
 * ⚠️ order は取得しない（PHP にクエリが無い）。spec だけ返す。
 *   揃えると order の応答に無かったキーが増える。
 */
const STAFF_SQL: Record<CustomerTrendCategory, string | null> = {
  order: null,
  spec: `SELECT name, shop, section, sort, \`rank\`, period FROM staff_list WHERE \`rank\` = 1`,
};

/**
 * 店舗。
 * ⚠️ order だけ `brand` / `area` を取り、`show_flag` で絞らない（PHP のまま）。
 *
 * ⚠️⚠️ **`multi` / `parent_shop` は order にだけ足している。**
 *   「併売店をまとめる」は注文事業だけの機能で、
 *   **建売に併売店の概念は無い**（2026-09-11 に利用者が明言）。
 *   spec に足しても使い道が無く、転送量が増えるだけである。
 */
const SHOP_SQL: Record<CustomerTrendCategory, string> = {
  order: `SELECT shop, section, brand, area, multi, parent_shop
            FROM shop_list WHERE division = ?`,
  spec: `SELECT shop, section
           FROM shop_list WHERE division = ? AND show_flag = 1`,
};

/**
 * 営業課。
 * ⚠️ order は取得しない（PHP にクエリが無い）。spec だけ返す。
 */
const SECTION_SQL: Record<CustomerTrendCategory, string | null> = {
  order: null,
  spec: `SELECT name FROM section_list WHERE division = ?`,
};

/**
 * 顧客一覧。
 *
 * ⚠️⚠️ **同じフェーズ列が事業ごとに別の意味を持つ。** 列名から推測しないこと。
 *   例: step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
 *       order → contract（契約）
 *       spec  → application（申し込み）
 *
 * ⚠️⚠️ **order は `show_dashboard = 1` で絞るが、spec は絞らない。**
 *   spec は `show_dashboard` を**列として返し**、フロント
 *   （CustomerTrendKaeru.tsx の isDuplicate）が絞り込みを切り替える。
 *   ここで絞ると「重複を含める」が効かなくなる。
 */
const CUSTOMER_SQL: Record<CustomerTrendCategory, string> = {
  order: `
    SELECT id,
      COALESCE(customer_contacts_name, '') as customer,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(in_charge_user, '') as staff,
      COALESCE(hp_campaign, '') as hp_campaign,
      COALESCE(portal_flag, 0) as portal_flag,
      COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') as \`rank\`,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG , '')as contract,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
      COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
      COALESCE(reserved_interview, '') as reserved_interview,
      COALESCE(status , '') as status,
      COALESCE(delete_dashboard, 0) AS delete_dashboard
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
      COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') as screening,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') as application,
      COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') as appointment,
      COALESCE(step_migration_item_01J95TGVT725CV1Z4HTWB22DAV, '') as obtain,
      COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
      COALESCE(step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z, '') as contact,
      COALESCE(hp_campaign, '') as hp_campaign,
      COALESCE(portal_flag, 0) as portal_flag,
      COALESCE(show_dashboard, 0) as show_dashboard,
      COALESCE(status , '') as status,
      COALESCE(delete_dashboard, 0) AS delete_dashboard
      FROM master_data_kaeru WHERE 1 = 1`,
};

/**
 * 画面が月を数えるのに使う日付の列（v2.2.278。店舗別反響推移の DATE_COLUMNS と同じ考え方）。
 *
 * ⚠️⚠️ **画面のどの数字も「この列のどれか1つが表示月（昨年実績なら前年同月も）に入る行」しか数えない。**
 *   このどれかが期間に入る行に絞れば、全件のときと数字は変わらない（「全期間」の列も表示月の合計）。
 * ⚠️ 画面（CustomerTrend*.tsx）の集計で見る列を増やしたら、ここにも足すこと。足さないと数字が減る。
 * ⚠️ ① の customerTrendAction/customerTrend_{category}.php の $customerTrendDateColumns と同じにすること。
 */
const DATE_COLUMNS: Record<CustomerTrendCategory, readonly string[]> = {
  // register / interview / appointment / screening / contract / 来場予約（⚠️ 集計には使っていないが、応答に入っているので残す）
  order: [
    'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
    'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
    'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    'reserved_interview',
  ],
  // register / contact / interview / tour / appointment / screening / obtain / application / contract / contract_broker
  spec: [
    'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
    'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z',
    'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
    'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
    'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
    'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
    'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0',
  ],
};

/**
 * 期間を送られたときの販促費（v2.2.278）。⚠️ 画面が使う6列だけ・その事業の section だけ。
 * ⚠️ order の画面は section === 'order' の行しか数えていない（CustomerTrendOrder.tsx）ので、section で絞っても数字は同じ。
 * ⚠️ 期間が無いとき（古い画面）は今までどおり BUDGET_SQL（order は section で絞らない）。
 */
const BUDGET_PERIOD_SQL = `SELECT budget_period, shop, medium, budget_value, section, order_section
  FROM budget WHERE response_medium = 0 AND section = ?`;
const BUDGET_SECTION: Record<CustomerTrendCategory, string> = {
  order: 'order',
  spec: 'spec',
};

/**
 * 販促媒体。
 * ⚠️ order は列を絞り `response_medium = 0`。spec は medium_kaeru の全列。
 */
const MEDIUM_SQL: Record<CustomerTrendCategory, string> = {
  order: `SELECT medium, list_medium, sort_key, category, response_medium
            FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
};

/**
 * 販促費。
 * ⚠️⚠️ **order は section で絞らない。** spec だけ `section = 'spec'` が付く。
 *   order に section = 'order' を足すと取得件数が変わり、広告費が合わなくなる。
 */
const BUDGET_SQL: Record<CustomerTrendCategory, string> = {
  order: `SELECT * FROM budget WHERE response_medium = 0`,
  spec: `SELECT * FROM budget WHERE response_medium = 0 AND section = 'spec'`,
};

export const customerTrendSql = (category: CustomerTrendCategory) => ({
  staff: STAFF_SQL[category],
  shop: SHOP_SQL[category],
  section: SECTION_SQL[category],
  customer: CUSTOMER_SQL[category],
  medium: MEDIUM_SQL[category],
  budget: BUDGET_SQL[category],
  budgetPeriod: BUDGET_PERIOD_SQL,
  budgetSection: BUDGET_SECTION[category],
  dateColumns: DATE_COLUMNS[category],
  division: DIVISION[category],
});
