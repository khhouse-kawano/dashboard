/**
 * 店舗ランキング（shop/ShopOrder.tsx / ShopKaeru.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`order` は PHP から列を変えていない。** 移植元:
 *     backend/src/handlers/shopAction/shop_order.php
 *
 *   例外は店舗の SELECT に `id` / `brand` / `division` を足したこと。
 *   ⚠️ `ShopOrder.tsx` は `key={value.id ?? ...}` で id を使っていたが、
 *     **PHP が返していなかったため常に undefined だった**（フォールバックで
 *     動いてはいた）。店舗の並び替え（sortShops）にも division と id が要る。
 *   ⚠️ ① の shop_order.php にも同じ3列を足すこと。足さないと
 *     フォールバック時に**並びが崩れる**。
 *
 * ⚠️⚠️ **`spec`（建売）は ① に PHP が無い。**
 *   `backend/src/handlers/shopAction/shop_spec.php` は**存在しない**
 *   （`shop.php` は許可カテゴリに spec を入れているが、require で落ちる）。
 *   ⚠️ 利用者と相談のうえ**作らない**方針にした（2026-09-11）。
 *     SQL を2箇所に書くと片方だけ直して鼠算になるため。
 *   ⚠️ そのため **② が落ちると建売の店舗ランキングは見られない。**
 *     紹介反響一覧（inquiry_introductory）と同じ扱いである。
 *
 * ⚠️ `used`（中古）は用意していない。画面（ShopResale.tsx）も無い。
 * ─────────────────────────────────────────────
 */

export type ShopCategory = 'order' | 'spec';

/** 事業区分 */
const DIVISION: Record<ShopCategory, string> = {
  order: '注文事業',
  spec: '建売分譲事業',
};

/**
 * 販促費の section。
 * ⚠️ shopTrend の used は 'use' だが、ここは order / spec のみなので素直。
 */
const BUDGET_SECTION: Record<ShopCategory, string> = {
  order: 'order',
  spec: 'spec',
};

/**
 * 店舗。
 * ⚠️ `id` / `brand` / `division` は今回の追加（並び替えと key に使う）。
 * ⚠️ spec は `show_flag = 1` で絞る（他の建売画面と揃える）。
 *   order は絞らない（PHP のまま。絞ると店舗数が変わって行が減る）。
 *
 * ⚠️⚠️ **`multi` / `parent_shop` は order にだけ足している。**
 *   「併売店をまとめる」は注文事業だけの機能で、
 *   **建売に併売店の概念は無い**（2026-09-11 に利用者が明言）。
 */
const SHOP_SQL: Record<ShopCategory, string> = {
  order: `SELECT id, brand, shop, section, area, division, multi, parent_shop
            FROM shop_list WHERE division = ?`,
  spec: `SELECT id, brand, shop, section, area, division
           FROM shop_list WHERE division = ? AND show_flag = 1`,
};

const SECTION_SQL = `SELECT name FROM section_list WHERE division = ?`;

/**
 * 担当営業。
 * ⚠️⚠️ **`rank` や `period` で絞らない。** PHP は全件返しており、
 *   フロント（ShopOrder.tsx）が `rank === 1 && period === String(thisYear)`
 *   で絞っている。ここで絞ると絞り込みが二重にかかる。
 */
const STAFF_SQL = `SELECT name, shop, \`rank\`, period FROM staff_list`;

/**
 * 顧客一覧。
 *
 * ⚠️⚠️ **同じフェーズ列が事業ごとに別の意味を持つ。** 列名から推測しないこと。
 *   step_migration_item_01J82Z5F1RR18Z792C7KZS88QG は
 *     order → contract（契約）
 *     spec  → application（申し込み）
 *
 * ⚠️ spec の列は shopTrend/queries.ts の spec と同じものを使っている。
 *   ⚠️ **あちらを直したらこちらも見ること。** 建売のフェーズ列の対応は
 *     1箇所にまとめたいが、SELECT の別名が PHP 由来で固定されているため
 *     共有していない。
 */
const CUSTOMER_SQL: Record<ShopCategory, string> = {
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
};

/**
 * 販促媒体。
 * ⚠️ order は medium_list（PHP のまま `list_medium` も返す。フロントが絞る）。
 *   spec は medium_kaeru の全列。
 */
const MEDIUM_SQL: Record<ShopCategory, string> = {
  order: `SELECT medium, list_medium FROM medium_list WHERE response_medium = 0`,
  spec: `SELECT * FROM medium_kaeru`,
};

const BUDGET_SQL = `SELECT * FROM budget WHERE response_medium = 0 AND section = ?`;

export const shopSql = (category: ShopCategory) => ({
  shop: SHOP_SQL[category],
  section: SECTION_SQL,
  staff: STAFF_SQL,
  customer: CUSTOMER_SQL[category],
  medium: MEDIUM_SQL[category],
  budget: BUDGET_SQL,
  division: DIVISION[category],
  budgetSection: BUDGET_SECTION[category],
});
