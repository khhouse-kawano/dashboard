import { query } from '../../db/pool';
import type { RowDataPacket } from 'mysql2/promise';
import { KPI_SHOP_DIVISIONS } from './divisions';

/**
 * KPI分析の絞り込みUI（部門 → 課 → 店舗 → スタッフ）用のマスタ。
 *
 * 移植元: backend/src/handlers/kpi_filter_master.php
 *
 * 3段のカスケードを都度APIで引くと通信が増えるだけなので、
 * 対象になりうる店舗と担当者を1回で返し、絞り込みは画面側で行う。
 * 件数は店舗37件・担当者300件程度で、まとめて返しても軽い。
 *
 * ⚠️ ここで返すのはあくまで選択肢。実際に集計してよい範囲かどうかは
 *   ① の kpi_analyze 側で kpiResolveScope() が再検証する。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * 対象店舗。
 *
 * ⚠️ report_flag = 1 は「全社報告用フォーマットの表示の有無」。
 *   これを分析対象の定義として使うことで、'KH全店舗' のような集計用ダミー行や
 *   運用を終えた店舗が選択肢に出てこない。
 *
 * ⚠️ GROUP BY でまとめている。DISTINCT + ORDER BY 非選択列は
 *   ONLY_FULL_GROUP_BY で落ちるため使えない。
 */
const shopsSql = (placeholders: string): string => `
  SELECT division, section, shop
    FROM shop_list
   WHERE division IN (${placeholders})
     AND report_flag = 1
     AND shop    <> ''
     AND section <> ''
   GROUP BY division, section, shop
   ORDER BY MIN(brand_sort), MIN(id)
`;

/**
 * 担当者。
 *
 * ⚠️ staff_list は配属年度（period）ごとに行が増えるため、同じ人が複数行に現れる。
 *   最新年度の在籍者だけを取る。period は文字列なので CAST して比較している。
 */
const STAFF_SQL = `
  SELECT name, shop, section
    FROM staff_list
   WHERE name <> ''
     AND shop <> ''
     AND period = (SELECT MAX(period) FROM staff_list
                    WHERE period <> ''
                      AND period <= CAST(YEAR(CURDATE()) AS CHAR))
   GROUP BY name, shop, section
   ORDER BY MIN(sort), MIN(id)
`;

export interface KpiFilterMasterResponse {
  status: 'ok';
  shops: Record<string, unknown>[];
  staff: Record<string, unknown>[];
}

export const runKpiFilterMaster = async (): Promise<KpiFilterMasterResponse> => {
  const placeholders = KPI_SHOP_DIVISIONS.map(() => '?').join(',');

  const [shops, staff] = await Promise.all([
    query<DynamicRow>(shopsSql(placeholders), KPI_SHOP_DIVISIONS),
    query<DynamicRow>(STAFF_SQL),
  ]);

  return { status: 'ok', shops, staff };
};
