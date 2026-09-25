import { asDate, PHASE_COLUMNS, PHASE_ORDER } from './columns';
import type { AnalysisDivision, AnalysisPhase } from './columns';
import type { DimensionKey } from './dimensions';
import type { MetricKey } from './metrics';

/**
 * 実績日起算（basis = actual）の定義。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **画面と同じ数え方にすること**（2026-09-24 の指示）。
 *
 *   実績日起算 … customerTrend/CustomerTrendOrder.tsx  （注文事業）
 *                customerTrend/CustomerTrendKaeru.tsx  （建売分譲事業）
 *
 * ⚠️ ⚠️ **2026-09-24 に作り直した。**
 *   ⚠️ 最初は shopTrend の数え方（「その工程から契約までのどれかがその月」）で作ったが、
 *     ⚠️⚠️ **customerTrend は数え方が違い、歩留まりが合わなかった。**
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **2つの事業で数え方そのものが違う。** ⚠️ **片方に寄せないこと。**
 *
 *   建売 … ⚠️ **「その工程の最も古い日付。空なら上位工程の最も古い日付」**で到達日を1つに決める
 *           （`evaluateKPI()` / `getOldestDate()`）。⚠️ **1人は1つの月にしか立たない。**
 *
 *   注文 … ⚠️ **面談日があればその月。無いときだけ下位の日付で拾う**（`getValue()`）。
 *           ⚠️⚠️ **拾い方が OR なので、1人が複数の月に立つことがある。**
 *           ⚠️ ⚠️ **画面がそうなっている。** ⚠️ 直すと画面と合わなくなる。
 */

/** ⚠️ 集計基準日に依存する軸。⚠️ **実績日起算ではこの軸だけ扱いが変わる** */
export const TIME_DIMENSIONS: DimensionKey[] = ['month', 'quarter', 'year'];

// ---------------------------------------------------------------------------
// 日付の式
// ---------------------------------------------------------------------------

/** その工程の列（正規化済みの日付式）。⚠️ 事業に無い工程は空配列 */
const columnsOf = (division: AnalysisDivision, phase: AnalysisPhase): string[] =>
  (PHASE_COLUMNS[division][phase] ?? []).map((column) => asDate(`m.${column}`));

/** その工程より後ろの工程すべて（⚠️ フォールバック先） */
const higherPhases = (phase: AnalysisPhase): AnalysisPhase[] =>
  [...PHASE_ORDER].slice(PHASE_ORDER.indexOf(phase) + 1);

/**
 * 複数の日付のうち最も古いもの。
 *
 * ⚠️⚠️ **`LEAST` は引数に1つでも NULL があると NULL を返す。**
 *   ⚠️ いったん遠い日付で埋めてから、⚠️ **最後に NULL へ戻す。**
 *   ⚠️ ⚠️ **埋めた値をそのまま返すと、未入力が 9999年として集計される。**
 *
 * ⚠️ 画面の `getOldestDate()`（日付文字列をソートして先頭）と同じ意味。
 */
const oldest = (dates: string[]): string => {
  if (dates.length === 0) return 'NULL';
  if (dates.length === 1) return dates[0];
  const filled = dates.map((date) => `COALESCE(${date}, '9999-12-31')`);
  return `NULLIF(LEAST(${filled.join(', ')}), '9999-12-31')`;
};

/** 工程の集合に対する最古の日付 */
const oldestOfPhases = (division: AnalysisDivision, phases: AnalysisPhase[]): string =>
  oldest(phases.flatMap((phase) => columnsOf(division, phase)));

/**
 * 建売の到達日。
 *
 * ⚠️ 画面の `evaluateKPI(b, targetKeys, higherKeys)` をそのまま写したもの。
 *   ⚠️⚠️ **自身の工程が空のときだけ上位へ落ちる。** ⚠️ 両方を OR で見るのではない。
 */
const reachDateKaeru = (phase: AnalysisPhase, withFallback: boolean): string => {
  const own = oldestOfPhases('kaeru', [phase]);
  if (!withFallback) return own;

  const higher = oldestOfPhases('kaeru', higherPhases(phase));
  if (own === 'NULL') return higher;
  if (higher === 'NULL') return own;
  return `COALESCE(${own}, ${higher})`;
};

// ---------------------------------------------------------------------------
// 指標ごとの組み立て
// ---------------------------------------------------------------------------

