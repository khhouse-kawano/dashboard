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
