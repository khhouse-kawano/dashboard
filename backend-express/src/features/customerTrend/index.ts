import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { customerTrendSql } from './queries';
import type { CustomerTrendCategory } from './queries';

/**
 * 販促媒体別動向の初期データ
 * （customerTrend/CustomerTrendOrder.tsx / CustomerTrendKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/customerTrend.php
 *         → customerTrendAction/customerTrend_{category}.php
 *
 * ⚠️⚠️ **① の PHP ハンドラは実在する。** 参照のみなので、転送に失敗したら
 *   ① にフォールバックしてよい（フォールバック禁止には登録しない）。
 *
 * ⚠️ この request は roll で分岐しない。category だけ。
 *
 * ⚠️⚠️ **応答のキーが category で違う。**
 *     order … shop / customer / medium / budget          （4つ）
 *     spec  … staff / shop / section / customer / medium / budget（6つ）
 *   PHP がそうなっているため、揃えていない。揃えるとフロントが
 *   受け取るオブジェクトの形が変わる。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface CustomerTrendResult {
  httpStatus: number;
  body: unknown;
}

const ALLOWED: CustomerTrendCategory[] = ['order', 'spec'];

const isCategory = (value: string): value is CustomerTrendCategory =>
  (ALLOWED as string[]).includes(value);

export const runCustomerTrend = async (rawCategory: unknown): Promise<CustomerTrendResult> => {
  /**
   * ⚠️ PHP は `$data['category'] ?? 'order'`。**キーが無いときだけ 'order'** になる。
   *   `|| 'order'` と書くと空文字も 'order' になり挙動が変わる。
   */
  const category =
    rawCategory === undefined || rawCategory === null
      ? 'order'
      : typeof rawCategory === 'string'
        ? rawCategory
        : '';

  /**
   * ⚠️⚠️ `used`（中古）はここで 400 になる。
   *   ① の customerTrend.php は許可カテゴリに入れているが、
   *   require する customerTrend_used.php が**存在しない**ため
   *   ① でも実際には動かない（500）。
   *   ⚠️ 中古版を実装するときは、ここと queries.ts の
   *     CustomerTrendCategory と registry.ts の3箇所を直すこと。
   */
  if (!isCategory(category)) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '無効なカテゴリです' },
    };
  }

  const sql = customerTrendSql(category);

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
  //   顧客一覧が数万行あるため待ち時間が縮む
  const [staff, shop, section, customer, medium, budget] = await Promise.all([
    sql.staff ? query<DynamicRow>(sql.staff) : Promise.resolve(null),
    query<DynamicRow>(sql.shop, [sql.division]),
    sql.section ? query<DynamicRow>(sql.section, [sql.division]) : Promise.resolve(null),
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.medium),
    query<DynamicRow>(sql.budget),
  ]);

  /**
   * ⚠️ キー名と順序を PHP に合わせる。
   *   ⚠️ order では staff / section を**キーごと出さない**。
   *     `staff: null` を返すと、PHP の応答には無かったキーが増える。
   */
  if (category === 'order') {
    return {
      httpStatus: 200,
      body: { shop, customer, medium, budget },
    };
  }

  return {
    httpStatus: 200,
    body: { staff, shop, section, customer, medium, budget },
  };
};