/** ある日付がいま数えている期間に入るかを返す関数（query.ts が渡す） */
export type InRange = (dateExpr: string) => string;

/**
 * ⚠️ 実績日が無い指標の理由。
 *
 * ⚠️⚠️ **0 を返してはいけない。** ⚠️ ⚠️ **Claude が「失注0件」と語ってしまう。**
 *   ⚠️ null にして、⚠️ **理由を meta に添える**（2026-09-24 の利用者の判断）。
 */
const NO_STATUS_DATE =
  '台帳のステータス（現在の状態）であり、いつそうなったかの日付が無い。' +
  '実績日起算では月に割り当てられないため null を返す。' +
  '件数を知りたいときは basis=reaction（反響日起算）で取ること。';

const NO_LOG_DATE =
  '架電・面談ログの件数から作る指標で、顧客1人に対する現在値である。' +
  '工程の日付を持たないため実績日起算では月に割り当てられない。' +
  'basis=reaction（反響日起算）で取ること。';

export const NO_ACTUAL_DATE: Partial<Record<MetricKey, string>> = {
  lost:
    '⚠️ ステータスが「失注」の件数。⚠️⚠️ 失注日の列は空欄が多く、' +
    'これを実績日にすると失注数が実態より大幅に少なく出る。' + NO_STATUS_DATE,
  prospective: NO_STATUS_DATE,
  duplicated: NO_STATUS_DATE,
  highRank: 'ランクは顧客の現在の評価であり、いつその評価になったかの日付が無い。' + NO_STATUS_DATE,
  callCountAvg: NO_LOG_DATE,
  callConnectedAvg: NO_LOG_DATE,
  noCallRecord: NO_LOG_DATE,
  interviewLogAvg: NO_LOG_DATE,
  interviewsLed: NO_LOG_DATE,
};

/** ⚠️ 画面が「契約」と数えるステータス。⚠️⚠️ **事業で違う** */
const CONTRACT_STATUS: Record<AnalysisDivision, string[]> = {
  // ⚠️ 注文は解約も契約として数える（CustomerTrendOrder.tsx）
  order: ['契約済み', '解約'],
  // ⚠️⚠️ **建売は契約済みのみ**（CustomerTrendKaeru.tsx）
  kaeru: ['契約済み'],
};

const statusCondition = (division: AnalysisDivision): string =>
  `m.status IN (${CONTRACT_STATUS[division].map((s) => `'${s}'`).join(', ')})`;

/** 中央値・平均の起点（反響日） */
export const actualFromDateExpr = (division: AnalysisDivision): string =>
  oldestOfPhases(division, ['reaction']);

/** リードタイムの終点。⚠️ 到達日と同じ決め方にする */
export const actualEndDateExpr = (
  division: AnalysisDivision,
  phase: AnalysisPhase
): string =>
  division === 'kaeru' ? reachDateKaeru(phase, true) : oldestOfPhases('order', [phase]);

/**
 * 件数指標のSQL。
 *
 * ⚠️ 戻り値が `null` なら「実績日が無い指標」（⚠️ **呼び出し側が NULL を返す**）。
 * ⚠️ 空文字なら「その事業に無い工程」（⚠️ **呼び出し側が 0 を返す**）。
 */
