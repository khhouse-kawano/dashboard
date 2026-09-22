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

/**
 * 担当営業の式。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`in_charge_user` をそのまま使ってはいけない**（2026-09-22 に利用者から）。
 *
 * > master_data の in_charge_user は失注や案件の長期化が発生すると
 * > **管理** に変更することがあるため first_interviewed_user のカラムも要確認
 * > => 変更される前の営業が入る
 *
 * ⚠️ 実測（show_dashboard = 1 の 24,607件・2026-09-22）
 *     ⚠️⚠️ **「◯◯店 管理」が 17,822件（72%）**（例: `KH鹿児島店 管理` 1,667件）
 *     ⚠️ `first_interviewed_user`（列コメント「※旧担当」）が入っているのは 7,133件
 *     ⚠️ ⚠️ **管理かつ旧担当あり 4,700件** … ここを救える
 *     ⚠️ 契約済み 991件のうち、担当が管理になっているのは 49件
 *
 * ⚠️ ⚠️ **旧担当も空なら「◯◯店 管理」のまま出す。**
 *   ⚠️ 勝手に「(未設定)」へ寄せない。⚠️ **救えなかった件数が見えなくなる。**
 * ─────────────────────────────────────────────
 */
export const STAFF_SQL =
  "CASE WHEN m.in_charge_user LIKE '%管理%'" +
  " AND TRIM(COALESCE(m.first_interviewed_user, '')) <> ''" +
  ' THEN m.first_interviewed_user ELSE m.in_charge_user END';

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
  /**
   * ⚠️ 2026-09-22 追加。⚠️ **スタッフ別の分析**（利用者の指示）。
   *
   * ⚠️⚠️ **氏名だが、これは顧客ではなく自社の担当者である。**
   *   ⚠️ 個人情報の扱いとしては ⚠️ **店舗や営業課と同じ**（社内の所属情報）。
   *   ⚠️ ⚠️ **顧客の氏名は今までどおり軸にしない。**
   *
   * ⚠️⚠️ **中身は STAFF_SQL**（上）。⚠️ **「◯◯店 管理」は旧担当に読み替える。**
   *   ⚠️ ⚠️ **反響を取った人でも、面談をした人でもない。**
   *     ⚠️ 管理に付け替えられていない顧客は、⚠️ **担当替えで実績ごと移る。**
   */
  staff: {
    label:
      '担当営業。⚠️ 失注や長期化で担当が「◯◯店 管理」に付け替えられた顧客は、' +
      'first_interviewed_user（旧担当）を担当として扱う。' +
      '⚠️ 旧担当も空なら「◯◯店 管理」のまま出る（誰の実績か分からない顧客）',
    // ⚠️ 実体は上の STAFF_SQL。⚠️ **絞り込みも同じ式を使う**（query.ts の buildWhere）
    sql: () => groupExpr(STAFF_SQL),
  },
  staffCurrent: {
    label:
      '現在の担当者（master_data.in_charge_user をそのまま）。' +
      '⚠️ 実測では72%が「◯◯店 管理」になっており、営業別の実績には使えない。' +
      '⚠️ 誰が管理案件を抱えているかを見るときだけ使う',
    sql: () => groupExpr('m.in_charge_user'),
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
