import { asDate, PHASE_COLUMNS, PHASE_ORDER } from './columns';
import type { AnalysisDivision, AnalysisPhase } from './columns';
import type { DimensionKey } from './dimensions';
import type { MetricKey } from './metrics';

/**
 * 実績日起算（basis = actual）の定義。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **反響日起算との違い**
 *
 *   反響日起算 … ⚠️ **その月に獲得した反響**が、その後どこまで進んだかを見る。
 *                 母数は「基準日がその月にある顧客」の1通りで、全指標に共通。
 *                 画面では shop/ と customer/ がこの数え方。
 *
 *   実績日起算 … ⚠️⚠️ **その月に起きた出来事**を数える。
 *                 ⚠️ **指標ごとに見る日付が違う**（契約数は契約日、来場数は来場日）。
 *                 画面では shopTrend/ と customerTrend/ がこの数え方。
 *
 * ⚠️ 2026-09-24 に ⚠️ **実績日起算を既定にした**（利用者の指示）。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **画面（ShopTrendOrder.tsx）と同じ数え方にすること。**
 *   ⚠️ 画面は1つの月について
 *     ⚠️ **「その工程の日付、またはそれより後の工程の日付が、その月にあるか」**
 *   で数えている。⚠️ **日付のどれか1つでも当たれば1件**である。
 *
 * ⚠️ ⚠️ **同じ顧客が複数の月に数えられることがある。**
 *   ⚠️ 例: 1月に来場して3月に契約した顧客は、⚠️ **来場数では1月と3月の両方**に立つ
 *     （契約日も「来場以降の日付」だから）。
 *   ⚠️ ⚠️ **これは画面もそうなっている。** ⚠️ 直すと歩留まりが画面と合わなくなる。
 */

/** ⚠️ 集計基準日に依存する軸。⚠️ **実績日起算ではこの軸だけ扱いが変わる** */
export const TIME_DIMENSIONS: DimensionKey[] = ['month', 'quarter', 'year'];

/**
 * 実績日の決め方。
 *
 * count    … ⚠️ その工程の日付（rollUp = true なら**契約までのどれか**）がその期間にあれば1件
 * avgDays  … ⚠️ **終点の日**がその期間にある顧客だけで、日数の平均を取る
 * median   … ⚠️ 同上（中央値）。⚠️ **別クエリで取るため基準日そのものを差し替える**
 * none     … ⚠️⚠️ **実績日が無い指標。** ⚠️ **null を返す**（0 ではない）
 */
export type ActualSpec =
  | { kind: 'count'; phase: AnalysisPhase; rollUp: boolean; extraColumns?: string[] }
  | { kind: 'avgDays'; phase: AnalysisPhase; from: AnalysisPhase }
  | { kind: 'median'; phase: AnalysisPhase }
  | { kind: 'none'; reason: string };

/**
 * ⚠️ 実績日が無い指標の理由。
 *
 * ⚠️⚠️ **0 を返してはいけない。** ⚠️ ⚠️ **Claude が「失注0件」と語ってしまう。**
 *   ⚠️ null にして、⚠️ **理由を meta に添える**（2026-09-24 の利用者の判断）。
 */
const NO_DATE = (reason: string): ActualSpec => ({ kind: 'none', reason });

const NO_STATUS_DATE =
  '台帳のステータス（現在の状態）であり、いつそうなったかの日付が無い。' +
  '実績日起算では月に割り当てられないため null を返す。' +
  '件数を知りたいときは basis=reaction（反響日起算）で取ること。';

const NO_LOG_DATE =
  '架電・面談ログの件数から作る指標で、顧客1人に対する現在値である。' +
  '工程の日付を持たないため実績日起算では月に割り当てられない。' +
  'basis=reaction（反響日起算）で取ること。';

export const ACTUAL_SPEC: Record<MetricKey, ActualSpec> = {
  // --- ファネル件数（⚠️ 丸めなし。その工程の日付だけを見る）-----------------
  leads: { kind: 'count', phase: 'reaction', rollUp: false },
  zeroReception: { kind: 'count', phase: 'zeroReception', rollUp: false },
  energized: { kind: 'count', phase: 'contact', rollUp: false },
  firstInterview: { kind: 'count', phase: 'visit', rollUp: false },
  secondInterview: { kind: 'count', phase: 'nextAppointment', rollUp: false },
  preScreening: { kind: 'count', phase: 'preScreening', rollUp: false },
  contracts: { kind: 'count', phase: 'contract', rollUp: false },

  // --- 画面のKPIと同じ数え方（⚠️⚠️ **丸めあり**）----------------------------
  //
  // ⚠️ `rollUp: true` は ⚠️ **その工程から契約までのどの日付でも当たりにする**。
  //   ⚠️ ⚠️ **画面（ShopTrendOrder.tsx の interviewValue / appointmentValue）と同じ。**
  contacts: { kind: 'count', phase: 'contact', rollUp: true },
  visits: { kind: 'count', phase: 'visit', rollUp: true },
  nextAppointments: { kind: 'count', phase: 'nextAppointment', rollUp: true },
  applications: { kind: 'count', phase: 'application', rollUp: true },

  /**
   * ⚠️ 来場予約数。⚠️ **予約日そのもの**も実績日に入れる。
   *   ⚠️ `reserved_interview` は日付ではなく text の列である。
   */
  reservations: {
    kind: 'count',
    phase: 'visit',
    rollUp: false,
    extraColumns: ['reserved_interview'],
  },

  // --- ステータス内訳・属性（⚠️⚠️ **実績日が無い**）-------------------------
  lost: NO_DATE(
    '⚠️ ステータスが「失注」の件数。' +
      '⚠️⚠️ 失注日の列（competitor_lost_contract_reason 側の運用）は空欄が多く、' +
      'これを実績日にすると失注数が実態より大幅に少なく出る。' +
      NO_STATUS_DATE
  ),
  prospective: NO_DATE(NO_STATUS_DATE),
  duplicated: NO_DATE(NO_STATUS_DATE),
  highRank: NO_DATE(
    'ランクは顧客の現在の評価であり、いつその評価になったかの日付が無い。' + NO_STATUS_DATE
  ),

  // --- 追客量（⚠️ ログ件数。⚠️ **実績日が無い**）----------------------------
  callCountAvg: NO_DATE(NO_LOG_DATE),
  callConnectedAvg: NO_DATE(NO_LOG_DATE),
  noCallRecord: NO_DATE(NO_LOG_DATE),
  interviewLogAvg: NO_DATE(NO_LOG_DATE),
  interviewsLed: NO_DATE(NO_LOG_DATE),

  // --- リードタイム（⚠️ **終点の日**でその月に置く）-------------------------
  //
  // ⚠️ 例: `avgDaysToContract` は ⚠️ **その月に契約した顧客**の平均日数になる。
  //   ⚠️ ⚠️ **反響日起算だと「その月に反響を取った顧客」の平均**で、意味が違う。
  avgDaysToFirstInterview: { kind: 'avgDays', phase: 'visit', from: 'reaction' },
  avgDaysToContract: { kind: 'avgDays', phase: 'contract', from: 'reaction' },
  medianDaysToFirstInterview: { kind: 'median', phase: 'visit' },
  medianDaysToContract: { kind: 'median', phase: 'contract' },
  medianDaysFirstInterviewToContract: { kind: 'median', phase: 'contract' },
};

