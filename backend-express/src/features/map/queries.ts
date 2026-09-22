/**
 * 地図（map/MapOrder.tsx / MapKaeru.tsx / MapResale.tsx）の SQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: backend/src/handlers/map.php
 *            backend/src/handlers/mapAction/map_{order,spec,used}.php
 *
 * ⚠️⚠️ **列と別名は移植元のままにしてある。**
 *   ⚠️ 画面は `item.lat_lng` や `item.current_contract_type` のように
 *     ⚠️ **別名をそのまま使っている**ので、1つでも変えると地図からピンが消える。
 *
 * ⚠️⚠️ **事業ごとに使うテーブルが違う。**
 *     order → master_data        / medium_list（⚠️ `response_medium = 0` で絞る）
 *     spec  → master_data_kaeru  / medium_kaeru
 *     used  → master_data_resale / medium_resale
 *
 * ⚠️ ⚠️ **`used` は店舗と営業課を返さない。** ⚠️ 移植元がそうなっており、
 *   ⚠️ **MapResale.tsx も使っていない**（ブランド・店舗の絞り込みが無い）。
 * ─────────────────────────────────────────────
 */

export type MapCategory = 'order' | 'spec' | 'used';

/**
 * 顧客一覧。
 *
 * ⚠️⚠️ **`WHERE` は移植元のまま写している。**
 *   ⚠️ ⚠️ **`or` でつないでいるため、実質的に絞り込めていない**
 *     （`lat_lng <> ''` と `lat_lng <> '取得不可'` のどちらかが真になる）。
 *   ⚠️ ⚠️ **直さないこと。** ⚠️ 画面側が
 *     `response.data.customer.filter(item => item.lat_lng)` で
 *     ⚠️ **改めて絞っている**ので、ここを直すと ① と ② で件数が変わる。
 *   ⚠️ 直すなら ① の PHP と画面を含めて同時に行うこと。
 */
const CUSTOMER_SQL: Record<MapCategory, string> = {
  order: `
    SELECT id,
      customer_contacts_name as customer,
      in_charge_store as shop,
      customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
      step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
      step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR as screening,
      step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
      step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
      step_migration_item_01JSENACS2FC422ZHEZWNSXNYA as appointment,
      customer_contacts_annual_income as income,
      current_contract_type as current_contract_type,
      sales_promotion_name as medium,
      status,
      lat_lng,
      full_address
      FROM master_data
     WHERE show_dashboard = 1
       AND (lat_lng is NOT NULL or lat_lng <> '' or lat_lng <> '取得不可')`,

  spec: `
    SELECT id,
      customer_contacts_name as customer,
      in_charge_store as shop,
      customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
      step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
      step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
      step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG as tour,
      step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
      customer_contacts_annual_income as income,
      current_contract_type as current_contract_type,
      sales_promotion_name as medium,
      status,
      lat_lng,
      full_address
      FROM master_data_kaeru
     WHERE show_dashboard = 1
       AND (lat_lng is NOT NULL or lat_lng <> '' or lat_lng <> '取得不可')`,

  used: `
    SELECT id,
      customer_contacts_name as customer,
      in_charge_store as shop,
      customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as \`rank\`,
      step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
      step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 as interview,
      step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG as tour,
      step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 as register,
      step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN as assess,
      step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as brokerage,
      customer_contacts_annual_income as income,
      current_contract_type as current_contract_type,
      sales_promotion_name as medium,
      status,
      lat_lng,
      full_address
      FROM master_data_resale
     WHERE show_dashboard = 1
       AND (lat_lng is NOT NULL or lat_lng <> '' or lat_lng <> '取得不可')`,
};

/**
 * 販促媒体。
 *
 * ⚠️⚠️ **事業ごとにテーブルも列も違う。**
 *   ⚠️ 注文は `medium_list` から ⚠️ **`response_medium = 0`（反響媒体でないもの）**
 *     だけを取り、`medium` と `list_medium` の2列を返す。
 *   ⚠️ 建売・中古は ⚠️ **`SELECT *`**（移植元のまま）。
 *     ⚠️ 画面は `item.medium` しか使っていないが、
 *       ⚠️ **列を絞ると ① と応答が変わる**ので写しておく。
 */
const MEDIUM_SQL: Record<MapCategory, string> = {
  order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
  used: `SELECT * FROM medium_resale`,
};

/**
 * 店舗・営業課（⚠️ **`used` は無し**）。
 *
 * ⚠️ 事業名は `shop_list.division` / `section_list.division` の値そのもの。
 */
export const MAP_DIVISION: Record<MapCategory, string | null> = {
  order: '注文事業',
  spec: '建売分譲事業',
  used: null,
};

const SHOP_SQL = `SELECT shop, section, division FROM shop_list WHERE division = ?`;
const SECTION_SQL = `SELECT name FROM section_list WHERE division = ?`;

export const mapSql = (category: MapCategory) => ({
  customer: CUSTOMER_SQL[category],
  medium: MEDIUM_SQL[category],
  shop: SHOP_SQL,
  section: SECTION_SQL,
  division: MAP_DIVISION[category],
});
