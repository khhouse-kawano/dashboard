import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { budgetSimulatorSql } from './queries';
import type { BudgetDivision } from './queries';

/**
 * 広告費シミュレーターの初期データ（header/BudgetSimulator.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 参照のみ。① に budget_simulator.php が実在するのでフォールバックしてよい。
 *
 * ⚠️⚠️ **注文と建売を1回の応答でまとめて返す。**
 *   画面の `targetDivision` は注文／建売を**切り替えるだけ**の操作であり、
 *   そのたびに数万行を取り直すと待ち時間が目立つ。
 *
 *   ⚠️ その代わり応答は大きい。列は集計に要るものだけに絞ってある
 *   （顧客IDも氏名も返していない）。**列を足すときは転送量を意識すること。**
 *   2026-09-11 に別の request が 17MB・120秒で切れている。
 *
 * ⚠️ 集計はしない。行を返すだけで、KPI の判定はフロントが行う。
 *   ShopOrder / ShopKaeru と同じ判定を使い、数字を食い違わせないため。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface BudgetSimulatorResult {
  httpStatus: number;
  body: unknown;
}

const DIVISIONS: BudgetDivision[] = ['order', 'spec'];

/** 事業ひとつ分を取る */
const fetchOne = async (division: BudgetDivision) => {
  const sql = budgetSimulatorSql(division);

  const [shop, section, customer, budget, achievement] = await Promise.all([
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.section, [sql.division]),
    query<DynamicRow>(sql.customer),
    query<DynamicRow>(sql.budget, [sql.budgetSection]),
    // ⚠️ 契約目標は事業で絞らない。店舗名でフロントが突合する（queries.ts 参照）
    query<DynamicRow>(sql.achievement),
  ]);

  return { shop, section, customer, budget, achievement };
};

export const runBudgetSimulator = async (): Promise<BudgetSimulatorResult> => {
  // ⚠️ 事業ごとに4クエリ、計8本を並列で投げる
  const [order, spec] = await Promise.all(DIVISIONS.map(fetchOne));

  /**
   * ⚠️ キーは画面の `targetDivision`（'order' / 'spec'）と同じにする。
   *   フロントは `data[targetDivision]` で引く。
   */
  return {
    httpStatus: 200,
    body: { status: 'ok', order, spec },
  };
};
