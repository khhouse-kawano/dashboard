import { ATTRIBUTES, daysBetween, phaseDate, phaseDateOf, PHASE_ORDER, phaseReached } from './columns';
import type { AnalysisDivision, AnalysisPhase } from './columns';
// ⚠️ 担当営業の式。⚠️ **軸と同じものを使う**（「◯◯店 管理」は旧担当に読み替える）
import { STAFF_SQL } from './dimensions';
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
 * 事業ごとの工程に到達した件数（2026-09-22 追加）。
 *
 * ⚠️⚠️ **注文と建売で列が違う**（columns.ts の PHASE_COLUMNS）。
 *   ⚠️ ⚠️ **その事業に無い工程は 0 を返す**（例: 注文に「申込」は無い）。
 */
const reachedIn = (division: AnalysisDivision, phase: AnalysisPhase): string => {
  const expr = phaseReached(division, phase);
  return expr === 'NULL' ? '0' : `SUM(${expr})`;
};

/**
 * ⚠️⚠️ **上位の工程に進んだ人を含めて数える**（事業別）。
 *   ⚠️ 並びは PHASE_ORDER。⚠️ **指定した工程から契約までのどれかに当たれば1。**
 *   ⚠️ ⚠️ **その事業に無い工程は自動的に外れる。**
 */
