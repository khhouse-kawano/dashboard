import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { anyMonthCondition, monthCondition, periodMonths, withLastYearMonths } from '../../utils/period';
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
 *
 * ⚠️ v2.2.278: 画面は GET で期間を送る（① の core/db.php が本文に直して POST で転送してくる）。店舗別反響推移と同じ規則。
 *   startMonth / endMonth … 'YYYYMM'。⚠️ 無ければ今までどおり全件・広告費は全列（古い画面との互換）
 *   lastYear=1  … 前年同月も足して取る（昨年実績にチェックを入れたとき）
 *   budget=1    … 広告費を返す（広告費にチェックを入れたとき）。⚠️ 期間があって budget が無ければ空の配列
 *   duplicate=1 … spec だけ。名寄せした顧客（show_dashboard ≠ 1）も返す。⚠️ 期間があって duplicate が無ければ show_dashboard = 1 だけ
 *   ⚠️ ① の customerTrend.php と同じ規則にすること（② が落ちたときに ① の応答と食い違わないように）。
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

/** 画面から届く本文（⚠️ GET は ① が本文に直して POST で送ってくる） */
export interface CustomerTrendParams {
  category?: unknown;
  startMonth?: unknown;
  endMonth?: unknown;
  lastYear?: unknown;
  budget?: unknown;
  duplicate?: unknown;
}

/** '1'（GET の文字列）か 1 のときだけ true */
const isOn = (value: unknown): boolean => value === '1' || value === 1;

export const runCustomerTrend = async (params: CustomerTrendParams): Promise<CustomerTrendResult> => {
  const rawCategory = params.category;
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

  const months = periodMonths(params.startMonth, params.endMonth);
  if (months === 'invalid') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '期間の指定が正しくありません' },
    };
  }

  const sql = customerTrendSql(category);
  const targetMonths = months !== null && isOn(params.lastYear) ? withLastYearMonths(months) : months;
  const customerCondition = anyMonthCondition(sql.dateColumns, targetMonths);
  // ⚠️ spec の名寄せ：期間があって duplicate=1 でなければ show_dashboard = 1 だけ（画面の isDuplicate と同じ判定）
  const duplicateCondition = category === 'spec' && months !== null && !isOn(params.duplicate)
    ? ' AND COALESCE(show_dashboard, 0) = 1'
    : '';
  const budgetCondition = monthCondition('budget_period', targetMonths);

  // ⚠️ 期間が無い（古い画面）… 今までどおり全列・全件。期間があって budget=1 … 6列を期間で。それ以外 … 返さない（空）
  const loadBudget = (): Promise<DynamicRow[]> => {
    if (months === null) return query<DynamicRow>(sql.budget);
    if (!isOn(params.budget)) return Promise.resolve([]);
    return query<DynamicRow>(`${sql.budgetPeriod} AND ${budgetCondition.sql}`, [sql.budgetSection, ...budgetCondition.params]);
  };

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
  //   顧客一覧が数万行あるため待ち時間が縮む
  const [staff, shop, section, customer, medium, budget] = await Promise.all([
    sql.staff ? query<DynamicRow>(sql.staff) : Promise.resolve(null),
    query<DynamicRow>(sql.shop, [sql.division]),
    sql.section ? query<DynamicRow>(sql.section, [sql.division]) : Promise.resolve(null),
    query<DynamicRow>(`${sql.customer} AND ${customerCondition.sql}${duplicateCondition}`, customerCondition.params),
    query<DynamicRow>(sql.medium),
    loadBudget(),
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
