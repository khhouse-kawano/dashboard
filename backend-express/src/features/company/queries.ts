/**
 * 会社実績（company/Company.tsx）のSQL。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **SELECT の列と別名は PHP から1文字も変えていない。**
 *   移植元: backend/src/handlers/company.php
 *
 *   Company.tsx は `response.data.staff` `.shop` `.section` `.contract`
 *   `.contract_kaeru` `.contract_resale` `.achievement` をそのまま使う。
 *   別名を1つ変えると画面の数字が黙って 0 になる。
 *
 * ⚠️ 唯一の追加は shop の `parent_shop`（2026-09-10、併売店をまとめる機能）。
 *   ⚠️ 列を増やすだけなので、既存の画面は影響を受けない。
 * ─────────────────────────────────────────────
 */

/**
 * 担当営業。
 * ⚠️ `report = 1` のみ。期（period）では絞らない。
 *   絞り込みはフロント側（targetYear での filter）が持っている。
 */
export const STAFF_SQL = `
  SELECT name, shop, section, report, sort, multi, status, period, position, khg_id
    FROM staff_list WHERE report = 1`;

/**
 * 店舗。
 *
 * ⚠️⚠️ **`parent_shop` を追加している（2026-09-10）。**
 *   併売店（multi = 1）の親店舗名が入る。値は運用側が手作業で設定する。
 *   ⚠️ SQL は backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql。
 *     列が無い環境では**このクエリが落ちる**ので、SQLの実行を先に済ませること。
 *
 * ⚠️ `report_flag = 1` のみ。会社実績に出す店舗の指定である
 *   （show_flag とは別の意味を持つ列なので取り違えないこと）。
 */
export const SHOP_SQL = `
  SELECT brand, shop, division, section, multi, report_flag, parent_shop
    FROM shop_list WHERE report_flag = 1`;

/** 営業課。⚠️ 絞り込みなしの全件 */
export const SECTION_SQL = `SELECT division, name FROM section_list`;

/**
 * 契約者一覧（注文事業）。
 *
 * ⚠️⚠️ **`rank` は予約語なので、PHP でも別名に使っている。**
 *   mysql2 は別名をそのまま返すため、バッククォートは要らない
 *   （PHP と同じく `as rank` のままにしている）。
 *
 * ⚠️ 契約日が入っているか、S〜Cランクのどれかであれば対象。
 *   ⚠️ OR の優先順位に注意。括弧を外すと show_dashboard の条件が効かなくなる。
 *
 * ⚠️ `'' as contract_broker` は列を揃えるためのダミー。
 *   注文事業に仲介契約は無いが、フロントが3事業を1つの配列にまとめるため必要。
 */
export const CONTRACT_SQL = `
  SELECT id,
  customer_contacts_name as customer,
  '注文' as category,
  in_charge_store as shop,
  in_charge_user as staff,
  customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
  step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract,
  '' as contract_broker,
  status,
  rank_period FROM master_data
  WHERE show_dashboard = 1 and (step_migration_item_01J82Z5F1RR18Z792C7KZS88QG <> '' or customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク'))`;

/**
 * 契約者一覧（建売分譲事業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-10 に契約日の条件を外した。**
 *
 *   以前は
 *     (契約日あり OR 仲介契約日あり) AND ランクあり
 *   だったため、**ランクを持つが契約日が無い顧客が1件も返らず**、
 *   会社実績の建売の「ランク数」が空欄になっていた（実データで400件が欠落）。
 *
 *   現在は
 *     ランクあり
 *   だけにしている。
 *
 *   ⚠️ **契約数は変わらない。** 以前返っていた603件はすべてランクを持つため
 *     新しい条件にも含まれる（2026-09-10 に実データで検算済み: 603 → 1,003件、
 *     うち契約日ありは603件のまま）。
 *
 *   ⚠️ 契約日はあるがランクが無い27件は、**以前も今も返らない**。
 *     ランク条件を外すと契約数が増えてしまうため、この条件は残している。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 注文とは条件の組み方が違う。
 *   注文 … (契約日あり OR ランクあり) ← ランクが無い契約者も返る
 *   建売 … ランクあり                  ← ランクが無い契約者は返らない
 *   ⚠️ 揃えると件数が変わるので揃えていない。
 *
 * ⚠️ `step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0` は建売では仲介契約。
 *   同じ列が事業ごとに別の意味で使われるため、列名から推測しないこと。
 */
export const CONTRACT_KAERU_SQL = `
  SELECT id,
  customer_contacts_name as customer,
  '建売' as category,
  in_charge_store as shop,
  in_charge_user as staff,
  customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
  step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract,
  step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_broker,
  status,
  rank_period FROM master_data_kaeru
  WHERE show_dashboard = 1 AND customized_input_01J82Z5F366ZQ897PXWF6H5ZAM IN ('Sランク','Aランク', 'Bランク', 'Cランク')`;

/**
 * 契約者一覧（中古リノベ事業）。
 *
 * ⚠️⚠️ **`'中専鹿児島店' as shop` は固定値。** in_charge_store を見ていない。
 *   中古リノベは1店舗しかない前提。店舗が増えたらここを直す必要がある。
 *
 * ⚠️ 絞り込みは `show_dashboard = 1` だけ。契約日やランクでは絞らない
 *   （フロントが status === '契約済み' と3つの契約日で判定する）。
 *
 * ⚠️ 契約の列が3本ある（reform / buy / sell）。1つにまとめないこと。
 */
export const CONTRACT_RESALE_SQL = `
  SELECT id,
  customer_contacts_name as customer,
  '中専' as category,
  '中専鹿児島店' as shop,
  in_charge_user as staff,
  customized_input_01J82Z5F366ZQ897PXWF6H5ZAM as rank,
  step_migration_item_01J82Z5F1RR18Z792C7KZS88QG as contract_reform,
  step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW as contract_buy,
  step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0 as contract_sell,
  contract_land_application_date,
  contract_building_application_date,
  status,
  contraction_contract_price,
  additional_contraction_contract_price,
  rank_period FROM master_data_resale
  WHERE show_dashboard = 1`;

/** 契約目標。⚠️ 絞り込みなしの全件（フロントが期で絞る） */
export const ACHIEVEMENT_SQL = `SELECT category, name, period, value FROM company_achievement`;
