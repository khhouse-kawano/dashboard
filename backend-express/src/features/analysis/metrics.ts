import { ATTRIBUTES, daysBetween, phaseDate } from './columns';
import type { PhaseKey } from './columns';

/**
 * 集計指標の定義。軸と同じく許可リストで、リクエストの値がSQLに混ざることはない。
 * 個人を特定できる値（氏名・連絡先・住所・メモ本文）は指標にも含めない。
 *
 * kind
 *   count  … 通常の集計関数。GROUP BY のクエリでまとめて取れる
 *   median … MariaDB は PERCENTILE_CONT を集計関数として使えず（本番10.5 / ローカル10.11 で確認）、
 *            MEDIAN() はウィンドウ関数としてしか書けない。
 *            PARTITION BY + DISTINCT の別クエリで取る
 */

/** フェーズに到達した件数（そのフェーズの日付が入っている件数） */
const reached = (phase: PhaseKey): string => `SUM(${phaseDate(phase)} IS NOT NULL)`;

/**
 * ⚠️⚠️ **上位の工程に進んだ人は、下位の工程も達成したものとして数える。**
 *
 * ⚠️ ⚠️ **理由は「営業が前の工程の日付を入れないから」である**（2026-09-22 に利用者から）。
 *   ⚠️ 契約日は必ず入るが、⚠️ **初回面談日が空のまま契約済みの顧客が実在する。**
 *   ⚠️ ⚠️ **実態として工程を飛ばしたわけではない。** ⚠️ 入力の問題である。
 *   ⚠️ 素直に数えると ⚠️ **契約数 > 面談数**のような逆転が起きる。
 *
 * ⚠️ ⚠️ **ダッシュボードの KPI（shopTrend/ShopTrend*.tsx）はすべてこの数え方**であり、
 *   ⚠️ **分析APIの firstInterview / secondInterview とは数字が違う。**
 *   ⚠️ 画面と突き合わせるときは、⚠️ **こちらの指標を使うこと。**
 */
const reachedOrBeyond = (phases: PhaseKey[]): string =>
  `SUM(${phases.map(p => `${phaseDate(p)} IS NOT NULL`).join(' OR ')})`;

const toFirstInterview = daysBetween(phaseDate('reaction'), phaseDate('firstInterview'));
const toContract = daysBetween(phaseDate('reaction'), phaseDate('contract'));
const interviewToContract = daysBetween(phaseDate('firstInterview'), phaseDate('contract'));

export interface CountMetric {
  kind: 'count';
  label: string;
  sql: string;
  /** 平均値など。true なら 4.0 を 4 に丸めず小数のまま返す */
  decimal?: boolean;
  needsCall?: boolean;
  needsInterview?: boolean;
}

export interface MedianMetric {
  kind: 'median';
  label: string;
  /** MEDIAN() に渡す値の式 */
  valueSql: string;
}

export type Metric = CountMetric | MedianMetric;

