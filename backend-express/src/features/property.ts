import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * SUUMO の掲載順位データ。
 *
 * 移植元: backend/src/handlers/propertyAction/property_suumo.php
 *   （backend/src/handlers/property.php が roll で分岐している）
 *
 * ⚠️ roll は 'list' / 'detail' / 'suumo' の3種類あるが、移植したのは 'suumo' だけ。
 *   残りは ① のPHPへ転送される。
 *
 * ⚠️ 移植元は ini_set('memory_limit', '256M') を指定している。
 *   suumo_property の全行を一度に取るため、それだけのメモリを使う。
 *   Node では既定のヒープ（数百MB〜）に収まるが、
 *   **行数が増え続けるテーブルである**ことは意識しておくこと。
 *
 *   フロント（SuumoPropertySummary.tsx）は全期間のデータを受け取り、
 *   取得日ごとの絞り込みと「前回順位」の算出を画面側で行っている。
 *   日付を指定して必要な分だけ返す形にすれば軽くなるが、
 *   それはフロントの改修とセットになるため移行後に行う。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * ⚠️ SELECT * のまま移植する。
 *   列を書き出すと、① でテーブルに列が追加されたときに
 *   Express だけが古い形を返し、差分になる。
 *
 * ⚠️ ORDER BY を足さないこと。移植元に無い。
 *   並びが変わるとフロントの履歴の並べ替え結果が変わりうる。
 */
const SUUMO_SQL = 'SELECT * FROM suumo_property';

export interface PropertySuumoResponse {
  suumo: Record<string, unknown>[];
}

export const runPropertySuumo = async (): Promise<PropertySuumoResponse> => {
  const suumo = await query<DynamicRow>(SUUMO_SQL);
  return { suumo };
};
