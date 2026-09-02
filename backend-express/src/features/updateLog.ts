import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 更新履歴と、ログイン中スタッフの所属店舗。
 *
 * 移植元: backend/src/handlers/update_log.php
 *
 * ⚠️ 名前に update が入っているが **SELECT のみ**。書き込みは一切しない。
 *   比較ツール（cli/compareBackends.ts）は名前から更新系を推測して拒否するため、
 *   このリクエストを比較するときは --read-only-verified を付ける必要がある。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * ⚠️ SELECT * のまま移植する。列を書き出すと、① でテーブルに列が追加されたときに
 *   Express だけが古い形を返し、レスポンスの差分になる。
 */
const LOG_SQL = 'SELECT * FROM update_log';

const SHOP_SQL = 'SELECT shop FROM staff WHERE name = ?';

export interface UpdateLogResponse {
  log: Record<string, unknown>[];
  /**
   * ⚠️ 該当行が無いときは false になる。null ではない。
   *   PHP が fetch() を使っており、行が無いと false を返すため。
   */
  shop: Record<string, unknown> | false;
}

export const runUpdateLog = async (userName: string): Promise<UpdateLogResponse> => {
  const [log, shopRows] = await Promise.all([
    query<DynamicRow>(LOG_SQL),
    query<DynamicRow>(SHOP_SQL, [userName]),
  ]);

  // ⚠️ ここを `?? null` にしてはいけない。PHP の fetch() は行が無いと false を返し、
  //   JSON では "shop": false になる。null にすると差分になる。
  //
  //   なお呼び出し側の Category.tsx は response.data.shop.shop と参照しているため、
  //   staff テーブルに氏名が無いユーザーでは現状でも画面が壊れる。
  //   既存の挙動なので移植では変えない（修正は別タスク）。
  return {
    log,
    shop: shopRows[0] ?? false,
  };
};
