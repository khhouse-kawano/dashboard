/**
 * KPI分析の部門定義。
 *
 * 移植元: backend/src/core/kpi.php の KPI_DIVISIONS
 *
 * ⚠️ 685行ある core/kpi.php 全体は移植していない。
 *   分析本体（kpi_analyze）は ① のPHPに残しているため、
 *   Express 側で必要なのは「部門コード」と「shop_list.division の値」の
 *   対応だけである。
 *
 * ⚠️ ① の KPI_DIVISIONS にキーを追加したら、ここにも追加すること。
 *   ここに無い部門は kpi_analysis_list の絞り込みで無視され、
 *   kpi_filter_master の選択肢にも出なくなる。
 */

export const KPI_DIVISIONS = {
  order: { label: '注文事業', shopDivision: '注文事業' },
  kaeru: { label: '建売分譲事業', shopDivision: '建売分譲事業' },
} as const;

export type KpiDivision = keyof typeof KPI_DIVISIONS;

export const isKpiDivision = (value: string): value is KpiDivision =>
  Object.prototype.hasOwnProperty.call(KPI_DIVISIONS, value);

/** shop_list.division の値の一覧。並び順は ① の array_values(KPI_DIVISIONS) と同じ */
export const KPI_SHOP_DIVISIONS: string[] = Object.values(KPI_DIVISIONS).map(
  (d) => d.shopDivision
);

/**
 * kpi_analysis_list で絞り込める分析タイプ。
 *
 * ⚠️ ① の kpi_analysis_list.php にある in_array() のリストと一致させること。
 *   ここに無い値は「絞り込まない」として無視される（エラーにはしない）。
 */
export const KPI_ANALYSIS_TYPES = ['inquiry_trend', 'shop', 'medium'] as const;

export type KpiAnalysisType = (typeof KPI_ANALYSIS_TYPES)[number];

export const isKpiAnalysisType = (value: string): value is KpiAnalysisType =>
  (KPI_ANALYSIS_TYPES as readonly string[]).includes(value);