const reachedFrom = (division: AnalysisDivision, phase: AnalysisPhase): string => {
  /**
   * ⚠️⚠️ **その事業に無い工程は 0 を返す。**
   *   ⚠️ ⚠️ **ここを飛ばすと、上位工程だけで数えてしまう。**
   *     ⚠️ 実際に ⚠️ **注文の「申込」が契約と同じ件数になった**（2026-09-22）。
   */
  if (phaseReached(division, phase) === 'NULL') return '0';

  const start = PHASE_ORDER.indexOf(phase);
  const parts = PHASE_ORDER.slice(start)
    .map((p) => phaseReached(division, p))
    .filter((expr) => expr !== 'NULL');
  return parts.length === 0 ? '0' : `SUM(${parts.join(' OR ')})`;
};

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

  /**
   * ⚠️ 2026-09-22 追加。⚠️ **注文と建売で同じ名前にした指標**（利用者の指示）。
   *   ⚠️ ⚠️ **中身は事業ごとに切り替わる**（metricSqlFor を参照）。
   */
  contacts: {
    kind: 'count',
    label:
      '接触数（注文は通電、建売は接触。以降の工程に進んだ人を含む）。' +
      '⚠️ 店舗別動向と同じ数え方',
    sql: reachedFrom('order', 'contact'),
  },
  applications: {
    kind: 'count',
    label:
      '申込数（契約者を含む）。⚠️⚠️ **建売分譲事業だけの工程**。' +
      '⚠️ 注文事業では常に 0 を返す',
    sql: reachedFrom('order', 'application'),
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
   *   ⚠️ ⚠️ **担当営業（STAFF_SQL）と突き合わせている。**
   *     ⚠️ `in_charge_user` そのままではない（⚠️ **72%が「◯◯店 管理」**）。
   *
   * ⚠️⚠️ **`staff` が入っている面談ログは全体の1割ほど**（実測 18,161行中 1,838行）。
   *   ⚠️ ⚠️ **0 件でも「面談していない」という意味にはならない。**
   *   ⚠️ **記録のある範囲での下限値**として扱うこと。
   */
  interviewsLed: {
    kind: 'count',
    needsInterview: true,
    label:
      '担当営業本人が実施した面談の記録がある顧客数（interview_sheet の staff と一致）。' +
      '⚠️ staff が記録されている面談ログは全体の1割ほどしかないため、下限値である',
    sql:
      `SUM(${STAFF_SQL} IS NOT NULL AND ${STAFF_SQL} <> ''` +
      ` AND JSON_SEARCH(iv.interview_log, 'one', ${STAFF_SQL}, NULL, '$[*].staff') IS NOT NULL)`,
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

/**
 * 事業ごとの指標SQL（2026-09-22 追加）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **注文の定義をそのまま建売に当ててはいけない。**
 *   ⚠️ ⚠️ **`01J82Z5F1RR18Z792C7KZS88QG` は注文＝契約 / 建売＝申込**である。
 *   ⚠️ 当てると ⚠️ **申込を契約として数える**（契約数が3倍近くに膨らむ）。
 *
 * ⚠️ 建売の工程は ⚠️ **shopTrend/ShopTrendKaeru.tsx に合わせてある。**
 *     総反響 → 接触 → 来場・案内 → 次アポ → 事前審査 → 申込 → 契約
 *
 * ⚠️⚠️ **`lost` は建売では返さない**（利用者の判断）。
 *   ⚠️ 建売に「失注」ステータスは無く、⚠️ **代わりの「追客終了」は他社に負けたとは限らない。**
 * ─────────────────────────────────────────────
 */
const KAERU_SQL: Partial<Record<MetricKey, string>> = {
  zeroReception: reachedIn('kaeru', 'zeroReception'),
  // ⚠️ 注文の「通電」に当たる工程。建売の画面では「接触」と呼ぶ
  energized: reachedIn('kaeru', 'contact'),
  // ⚠️ 建売の来場は ⚠️ **面談 ＋ 物件案内**
  firstInterview: reachedIn('kaeru', 'visit'),
  secondInterview: reachedIn('kaeru', 'nextAppointment'),
  // ⚠️ 建売の事前審査は ⚠️ **事前審査 ＋ 現金確認**
  preScreening: reachedIn('kaeru', 'preScreening'),
  // ⚠️ 建売の契約は ⚠️ **自社契約 ＋ 仲介契約**
  contracts: reachedIn('kaeru', 'contract'),

  contacts: reachedFrom('kaeru', 'contact'),
  visits: reachedFrom('kaeru', 'visit'),
  nextAppointments: reachedFrom('kaeru', 'nextAppointment'),
  applications: reachedFrom('kaeru', 'application'),
  reservations:
    "SUM((m.reserved_interview IS NOT NULL AND m.reserved_interview <> '')" +
    ` OR ${phaseReached('kaeru', 'visit')})`,

  // ⚠️⚠️ **建売では返さない**（上の注記）。⚠️ NULL にして「0件」と区別する
  lost: 'NULL',
};

/**
 * 指標のSQLを事業に合わせて引く。
 * ⚠️ ⚠️ **表に無い指標は注文の定義をそのまま使う**（架電ログなど事業に依らないもの）。
 */
/**
 * 中央値の対象式を事業に合わせて引く（2026-09-22 追加）。
 *
 * ⚠️⚠️ **建売は「来場」も「契約」も列が違う。**
 *   ⚠️ ⚠️ **注文の式のままだと、申込までの日数を契約までの日数として返す。**
 */
export const medianValueSqlFor = (division: AnalysisDivision, key: MetricKey): string => {
  const base = METRICS[key];
  if (base.kind !== 'median') throw new Error(`中央値の指標ではありません: ${key}`);
  if (division === 'order') return base.valueSql;

  const reaction = phaseDateOf('kaeru', 'reaction');
  const visit = phaseDateOf('kaeru', 'visit');
  const contract = phaseDateOf('kaeru', 'contract');

  if (key === 'medianDaysToFirstInterview') return daysBetween(reaction, visit);
  if (key === 'medianDaysToContract') return daysBetween(reaction, contract);
  if (key === 'medianDaysFirstInterviewToContract') return daysBetween(visit, contract);
  return base.valueSql;
};

export const metricSqlFor = (division: AnalysisDivision, key: MetricKey): string => {
  const base = METRICS[key];
  if (base.kind !== 'count') throw new Error(`件数指標ではありません: ${key}`);
  if (division === 'kaeru') return KAERU_SQL[key] ?? base.sql;
  return base.sql;
};

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
  /**
   * ⚠️ 2026-09-24 追加。⚠️ **建売の画面（反響推移）にある行**。
   *   ⚠️ 注文にも同じ名前で用意してある（中身は通電）。
   */
  contactRatePct: {
    label: '接触率（接触 ÷ 反響数）。⚠️ 反響推移（建売）と同じ数え方',
    numerator: 'contacts',
  },
  applicationRatePct: {
    label: '申込率（申込 ÷ 接触数）。⚠️⚠️ **建売だけの工程**。注文では null',
    numerator: 'applications',
  },
} as const satisfies Record<string, { label: string; numerator: MetricKey }>;

export type RateKey = keyof typeof RATES;

export const RATE_KEYS = Object.keys(RATES) as RateKey[];

/**
 * 比率の分母（2026-09-24 追加）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **反響日起算では今までどおり全部 `leads`（総反響）。**
 *   ⚠️ ⚠️ **変えないこと。** ⚠️ コホートの歩留まりの意味が変わる。
 *
 * ⚠️⚠️ **実績日起算だけ、画面（反響推移）と同じ分母にする**（利用者の指示）。
 *
 *   注文（CustomerTrendOrder.tsx）
 *     実来場率 = 実来場 ÷ 総反響
 *     ⚠️ **次アポ率 = 次アポ ÷ 実来場**
 *     ⚠️ **契約率   = 契約   ÷ 実来場**
 *
 *   建売（CustomerTrendKaeru.tsx）
 *     接触率   = 接触   ÷ 総反響
 *     ⚠️ **来場率   = 来場   ÷ 接触**
 *     ⚠️ **申込率   = 申込   ÷ 接触**
 *     ⚠️ **契約率   = 契約   ÷ 来場**
 *
 * ⚠️ ⚠️ **ここに無い比率は `leads` のまま。**
 * ─────────────────────────────────────────────
 */
const ACTUAL_DENOMINATOR: Record<AnalysisDivision, Partial<Record<RateKey, MetricKey>>> = {
  order: {
    nextAppointmentRatePct: 'visits',
    contractRatePct: 'visits',
  },
  kaeru: {
    visitRatePct: 'contacts',
    applicationRatePct: 'contacts',
    nextAppointmentRatePct: 'visits',
    contractRatePct: 'visits',
  },
};

/** 比率の分母を引く。⚠️ 実績日起算のときだけ画面に合わせる */
export const denominatorFor = (
  key: RateKey,
  division: AnalysisDivision,
  basisIsActual: boolean
): MetricKey => {
  if (!basisIsActual) return 'leads';
  return ACTUAL_DENOMINATOR[division][key] ?? 'leads';
};

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
  /**
   * ⚠️⚠️ **2026-09-22 に `visits` と `nextAppointments` を既定に入れた**（利用者の指示）。
   *
   * > 数値が shopTrend ディレクトリの KPI 設定になり歩留まりが揃うことが大切
   *
   * ⚠️ ⚠️ **既定のファネルにこれが無いと、Claude は firstInterview を来場数として語る。**
   *   ⚠️ ⚠️ **その数字はダッシュボードの画面と合わない。**
   * ⚠️ 並びは ⚠️ **対応する工程のすぐ後ろ**に置く（firstInterview → visits）。
   */
  'visits',
  'secondInterview',
  'nextAppointments',
  'preScreening',
  'contracts',
  'lost',
];
