/**
 * 反響一覧（list/ListOrder.tsx / ListKaeru.tsx / ListResale.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **SELECT の列と別名は PHP から1文字も変えていない。**
 *   移植元:
 *     backend/src/handlers/listAction/list_order.php  （category = 'order'）
 *     backend/src/handlers/listAction/list_spec.php   （category = 'spec' ＝建売）
 *     backend/src/handlers/listAction/list_used.php   （category = 'used' ＝中古）
 *
 * ⚠️ 3画面は「似ているが別物」である。**共通化しないこと。**
 *   下の表のとおり、同じキー名で中身の条件がまるで違う。
 *
 *                order              spec               used
 *   summary元    master_data        master_data_kaeru  master_data_resale
 *   summary条件  ⚠️初回面談あり     ⚠️条件なし(全件)   ⚠️条件なし(全件)
 *   店舗         division='注文事業' brand='KHF'        brand='KHR'
 *   スタッフ     全件・列7つ         category=1・列4つ  全件・列5つ
 *   媒体         medium_list         medium_kaeru       medium_resale
 *   反響         inquiry_customer    〜_kaeru           〜_resale
 *   section      ⚠️ order のみ返す  返さない           返さない
 * ─────────────────────────────────────────────
 */

export type ListCategory = 'order' | 'spec' | 'used';

/**
 * 来場・反響の状況（画面の上部サマリー）。
 *
 * ⚠️⚠️ **order だけ「初回面談あり」で絞っている。**
 *   spec / used はテーブル全件を返す（絞り込みは画面側）。
 *   ここに条件を足したり外したりすると、上部の「反響合計」「来場合計」が
 *   静かに変わる。
 *
 * ⚠️ spec は `show_dashboard` を**列として返す**（絞り込みには使わない）。
 *   移植元のコメントによれば、顧客動向（customerTrend_spec.php）と
 *   同じ母数で数えるために画面側で使う。
 *   ⚠️ order は逆に `WHERE show_dashboard = 1` で**絞って**おり、列としては返さない。
 *
 * ⚠️ used だけ `category`（取引区分）を返す。上部サマリーの列がこれ。
 */
const SUMMARY_SQL: Record<ListCategory, string> = {
  order: `
    SELECT
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(sales_promotion_name, '') as medium
      FROM master_data
     WHERE show_dashboard = 1
       AND step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 <> ''
       AND step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 IS NOT NULL`,

  spec: `
    SELECT
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '') as tour,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(sales_promotion_name, '') as medium,
      COALESCE(show_dashboard, 0) as show_dashboard
      FROM master_data_kaeru`,

  used: `
    SELECT
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') as register,
      COALESCE(category, '') as category,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') as interview,
      COALESCE(in_charge_store, '') as shop,
      COALESCE(sales_promotion_name, '') as medium
      FROM master_data_resale`,
};

/**
 * 店舗。
 * ⚠️ order は division、spec / used は **brand** で絞る（PHP のまま）。
 *   KHF = かえる（建売）、KHR = 中古リノベ。
 */
const SHOP_SQL: Record<ListCategory, string> = {
  order: `SELECT shop, section, area FROM shop_list WHERE show_flag = 1 AND division = '注文事業'`,
  spec: `SELECT shop, section, area FROM shop_list WHERE brand = 'KHF' AND show_flag = 1`,
  used: `SELECT shop, section, area FROM shop_list WHERE brand = 'KHR' AND show_flag = 1`,
};

/**
 * スタッフ。
 * ⚠️ 3画面で**取得する列も絞り込みも違う**。揃えると画面の絞り込みが壊れる。
 *   order … 列7つ・全件（pg_id / category / position を使う）
 *   spec  … 列4つ・category = 1 のみ
 *   used  … 列5つ・全件
 */
const STAFF_SQL: Record<ListCategory, string> = {
  order: `SELECT name, pg_id, shop, category, period, section, position FROM staff_list`,
  spec: `SELECT name, shop, period, section FROM staff_list WHERE category = 1`,
  // ⚠️ PHP は `shop , period` と余分な空白があるが、結果には影響しない
  used: `SELECT name, shop, period, section, position FROM staff_list`,
};

