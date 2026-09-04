import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 店舗マスタ。
 *
 * 移植元: backend/src/handlers/shop_list.php
 *   （さらにその元は `dashboard/api/` の `demand: "shop_list"`）
 *
 * ⚠️ 配列そのものを返す。`{ status, ... }` で包まないこと。
 *   呼び出し側（Calendar.tsx / photo/Form.tsx / ksnap-frontend の Form.tsx）が
 *   `res.data.filter(...)` と直接扱っているため、包むと全箇所が壊れる。
 *
 * ⚠️ show_flag = 1 で絞る。運用を終えた店舗や集計用のダミー行を除くため。
 *   店舗編集画面（header 系）は全件を扱うので条件が違う。混同しないこと。
 *
 * ⚠️ ORDER BY を足さないこと。移植元に無い。
 *   並びが変わると、店舗セレクトの初期値（先頭要素）が変わる画面がある。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const SHOP_LIST_SQL = `
  SELECT brand, shop, section, area, division
    FROM shop_list WHERE show_flag = 1
`;

export const runShopList = async (): Promise<Record<string, unknown>[]> =>
  query<DynamicRow>(SHOP_LIST_SQL);
