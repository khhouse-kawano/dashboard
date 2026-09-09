import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { shopTrendSql } from './queries';
import type { ShopTrendCategory } from './queries';

/**
 * 店舗別動向の初期データ
 * （shopTrend/ShopTrendOrder.tsx / ShopTrendKaeru.tsx / ShopTrendResale.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/shopTrend.php → shopTrendAction/shopTrend_{category}.php
 *
 * ⚠️⚠️ **① の PHP ハンドラは実在する。** 参照のみなので、転送に失敗したら
 *   ① にフォールバックしてよい（フォールバック禁止には登録しない）。
 *
 * ⚠️ この request は roll で分岐しない。3つの category だけ。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface ShopTrendResult {
  httpStatus: number;
  body: unknown;
}

const ALLOWED: ShopTrendCategory[] = ['order', 'spec', 'used'];

const isCategory = (value: string): value is ShopTrendCategory =>
  (ALLOWED as string[]).includes(value);

export const runShopTrend = async (rawCategory: unknown): Promise<ShopTrendResult> => {
  /**
   * ⚠️ PHP は `$data['category'] ?? 'order'`。**キーが無いときだけ 'order'** になる。
   *   空文字が明示されていれば '' のままで、下の検証で 400 になる。
   *   `|| 'order'` と書くと空文字も 'order' になり挙動が変わる。
   *
   * ⚠️ ShopTrendOrder.tsx には category を送らない呼び出しがある
   *   （closeInformationEdit の再取得）。そこが 'order' に落ちる。
   */
  const category =
    rawCategory === undefined || rawCategory === null
      ? 'order'
      : typeof rawCategory === 'string'
        ? rawCategory
        : '';

  if (!isCategory(category)) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '無効なカテゴリです' },
    };
  }

  const sql = shopTrendSql(category);

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
  //   顧客一覧が数万行あるため待ち時間が縮む
  const [staff, shop, section, customer, medium, budget] = await Promise.all([
    query<DynamicRow>(sql.staff),
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.section, [sql.division]),
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.medium),
    query<DynamicRow>(sql.budget, [sql.budgetSection]),
  ]);

  // ⚠️ キー名と順序は PHP と同じにする。フロントが response.data.customer 等で読む
  return {
    httpStatus: 200,
    body: { staff, shop, section, customer, medium, budget },
  };
};