export const actualCountSql = (
  division: AnalysisDivision,
  key: MetricKey,
  inRange: InRange
): string | null | '' => {
  if (NO_ACTUAL_DATE[key] !== undefined) return null;

  /** その工程の日付だけを見る（丸めなし） */
  const plain = (phase: AnalysisPhase): string | '' => {
    const date = oldestOfPhases(division, [phase]);
    if (date === 'NULL') return '';
    return inRange(date);
  };

  /** 到達日（丸めあり）を見る */
  const rolled = (phase: AnalysisPhase): string | '' => {
    if (division === 'kaeru') {
      const date = reachDateKaeru(phase, true);
      if (date === 'NULL') return '';
      return inRange(date);
    }
    return orderRolled(phase, inRange);
  };

  switch (key) {
    // --- 反響 ------------------------------------------------------------
    case 'leads':
      return plain('reaction');

    // --- 各工程（丸めなし。⚠️ その工程の日付だけ）-------------------------
    case 'zeroReception':
      return plain('zeroReception');
    case 'energized':
      return plain('contact');
    case 'firstInterview':
      return plain('visit');
    case 'secondInterview':
      return plain('nextAppointment');
    case 'preScreening':
      return plain('preScreening');

    // --- 画面のKPI（丸めあり）--------------------------------------------
    case 'contacts':
      return rolled('contact');
    case 'visits':
      return rolled('visit');
    case 'nextAppointments':
      return division === 'kaeru'
        ? rolled('nextAppointment')
        : orderNextAppointment(inRange);
    case 'applications':
      return rolled('application');

    /**
     * ⚠️ 来場予約数。⚠️ **予約日そのもの**も見る。
     *   ⚠️ `reserved_interview` は日付ではなく text の列である。
     */
    case 'reservations': {
      const reserved = asDate('m.reserved_interview');
      const visit = oldestOfPhases(division, ['visit']);
      const parts = [inRange(reserved)];
      if (visit !== 'NULL') parts.push(inRange(visit));
      return parts.map((part) => `(${part})`).join(' OR ');
    }

    /**
     * ⚠️⚠️ **契約だけはステータスも見る。**
     *   ⚠️ 注文は「契約済み＋解約」、⚠️ **建売は「契約済み」のみ**。
     *   ⚠️ ⚠️ **見ないと画面より多く出る**（日付だけ入って失注した顧客が混ざる）。
     */
    case 'contracts': {
      const date =
        division === 'kaeru' ? reachDateKaeru('contract', false) : oldestOfPhases('order', ['contract']);
      if (date === 'NULL') return '';
      return `(${inRange(date)}) AND ${statusCondition(division)}`;
    }

    default:
      return null;
  }
};

/**
 * 注文の「実来場数」。
 *
 * ⚠️ 画面（CustomerTrendOrder.tsx の `getValue('interview')`）をそのまま写したもの。
 *
 * ```
 * interviewBase    … 面談日がその月
 * appointmentBase  … 面談日が無く、かつ（次アポ・事前審査・契約）のどれかがその月
 * ```
 *
 * ⚠️⚠️ **「面談日があれば面談日だけを見る」のが要点。**
 *   ⚠️ ⚠️ **上位の日付と OR にしないこと。** ⚠️ 2月に来場して5月に契約した人が5月にも立つ。
 */
const orderRolled = (phase: AnalysisPhase, inRange: InRange): string | '' => {
  const own = oldestOfPhases('order', [phase]);
  const higher = higherPhases(phase).flatMap((p) => columnsOf('order', p));

  if (own === 'NULL' && higher.length === 0) return '';
  if (own === 'NULL') return higher.map((date) => `(${inRange(date)})`).join(' OR ');
  if (higher.length === 0) return inRange(own);

  const fallback = higher.map((date) => `(${inRange(date)})`).join(' OR ');
  return `CASE WHEN ${own} IS NOT NULL THEN (${inRange(own)}) ELSE (${fallback}) END`;
};

/**
 * 注文の「次アポ数」。
 *
 * ⚠️⚠️ **面談日がある人は「面談した月」に次アポとして数える。**
 *   ⚠️ 画面（`getValue('appointment')`）がそうなっている。
 *
 * ```
 * b.interview あり … 面談日がその月 かつ（次アポ・事前審査・契約のどれかが入っている）
 * b.interview なし … （次アポ・事前審査・契約）のどれかがその月
 * ```
 *
 * ⚠️ ⚠️ **「面談した月」であって「次アポを取った月」ではない。** ⚠️ 直感と違うので注意。
 */
const orderNextAppointment = (inRange: InRange): string | '' => {
  const visit = oldestOfPhases('order', ['visit']);
  const later = [
    ...columnsOf('order', 'nextAppointment'),
    ...columnsOf('order', 'preScreening'),
    ...columnsOf('order', 'application'),
    ...columnsOf('order', 'contract'),
  ];

  if (later.length === 0) return '';

  const laterInRange = later.map((date) => `(${inRange(date)})`).join(' OR ');
  const laterExists = later.map((date) => `${date} IS NOT NULL`).join(' OR ');

  if (visit === 'NULL') return laterInRange;

  return (
    `CASE WHEN ${visit} IS NOT NULL` +
    ` THEN ((${inRange(visit)}) AND (${laterExists}))` +
    ` ELSE (${laterInRange}) END`
  );
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
 */
export const assertBucket = (bucket: string): string => {
  if (!/^[0-9]{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/u.test(bucket)) {
    throw new Error(`集計バケットの形式が不正です: ${bucket}`);
  }
  return bucket;
};