/**
 * その指標の実績日となる列（正規化済みのSQL式）を返す。
 *
 * ⚠️ 事業に無い工程は列が空なので、⚠️ **空配列が返る**（＝常に0件）。
 */
export const actualDateExprs = (
  division: AnalysisDivision,
  spec: ActualSpec
): string[] => {
  if (spec.kind === 'none') return [];

  const phases: AnalysisPhase[] =
    spec.kind === 'count' && spec.rollUp
      ? [...PHASE_ORDER].slice(PHASE_ORDER.indexOf(spec.phase))
      : [spec.phase];

  const columns = phases.flatMap((phase) => PHASE_COLUMNS[division][phase] ?? []);

  if (spec.kind === 'count' && spec.extraColumns !== undefined) {
    columns.push(...spec.extraColumns);
  }

  // ⚠️ 同じ列が2度入ることがある（建売の申込と注文の契約など）。重複を落とす
  return [...new Set(columns)].map((column) => asDate(`m.${column}`));
};

/** 中央値・平均の起点。⚠️ 反響日は事業で変わらないが、表から引いておく */
export const actualFromDateExpr = (
  division: AnalysisDivision,
  phase: AnalysisPhase
): string => {
  const columns = PHASE_COLUMNS[division][phase] ?? [];
  return columns.length === 0 ? 'NULL' : asDate(`m.${columns[0]}`);
};

// ---------------------------------------------------------------------------
// 期間と集計バケット
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **期間を省略したときの既定。**
 *   ⚠️ 実績日起算は ⚠️ **月ごとに全行を突き合わせる**ため、
 *     ⚠️ **全期間を既定にすると重くなる。**
 */
export const DEFAULT_MONTHS = 24;

/** ⚠️ バケット数の上限。⚠️ これを超えると行数もクエリも膨らむ */
export const MAX_BUCKETS = 120;

/** 'YYYY-MM' を1ヶ月進める */
const nextMonth = (ym: string): string => {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** 当月を 'YYYY-MM' で返す */
export const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** `count` ヶ月前の月を 'YYYY-MM' で返す */
export const monthsAgo = (count: number): string => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** from〜to（両端を含む）の月を並べる */
export const monthRange = (from: string, to: string): string[] => {
  const months: string[] = [];
  let cursor = from;
  while (cursor <= to && months.length <= MAX_BUCKETS) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }
  return months;
};

/**
 * 月の並びから、軸に応じたバケットの一覧を作る。
 * ⚠️ 重複は落として並び順を保つ。
 */
export const bucketsOf = (key: DimensionKey, months: string[]): string[] => {
  if (key === 'year') return [...new Set(months.map((m) => m.slice(0, 4)))];
  if (key === 'quarter') {
    return [
      ...new Set(
        months.map((m) => `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`)
      ),
    ];
  }
  return [...months];
};

/** 日付の式から、軸に応じたバケットの文字列を作るSQL式 */
export const bucketExpr = (key: DimensionKey, dateExpr: string): string => {
  if (key === 'year') return `DATE_FORMAT(${dateExpr}, '%Y')`;
  if (key === 'quarter') return `CONCAT(YEAR(${dateExpr}), '-Q', QUARTER(${dateExpr}))`;
  return `DATE_FORMAT(${dateExpr}, '%Y-%m')`;
};

/**
 * バケットの文字列をSQLに直接書き込んでよいか検査する。
 *
 * ⚠️⚠️ **ここを通った文字列しかSQLに埋め込まないこと。**
 *   ⚠️ バケットは from / to から**サーバー側で組み立てた**値だが、
 *     ⚠️ ⚠️ **元をたどればリクエスト由来**である。
 *   ⚠️ 形が 'YYYY-MM' / 'YYYY-Qn' / 'YYYY' のいずれかであることを必ず確かめる。
 */
export const assertBucket = (bucket: string): string => {
  if (!/^[0-9]{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/u.test(bucket)) {
    throw new Error(`集計バケットの形式が不正です: ${bucket}`);
  }
  return bucket;
};
