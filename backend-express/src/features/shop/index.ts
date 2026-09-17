import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { shopSql } from './queries';
import type { ShopCategory } from './queries';

/**
 * 店舗ランキングの初期データ（shop/ShopOrder.tsx / ShopKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/shop.php → shopAction/shop_order.php
 *
 * ⚠️ `order` は ① に PHP がある（参照のみ）のでフォールバックしてよい。
 * ⚠️⚠️ `spec` は ① に PHP が**無い**。② が落ちると見られない。
 *   利用者と相談のうえ ① には作らない方針（queries.ts のコメント参照）。
 *
 * ⚠️ この request は roll で分岐しない。category だけ。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface ShopResult {
  httpStatus: number;
  body: unknown;
}

const ALLOWED: ShopCategory[] = ['order', 'spec'];

const isCategory = (value: string): value is ShopCategory =>
  (ALLOWED as string[]).includes(value);

export const runShop = async (rawCategory: unknown): Promise<ShopResult> => {
  /**
   * ⚠️ PHP は `$data['category'] ?? 'order'`。**キーが無いときだけ 'order'**。
   *   `|| 'order'` と書くと空文字も 'order' になり挙動が変わる。
   */
  const category =
    rawCategory === undefined || rawCategory === null
      ? 'order'
      : typeof rawCategory === 'string'
        ? rawCategory
        : '';

  /**
   * ⚠️ `used`（中古）はここで 400 になる。画面（ShopResale.tsx）も
   *   ① の shop_used.php も存在しない。
   */
  if (!isCategory(category)) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '無効なカテゴリです' },
    };
  }

  const sql = shopSql(category);

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
  //   顧客一覧が数万行あるため待ち時間が縮む
  const [shop, staff, section, customer, medium, budget] = await Promise.all([
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.staff),
    query<DynamicRow>(sql.section, [sql.division]),
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.medium),
    query<DynamicRow>(sql.budget, [sql.budgetSection]),
  ]);

  // ⚠️ キー名と順序は PHP と同じにする。フロントが response.data.customer 等で読む
  return {
    httpStatus: 200,
    body: { shop, staff, section, customer, medium, budget },
  };
};
