import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 失注一覧（`master_data`）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/lostList.php`
 *
 * ⚠️⚠️ **移植元は `master_data` を全件返していた。**
 *   ⚠️ 画面（LostStatusList.tsx）は受け取ったあとで
 *     `status === '失注'` かつ 2026-06-01 以降に絞り込んでいる。
 *   ⚠️ つまり**使わない行まで全部送っていた**。
 *
 * ⚠️ ここでは SQL 側で `status = '失注'` に絞る。
 *   ⚠️ 日付の絞り込みは**画面に残す**。
 *     ⚠️ 起点（2026-06-01）が画面側の定数で、
 *       ここに写すと**片方だけ変わって食い違う**ため。
 *
 * ⚠️ 返す列は移植元と同じにすること。
 *   ⚠️ 画面は列名をそのまま使っている（`customized_input_...` を含む）。
 * ─────────────────────────────────────────────
 */

interface LostRow extends RowDataPacket {
    id: string;
    customer: string;
    status: string;
}

/**
 * ⚠️⚠️ **列と別名は移植元から1文字も変えないこと。**
 *   ⚠️ `customized_input_01JRF9CZSW65A151WR30NA4PB3`（詳細な失注理由）と
 *     `customized_input_01JSE7H4MQES619NBWX6PQDFRH` は
 *     **別名を付けずそのままの名前**で使われている。
 *   ⚠️ 読みやすい名前に変えると画面の「未入力」判定が壊れる。
 */
const SELECT_SQL = `
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
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
    /*
      ⚠️⚠️ **2026-09-17 に足した2列。** 画面の「未入力箇所」で使う。
        ⚠️ 返さないと画面側で undefined になり、⚠️ **失注が全件「要回答」になる。**
        ⚠️ ① の lostList.php にも**同じ2行を足してある**。片方だけにしないこと。
        ⚠️⚠️ **ここはSQLの中なのでバッククォートを書かないこと**（文字列が終わる）。
    */
    COALESCE(competitor_price_gap, '') AS competitor_price_gap,
    COALESCE(competitor_countermeasure, '') AS competitor_countermeasure,
    COALESCE(k_snap, '') AS k_snap
  FROM master_data
  WHERE status = '失注'
`;

export const runLostList = async (): Promise<{ customer: LostRow[] }> => {
    const customer = await query<LostRow>(SELECT_SQL);
    return { customer };
};