export const METRICS = {
  // --- ファネル件数 -------------------------------------------------------
  leads: { kind: 'count', label: '反響数（集計対象の顧客数）', sql: 'COUNT(*)' },
  zeroReception: { kind: 'count', label: '0次接客に到達した件数', sql: reached('zeroReception') },
  energized: { kind: 'count', label: '通電に到達した件数', sql: reached('energized') },
  firstInterview: { kind: 'count', label: '初回面談に到達した件数', sql: reached('firstInterview') },
  secondInterview: { kind: 'count', label: '第二面談に到達した件数', sql: reached('secondInterview') },
  preScreening: { kind: 'count', label: '事前審査に到達した件数', sql: reached('preScreening') },
  contracts: { kind: 'count', label: '契約に到達した件数', sql: reached('contract') },

  // --- ダッシュボードのKPIと同じ数え方（2026-09-22 追加）------------------
  //
  // ⚠️⚠️ **上の firstInterview / secondInterview とは数え方が違う。**
  //   ⚠️ こちらは ⚠️ **上位の工程に進んだ人を含める**（reachedOrBeyond を参照）。
  //   ⚠️ ⚠️ **店舗別動向（ShopTrend）の数字と突き合わせられるのはこちら。**

  visits: {
    kind: 'count',
    label:
      '実来場数（初回面談・第二面談・事前審査・契約のいずれかに到達した件数）。' +
      '⚠️ 店舗別動向の「実来場数」と同じ数え方。' +
      '⚠️ firstInterview より必ず多くなる',
    sql: reachedOrBeyond(['firstInterview', 'secondInterview', 'preScreening', 'contract']),
  },
  nextAppointments: {
    kind: 'count',
    label:
      '次アポ数（第二面談・事前審査・契約のいずれかに到達した件数）。' +
      '⚠️ 店舗別動向の「次アポ数」と同じ数え方。' +
      '⚠️ secondInterview より必ず多くなる',
    sql: reachedOrBeyond(['secondInterview', 'preScreening', 'contract']),
  },
  reservations: {
    kind: 'count',
    label:
      '来場予約数（来場予約日が入っている、または初回面談に到達した件数）。' +
      '⚠️ 店舗別動向の「来場予約数」と同じ数え方。' +
      '⚠️ 予約せずに来場した人も初回面談として数に入る',
    // ⚠️ `reserved_interview` は日付ではなく text。空文字と NULL の両方が入る
    sql:
      "SUM((m.reserved_interview IS NOT NULL AND m.reserved_interview <> '')" +
      ` OR ${phaseDate('firstInterview')} IS NOT NULL)`,
  },

  // --- ステータス内訳 -----------------------------------------------------
  lost: { kind: 'count', label: 'ステータスが「失注」の件数', sql: "SUM(m.status = '失注')" },
  prospective: {
    kind: 'count',
    label: 'ステータスが「見込み」の件数（追客中）',
    sql: "SUM(m.status = '見込み')",
  },
  duplicated: {
    kind: 'count',
    label: 'ステータスが「重複」の件数（同一顧客の二重登録）',
    sql: "SUM(m.status = '重複')",
  },
  highRank: {
    kind: 'count',
    label: 'ランクがSまたはAの件数',
    sql: `SUM(m.${ATTRIBUTES.rank.column} IN ('Sランク','Aランク'))`,
  },

  // --- 追客量（ログ件数）--------------------------------------------------
  callCountAvg: {
    kind: 'count',
    decimal: true,
    needsCall: true,
    label: '1顧客あたりの平均架電記録件数（call_sheet のログ件数）',
    sql: 'ROUND(AVG(COALESCE(cs.call_count, 0)), 2)',
  },
  callConnectedAvg: {
    kind: 'count',
    decimal: true,
    needsCall: true,
    label: '1顧客あたりの平均「通電」記録件数',
    sql: 'ROUND(AVG(COALESCE(cs.call_connected, 0)), 2)',
  },
  noCallRecord: {
    kind: 'count',
    needsCall: true,
    label: '架電記録が1件も無い顧客数（追客されていない可能性がある件数）',
    sql: 'SUM(COALESCE(cs.call_count, 0) = 0)',
  },
  interviewLogAvg: {
    kind: 'count',
    decimal: true,
    needsInterview: true,
    label: '1顧客あたりの平均面談ログ件数（interview_sheet）',
    sql: 'ROUND(AVG(COALESCE(iv.interview_count, 0)), 2)',
  },
  /**
   * ⚠️ 2026-09-22 追加。⚠️ **担当者本人が面談したかどうか**（利用者の指示）。
   *
   * ⚠️ `interview_sheet.interview_log` の各面談に `staff`（実施した人）が入っている。
   *   ⚠️ ⚠️ **`master_data.in_charge_user`（現在の担当者）と突き合わせている。**
   *
   * ⚠️⚠️ **`staff` が入っている面談ログは全体の1割ほど**（実測 18,161行中 1,838行）。
   *   ⚠️ ⚠️ **0 件でも「面談していない」という意味にはならない。**
   *   ⚠️ **記録のある範囲での下限値**として扱うこと。
   */
  interviewsLed: {
    kind: 'count',
    needsInterview: true,
    label:
      '担当者本人が実施した面談の記録がある顧客数（interview_sheet の staff と一致）。' +
      '⚠️ staff が記録されている面談ログは全体の1割ほどしかないため、下限値である',
    sql:
      "SUM(m.in_charge_user IS NOT NULL AND m.in_charge_user <> ''" +
      " AND JSON_SEARCH(iv.interview_log, 'one', m.in_charge_user, NULL, '$[*].staff') IS NOT NULL)",
  },

  // --- リードタイム -------------------------------------------------------
  avgDaysToFirstInterview: {
    kind: 'count',
    decimal: true,
    label: '反響取得から初回面談までの日数（平均）。既存のKPI画面と同じ算出方法',
    sql: `ROUND(AVG(${toFirstInterview}), 1)`,
  },
  avgDaysToContract: {
    kind: 'count',
    decimal: true,
    label: '反響取得から契約までの日数（平均）。既存のKPI画面と同じ算出方法',
    sql: `ROUND(AVG(${toContract}), 1)`,
  },
  medianDaysToFirstInterview: {
    kind: 'median',
    label: '反響取得から初回面談までの日数（中央値）。少数の長期案件に引っ張られにくい',
    valueSql: toFirstInterview,
  },
  medianDaysToContract: {
    kind: 'median',
    label: '反響取得から契約までの日数（中央値）',
    valueSql: toContract,
  },
  medianDaysFirstInterviewToContract: {
    kind: 'median',
    label: '初回面談から契約までの日数（中央値）',
    valueSql: interviewToContract,
  },
} as const satisfies Record<string, Metric>;

