import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 架電状況一覧（CallStatusList.tsx）の初期データ。
 *
 * 移植元: backend/src/handlers/callStatusList.php
 *
 * ─────────────────────────────────────────────
 * category で参照する顧客テーブルが変わる
 *
 *   order → master_data          （注文）
 *   spec  → master_data_kaeru    （建売）
 *   used  → master_data_resale   （中古）
 *
 *   それ以外・未指定は master_data（PHP の既定値）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * ⚠️ SELECT * のものは列を書き出さない。
 *   ① でテーブルに列が追加されたとき、Express だけが古い形を返してしまう。
 */
const STAFF_SQL = 'SELECT * FROM staff_list WHERE rank = 1 or inside = 1';

const SHOP_SQL = 'SELECT shop, section, division, show_flag FROM shop_list';

const MEDIUM_SQL = 'SELECT medium, list_medium FROM medium_list WHERE response_medium = 0';

const CALL_SQL = 'SELECT * FROM call_sheet';

const INTRODUCTORY_SQL = 'SELECT * FROM introductory';

const FAMILY_SQL = 'SELECT * FROM family_info';

const EVENT_SQL = "SELECT * FROM event_calendar WHERE shop = 'khg' AND flag = 1";

/**
 * category → 顧客テーブル名。
 *
 * ⚠️ この対応表以外の値を受け付けないこと。
 *   テーブル名は SQL に直接埋め込むため、外部からの値をそのまま通すと
 *   SQL インジェクションになる。
 */
const CUSTOMER_TABLES = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
} as const;

export type CallStatusCategory = keyof typeof CUSTOMER_TABLES;

/** PHP の既定値。category 未指定のときはこれを見る */
const DEFAULT_CUSTOMER_TABLE = CUSTOMER_TABLES.order;

/**
 * 顧客一覧。
 *
 * ⚠️⚠️ menu.php の同名クエリとほぼ同じだが **WHERE 句が無い**。
 *   menu.php は `WHERE show_dashboard = 1` で絞っているが、
 *   callStatusList.php は全件を返す。
 *   見た目が似ているので揃えたくなるが、揃えると件数が変わる。
 *
 * ⚠️ k_snap 列も menu.php にはあるが、こちらには無い。足さない。
 *
 * ⚠️ COALESCE / REPLACE / STR_TO_DATE の並びを PHP から1文字も変えていない。
 *   register は 'YYYY/MM/DD' と 'YYYY-MM-DD' の両方を試している。
 *   本番データに両形式が混在しているため、片方だけにすると NULL になる行が出る。
 */
const customerSql = (tableName: string): string => `
  SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
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
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH
  FROM ${tableName}
`;

export interface CallStatusListResponse {
  staff: Record<string, unknown>[];
  shop: Record<string, unknown>[];
  medium: Record<string, unknown>[];
  customer: Record<string, unknown>[];
  callLog: Record<string, unknown>[];
  family: Record<string, unknown>[];
  introductory: Record<string, unknown>[];
  event: Record<string, unknown>[];
}

/**
 * @param category 'order' | 'spec' | 'used' | undefined。
 *   ⚠️ ゲートウェイのレジストリで既知の値のみ登録しているため、
 *     未知の値がここへ来ることはない（① の PHP へ転送される）。
 */
export const runCallStatusList = async (
  category?: CallStatusCategory
): Promise<CallStatusListResponse> => {
  const tableName =
    category === undefined ? DEFAULT_CUSTOMER_TABLE : CUSTOMER_TABLES[category];

  // ⚠️ PHP は8つのクエリを逐次実行しているが、結果は互いに独立しているため
  //   並列でも同じレスポンスになる。コネクションプール上限（10）の範囲内。
  const [staff, shop, medium, customer, callLog, family, introductory, event] =
    await Promise.all([
      query<DynamicRow>(STAFF_SQL),
      query<DynamicRow>(SHOP_SQL),
      query<DynamicRow>(MEDIUM_SQL),
      query<DynamicRow>(customerSql(tableName)),
      query<DynamicRow>(CALL_SQL),
      query<DynamicRow>(FAMILY_SQL),
      query<DynamicRow>(INTRODUCTORY_SQL),
      query<DynamicRow>(EVENT_SQL),
    ]);

  // ⚠️ キーの順序も PHP の $result と同じにする。
  //   JSON のキー順が変わるとバイト単位の比較で差分になる。
  return {
    staff,
    shop,
    medium,
    customer,
    callLog,
    family,
    introductory,
    event,
  };
};
