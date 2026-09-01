import { ATTRIBUTES, groupExpr } from './columns';

/**
 * 集計軸（GROUP BY に使える列）の定義。
 *
 * ⚠️ ここは許可リストである。軸のSQL式は文字列としてクエリに埋め込まれるため、
 *   リクエストから受け取った値をそのまま使ってはならない。必ずこの表のキーに
 *   一致したものだけを引くこと。
 *   氏名・住所・電話番号など個人を特定できる列は軸に追加しないこと。
 *
 * ⚠️ master_data は m、shop_list は s の別名で結合している。
 *   brand は両方に存在するため必ず修飾すること。
 */

export interface Dimension {
  /** 日本語の意味。レスポンスの meta に載り、Claude が軸を選ぶ手がかりになる */
  label: string;
  /**
   * SELECT / GROUP BY に使うSQL式（空欄の寄せ込み込み）。
   * `basis` には集計基準日（反響取得日 or 契約日）の正規化済み式が入る。
   */
  sql: (basis: string) => string;
  /** この軸を使うために inquiry_customer の結合が必要か */
  needsInquiry?: boolean;
}

export const DIMENSIONS = {
  month: {
    label: '月（集計基準日の年月。YYYY-MM）',
    sql: (basis) => groupExpr(`DATE_FORMAT(${basis}, '%Y-%m')`),
  },
  quarter: {
    label: '四半期（暦年ベース。YYYY-Qn）',
    sql: (basis) => groupExpr(`CONCAT(YEAR(${basis}), '-Q', QUARTER(${basis}))`),
  },
  year: {
    label: '年（YYYY）',
    sql: (basis) => groupExpr(`DATE_FORMAT(${basis}, '%Y')`),
  },
  store: {
    label: '店舗（master_data.in_charge_store）',
    sql: () => groupExpr('m.in_charge_store'),
  },
  brand: {
    label: 'ブランド（shop_list.brand。master_data.brand は表記が不統一なため使わない）',
    sql: () => groupExpr('s.brand'),
  },
  section: {
    label: '営業課（shop_list.section）',
    sql: () => groupExpr('s.section'),
  },
  area: {
    label: 'エリア（shop_list.area。店舗の所在地であって顧客の居住地ではない）',
    sql: () => groupExpr('s.area'),
  },
  medium: {
    label: '販促媒体（master_data.sales_promotion_name）',
    sql: () => groupExpr('m.sales_promotion_name'),
  },
  rank: {
    label: '顧客ランク（Sランク〜Eランク）',
    sql: () => groupExpr(`m.${ATTRIBUTES.rank.column}`),
  },
  status: {
    label: 'ステータス（見込み/契約済み/失注/重複/会社管理/解約）',
    sql: () => groupExpr('m.status'),
  },
  lostReason: {
    label: '失注理由（競合負け/計画中止/音信不通など）',
    sql: () => groupExpr('m.competitor_lost_contract_reason'),
  },
  competitorLostReason: {
    label: '他決理由（顧客が他社を選んだ理由）',
    sql: () => groupExpr(`m.${ATTRIBUTES.competitorLostReason.column}`),
  },
  responseMedium: {
    label: '反響媒体（inquiry_customer.response_medium。反響台帳に紐づく顧客のみ）',
    sql: () => groupExpr('ic.response_medium'),
    needsInquiry: true,
  },
} as const satisfies Record<string, Dimension>;

export type DimensionKey = keyof typeof DIMENSIONS;

export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as DimensionKey[];

/**
 * 軸を Dimension 型として取り出す。
 *
 * DIMENSIONS は `satisfies` でキーの型推論を効かせているため、直接添字アクセスすると
 * 各要素がリテラル型になり、省略されている needsInquiry を読めない。
 * インターフェース型に広げるこのアクセサ経由で参照する。
 */
export const dimension = (key: DimensionKey): Dimension => DIMENSIONS[key];