export type MetricKey = keyof typeof METRICS;

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

/**
 * 指標を Metric 型として取り出す。
 * DIMENSIONS と同じ理由（satisfies によるリテラル型化）で、省略可能な
 * needsCall / needsInterview / decimal を読むにはこのアクセサを経由する。
 */
export const metric = (key: MetricKey): Metric => METRICS[key];

/**
 * 件数から算出する比率。分母はすべて反響数（leads）。
 * 母数が0のときは 0 ではなく null を返す（「0%」と「母数なし」を区別するため）。
 */
export const RATES = {
  energizedRatePct: { label: '通電率（通電 ÷ 反響数）', numerator: 'energized' },
  firstInterviewRatePct: { label: '初回面談率（初回面談 ÷ 反響数）', numerator: 'firstInterview' },
  secondInterviewRatePct: { label: '第二面談率（第二面談 ÷ 反響数）', numerator: 'secondInterview' },
  preScreeningRatePct: { label: '事前審査率（事前審査 ÷ 反響数）', numerator: 'preScreening' },
  contractRatePct: { label: '契約率（契約 ÷ 反響数）', numerator: 'contracts' },
  lostRatePct: { label: '失注率（失注 ÷ 反響数）', numerator: 'lost' },
  // ⚠️ 2026-09-22 追加。⚠️ **ダッシュボードのKPIと同じ数え方の比率**
  visitRatePct: {
    label: '実来場率（実来場 ÷ 反響数）。⚠️ 店舗別動向と同じ数え方',
    numerator: 'visits',
  },
  nextAppointmentRatePct: {
    label: '次アポ率（次アポ ÷ 反響数）。⚠️ 店舗別動向と同じ数え方',
    numerator: 'nextAppointments',
  },
} as const satisfies Record<string, { label: string; numerator: MetricKey }>;

export type RateKey = keyof typeof RATES;

export const RATE_KEYS = Object.keys(RATES) as RateKey[];

/**
 * ファネル分析で使う指標のセット。
 *
 * 0次接客は入力率が0.6%（2026-08時点で22,881件中138件）しかなく、既定に含めると
 * ほぼ全行が0になってノイズになる。指標としては選択可能なまま残す。
 */
export const FUNNEL_METRICS: MetricKey[] = [
  'leads',
  'energized',
  'firstInterview',
  'secondInterview',
  'preScreening',
  'contracts',
  'lost',
];
