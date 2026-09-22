import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { mapSql } from './queries';
import type { MapCategory } from './queries';

/**
 * 地図（map/MapOrder.tsx / MapKaeru.tsx / MapResale.tsx）の初期データ。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 参照のみ。① に map.php / mapAction/map_{category}.php が実在するので
 *   フォールバックしてよい。
 *
 * ⚠️ 集計はしない。⚠️ **行を返すだけ**で、絞り込みもフェーズの判定も画面が行う。
 *
 * ⚠️⚠️ **応答は数千〜数万件になる。** ⚠️ 列は移植元と同じものだけ。
 *   ⚠️ ⚠️ **列を足すと、そのぶん全件に掛かる。**
 *
 * ⚠️⚠️ **`used` は `shop` と `section` を返さない。**
 *   ⚠️ 移植元がそうであり、⚠️ **MapResale.tsx も使っていない。**
 *   ⚠️ ⚠️ **応答のキーを勝手に増やさないこと**（① と差分が出る）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface MapResult {
  httpStatus: number;
  body: unknown;
}

export const runMap = async (category: MapCategory): Promise<MapResult> => {
  const sql = mapSql(category);

  // ⚠️ 互いに独立しているので並列で投げる
  const [customer, medium] = await Promise.all([
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.medium),
  ]);

  // ⚠️ 中古リノベは店舗・営業課の絞り込みが無い（移植元と同じ）
  if (sql.division === null) {
    return { httpStatus: 200, body: { customer, medium } };
  }

  const [shop, section] = await Promise.all([
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.section, [sql.division]),
  ]);

  // ⚠️ キーの順序も ① の PHP と揃えてある
  return {
    httpStatus: 200,
    body: { shop, section, customer, medium },
  };
};
