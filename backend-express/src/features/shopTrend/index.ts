import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { anyMonthCondition, monthCondition, periodMonths, withLastYearMonths } from '../../utils/period';
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
 *
 * ⚠️ v2.2.277: 画面は GET で期間を送る（① の core/db.php が本文に直して POST で転送してくる）。
 *   startMonth / endMonth … 'YYYYMM'。⚠️ 無ければ今までどおり全件・広告費は全列（古い画面との互換）
 *   lastYear=1 … 前年同月も足して取る（昨年実績にチェックを入れたとき）
 *   budget=1   … 広告費を返す（広告費にチェックを入れたとき）。⚠️ 期間があって budget が無ければ空の配列
 *   ⚠️ ① の shopTrend.php と同じ規則にすること（② が落ちたときに ① の応答と食い違わないように）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface ShopTrendResult {
  httpStatus: number;
  body: unknown;
}

/** 画面から届く本文（⚠️ GET は ① が本文に直して POST で送ってくる） */
export interface ShopTrendParams {
  category?: unknown;
  startMonth?: unknown;
  endMonth?: unknown;
  lastYear?: unknown;
  budget?: unknown;
}

const ALLOWED: ShopTrendCategory[] = ['order', 'spec', 'used'];

const isCategory = (value: string): value is ShopTrendCategory =>
  (ALLOWED as string[]).includes(value);

/** '1'（GET の文字列）か 1 のときだけ true */
const isOn = (value: unknown): boolean => value === '1' || value === 1;

export const runShopTrend = async (params: ShopTrendParams): Promise<ShopTrendResult> => {
  const rawCategory = params.category;
  /**
   * ⚠️ PHP は `$data['category'] ?? 'order'`。**キーが無いときだけ 'order'** になる。
   *   空文字が明示されていれば '' のままで、下の検証で 400 になる。
   *   `|| 'order'` と書くと空文字も 'order' になり挙動が変わる。
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

  const months = periodMonths(params.startMonth, params.endMonth);
  if (months === 'invalid') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '期間の指定が正しくありません' },
    };
  }

  const sql = shopTrendSql(category);
  const targetMonths = months !== null && isOn(params.lastYear) ? withLastYearMonths(months) : months;
  const customerCondition = anyMonthCondition(sql.dateColumns, targetMonths);
  const budgetCondition = monthCondition('budget_period', targetMonths);

  // ⚠️ 期間が無い（古い画面）… 今までどおり全列・全件。期間があって budget=1 … 6列を期間で。それ以外 … 返さない（空）
  const loadBudget = (): Promise<DynamicRow[]> => {
    if (months === null) return query<DynamicRow>(sql.budget, [sql.budgetSection]);
    if (!isOn(params.budget)) return Promise.resolve([]);
    return query<DynamicRow>(`${sql.budgetPeriod} AND ${budgetCondition.sql}`, [sql.budgetSection, ...budgetCondition.params]);
  };

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
  //   顧客一覧が数万行あるため待ち時間が縮む
  const [staff, shop, section, customer, medium, budget] = await Promise.all([
    query<DynamicRow>(sql.staff),
    query<DynamicRow>(sql.shop, [sql.division]),
    query<DynamicRow>(sql.section, [sql.division]),
    query<DynamicRow>(`${sql.customer} AND ${customerCondition.sql}`, customerCondition.params),
    query<DynamicRow>(sql.medium),
    loadBudget(),
  ]);

  // ⚠️ キー名と順序は PHP と同じにする。フロントが response.data.customer 等で読む
  return {
    httpStatus: 200,
    body: { staff, shop, section, customer, medium, budget },
  };
};