/**
 * 販促媒体。
 * ⚠️ order だけ medium_list（response_medium = 0 で絞る）。
 *   spec / used は専用テーブルの**全列・全件**（SELECT *）。
 */
const MEDIUM_SQL: Record<ListCategory, string> = {
  order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
  used: `SELECT * FROM medium_resale`,
};

/**
 * 反響一覧。
 *
 * ⚠️⚠️ **列が3画面で違う。**
 *   order … mhl_id / mhl_url / mhl_mail / hotlead_url を持つ
 *   spec  … property / note を持ち、mhl 系と hotlead_url は無い
 *   used  … spec と同じ＋ category
 *
 * ⚠️ `WHERE first_name <> ''` は3画面共通。氏名の無い行を出さない。
 * ⚠️ `ORDER BY inquiry_date DESC`。⚠️ inquiry_date は text 型で
 *   'YYYY-MM-DD' と 'YYYY/MM/DD' が混在しているため、この並びだけでは
 *   日付順にならない。画面側（ListKaeru.tsx）で書式を揃えて並べ直している。
 */
const INQUIRY_SQL: Record<ListCategory, string> = {
  order: `
    SELECT id, inquiry_id, pg_id, mhl_id, mhl_url, mhl_mail, inquiry_date, medium, response_medium,
           first_name, last_name, first_name_kana, last_name_kana, mobile, landline, mail,
           zip, pref, city, town, street, building, brand, shop, sync, staff, area,
           reserved_date, hp_campaign, duplicate, hotlead_url,
           duplicate_flag, gift_flag, support_flag, black_flag
      FROM inquiry_customer
     WHERE first_name <> ''
     ORDER By inquiry_date DESC`,

  spec: `
    SELECT id, inquiry_id, pg_id, inquiry_date, medium, response_medium,
           first_name, last_name, first_name_kana, last_name_kana, mobile, landline, mail,
           zip, pref, city, town, street, building, brand, shop, sync, staff, area,
           reserved_date, hp_campaign, duplicate, property, note,
           duplicate_flag, gift_flag, support_flag, black_flag
      FROM inquiry_customer_kaeru
     WHERE first_name <> ''
     ORDER By inquiry_date DESC`,

  used: `
    SELECT id, inquiry_id, pg_id, inquiry_date, medium, response_medium,
           first_name, last_name, category, first_name_kana, last_name_kana, mobile, landline, mail,
           zip, pref, city, town, street, building, brand, shop, sync, staff, area,
           reserved_date, hp_campaign, duplicate, property, note,
           duplicate_flag, gift_flag, support_flag, black_flag
      FROM inquiry_customer_resale
     WHERE first_name <> ''
     ORDER By inquiry_date DESC`,
};

/** 事前アンケート。⚠️ 3画面共通で同じもの（SELECT *） */
const SURVEY_SQL = `SELECT * FROM before_survey ORDER BY dateStr DESC`;

/** ブラックリスト。⚠️ 3画面共通 */
const BLACK_SQL = `SELECT mail, mobile FROM black_list WHERE show_key = 1`;

/**
 * 課リスト。
 * ⚠️⚠️ **order だけが返す。** spec / used の応答には `section` キーが**無い**。
 *   空配列を返すのではなくキー自体が無いのが PHP の挙動。
 *   キーを足すと差分比較が合わなくなる。
 */
const SECTION_SQL = `SELECT * FROM section_list WHERE division = '注文事業'`;

export const listSql = (category: ListCategory) => ({
  summary: SUMMARY_SQL[category],
  shop: SHOP_SQL[category],
  staff: STAFF_SQL[category],
  medium: MEDIUM_SQL[category],
  inquiry: INQUIRY_SQL[category],
  survey: SURVEY_SQL,
  black: BLACK_SQL,
  // ⚠️ order 以外は null。応答にキーを足さないための目印
  section: category === 'order' ? SECTION_SQL : null,
});
