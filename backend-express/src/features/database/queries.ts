import { giftBaseSelectSql } from './gift';

/**
 * 顧客一覧（database/DatabaseOrder.tsx / DatabaseKaeru.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **SELECT の列と別名は PHP から変えていない。**
 *   移植元:
 *     backend/src/handlers/databaseAction/database_order.php （category = 'order'）
 *     backend/src/handlers/databaseAction/database_spec.php  （category = 'spec'  ＝建売）
 *
 * ⚠️⚠️ **`used` と `common` は移植していない。**
 *   ① の database.php は4つの category を許可しているが、ここで扱うのは
 *   注文と建売だけである。登録していない category は ① へ転送されるので、
 *   中古（DatabaseResale.tsx）はこれまでどおり ① が応答する。
 *
 * ⚠️⚠️ **roll（trash / copy）も移植していない。**
 *   `database_order_trash.php` などは書き込みを伴う別経路で、
 *   許可リストにも入れていない。
 *
 * ⚠️ 架電情報・面談情報は**返さない。** 以前 ① が call_sheet と
 *   interview_sheet を丸ごと返しており、ログ本文だけで約30MB あって
 *   PHP の memory_limit を超えていた。検索は past_staff_search に分けてある。
 *   ⚠️ ここに足さないこと。
 * ─────────────────────────────────────────────
 */

export type DatabaseCategory = 'order' | 'spec';

/**
 * 担当営業。
 * ⚠️ `SELECT *`。PHP のまま。担当営業セレクト（2026-09-14 追加）が
 *   `position` / `khg_id` / `category` / `period` を使う。列を絞らないこと。
 */
const STAFF_SQL = `SELECT * FROM staff_list WHERE \`rank\` = 1`;

/**
 * 店舗。
 * ⚠️ order は `show_flag` で絞らない。spec だけ絞る（PHP のまま）。
 */
const SHOP_SQL: Record<DatabaseCategory, string> = {
  order: `SELECT shop, section FROM shop_list WHERE division = '注文事業'`,
  spec: `SELECT shop, section FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1`,
};

/**
 * 販促媒体。
 * ⚠️ 事業ごとに別テーブル。order は medium_list、spec は medium_kaeru。
 */
const MEDIUM_SQL: Record<DatabaseCategory, string> = {
  order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
};

/**
 * 顧客一覧。
 * ⚠️ `gift_base`（条件①②）だけをここで取り、残りは giftApplyToCustomers が付ける。
 */
const CUSTOMER_SQL: Record<DatabaseCategory, string> = {
  order: `SELECT
  id,
  ${giftBaseSelectSql()},
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS \`rank\`,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
    ''
  ) AS register,
  COALESCE(sales_promotion_name, '') AS medium,
  COALESCE(status, '') AS status,
  COALESCE(rank_period, '') AS rank_period,
  COALESCE(call_status, '') AS call_status,
  COALESCE(cancel_status, '') AS cancel_status,
  COALESCE(show_dashboard, 0) AS trash,
  COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
  COALESCE(introduction_person_category, '') AS introduction_person_category,
  COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
  COALESCE(competitors_text, '') AS competitors_text,
  COALESCE(competitor_name, '') AS competitor_name,
  COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
  COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
  COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
  /*
    ⚠️⚠️ **2026-09-17 に足した2列。** DatabaseOrder.tsx の「要回答」件数で使う。
      ⚠️ 返さないと画面側で undefined になり、⚠️ **失注が全件「要回答」になる。**
      ⚠️ ⚠️ **order にだけ足すこと。** 建売・中古のテーブルにはこの列が無い。
      ⚠️ ① の database_order.php にも同じ2行を足してある。
      ⚠️⚠️ **ここはSQLの中なのでバッククォートを書かないこと**（文字列が終わる）。
  */
  COALESCE(competitor_price_gap, '') AS competitor_price_gap,
  COALESCE(competitor_countermeasure, '') AS competitor_countermeasure,
  COALESCE(call_log, '') AS call_log,
  COALESCE(hotlead_id, '') AS hotlead_id,
  COALESCE(k_snap, '') AS k_snap
 FROM master_data`,

  spec: `SELECT
  id,
  ${giftBaseSelectSql()},
  COALESCE(customer_contacts_name, '') AS customer,
  COALESCE(customer_contacts_name_kana, '') AS customer_contacts_name_kana,
  COALESCE(in_charge_store, '') AS shop,
  COALESCE(in_charge_user, '') AS staff,
  COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS \`rank\`,
  COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
  COALESCE(REPLACE(step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG, '/', '-'), '') AS tour,
  COALESCE(
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
    DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
    ''
  ) AS register,
  COALESCE(sales_promotion_name, '') AS medium,
  COALESCE(status, '') AS status,
  COALESCE(rank_period, '') AS rank_period,
  COALESCE(call_status, '') AS call_status,
  COALESCE(show_dashboard, 0) AS trash,
  COALESCE(full_address, '') AS full_address,
  COALESCE(hp_campaign, '') AS hp_campaign,
  COALESCE(property_name, '') AS property_name,
  COALESCE(property_tour_name, '') AS property_tour_name,
  COALESCE(introduction_person_category, '') AS introduction_person_category,
  COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number_2,
  COALESCE(customer_contacts_phone_number, '') AS phone_number,
  COALESCE(customer_contacts_email, '') AS mail,
  COALESCE(extra_address_info, '') AS mail_2,
  COALESCE(integration, '') AS integration,
  COALESCE(call_log, '') AS call_log
 FROM master_data_kaeru`,
};

/**
 * 家族情報。
 * ⚠️ order は `family_info IS NOT NULL` で絞り、spec は全件（PHP のまま）。
 *   ⚠️ 揃えると件数が変わる。画面側の使い方も違う
 *   （order は中身を検索に使い、spec は id の有無しか見ていない）。
 */
const FAMILY_SQL: Record<DatabaseCategory, string> = {
  order: `SELECT id, family_info FROM family_info WHERE family_info IS NOT NULL`,
  spec: `SELECT * FROM family_info`,
};

/** イベント。⚠️ order だけ。spec の PHP には無い */
const EVENT_SQL = `SELECT * FROM event_calendar WHERE shop = 'khg' AND flag = 1`;

/** HOTLEAD。⚠️ order だけ。spec の PHP には無い */
const HOTLEAD_SQL = `SELECT id, status, hotlead_url, action_history, ticket_stop_reason_type FROM hotlead_db`;

/** 紹介。⚠️ order だけ。spec の PHP には無い */
const INTRODUCTORY_SQL = `SELECT * FROM introductory`;

export const databaseSql = (category: DatabaseCategory) => ({
  staff: STAFF_SQL,
  shop: SHOP_SQL[category],
  medium: MEDIUM_SQL[category],
  customer: CUSTOMER_SQL[category],
  family: FAMILY_SQL[category],
  // ⚠️ null は「その category では返さない」。キーごと応答から外す
  event: category === 'order' ? EVENT_SQL : null,
  hotlead: category === 'order' ? HOTLEAD_SQL : null,
  introductory: category === 'order' ? INTRODUCTORY_SQL : null,
});
