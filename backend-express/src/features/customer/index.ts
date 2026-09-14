import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { customerSql } from './queries';
import type { CustomerCategory } from './queries';

/**
 * 販促媒体別ランキングの初期データ（customer/CustomerOrder.tsx / CustomerKaeru.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 参照のみ。① に customer.php / customerAction/customer_{category}.php が
 *   実在するのでフォールバックしてよい。
 *
 * ⚠️ 集計はしない。行を返すだけで、KPI の判定はフロントが行う。
 *   ⚠️ 店舗ランキング（ShopOrder / ShopKaeru）と**同じ判定**を使うため。
 *     食い違うと、同じ期間なのに店舗別と媒体別で合計が合わなくなる。
 *
 * ⚠️ 応答は数万件になる。列は集計に要るものだけに絞ってある。
 *   ⚠️ 列を足すときは転送量を意識すること。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface CustomerResult {
  httpStatus: number;
  body: unknown;
}

export const runCustomer = async (category: CustomerCategory): Promise<CustomerResult> => {
  const sql = customerSql(category);

  // ⚠️ 互いに独立しているので並列で投げる
  const [shop, section, customer, medium, budget] = await Promise.all([
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.section, [sql.division]),
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.medium),
    query<DynamicRow>(sql.budget, [sql.budgetSection]),
  ]);

  /**
   * ⚠️ キーの順序も ① の PHP と揃えている。
   * ⚠️⚠️ **`staff` は返さない。** 移植元の customer_spec.php は返していたが、
   *   CustomerKaeru.tsx は一度も使っていない（人員数を出すのは shop の画面）。
   *   ⚠️ ① の PHP からも消してある。片方だけにしないこと。
   */
  return {
    httpStatus: 200,
    body: { shop, section, customer, medium, budget },
  };
};
