import type { RowDataPacket } from 'mysql2/promise';
import {
  actualCountSql,
  actualEndDateExpr,
  actualFromDateExpr,
  assertBucket,
  NO_ACTUAL_DATE,
  bucketExpr,
  bucketsOf,
  currentMonth,
  DEFAULT_MONTHS,
  MAX_BUCKETS,
  monthRange,
  monthsAgo,
  TIME_DIMENSIONS,
} from './actual';
import { asDate, daysBetween, MIN_VALID_DATE, phaseDate, TARGET_DIVISION, UNSET_LABEL, groupExpr } from './columns';
import type { AnalysisDivision } from './columns';
import { DIVISION_CONFIG, phaseDateOf } from './columns';
import {
  fetchShownMediums,
  kaeruMediumNote,
  kaeruMediumSqlActual,
  kaeruMediumSqlCohort,
} from './trendMedium';
import type { DimensionKey } from './dimensions';
import { dimension } from './dimensions';
import type { MetricKey, RateKey } from './metrics';
import { denominatorFor, medianValueSqlFor, metric, metricSqlFor, RATES } from './metrics';
import { query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { AppError } from '../../errors/AppError';

/**
 * 分析用の集計クエリを組み立てて実行する。
 *
 * SQL文字列を動的に組むが、埋め込むのは dimensions.ts / metrics.ts の
 * 許可リストから引いたSQL式だけで、リクエスト由来の文字列は必ず
 * プレースホルダに渡す。
 */

/** 1レスポンスで返す最大行数 */
export const MAX_ROWS = 2000;

/**
 * rows 部分の最大バイト数。
 *
 * 行数だけでは大きさを抑えきれない。指標を増やすと1行が長くなるため、
 * 上限2000行でも600KB（約36万トークン）に達しうる。
 * 実測の目安: 月 × 営業課 183行 = 57KB / 月 × 店舗 590行 = 179KB。
 * 日本語混じりのJSONは 1バイト ≒ 0.6トークンなので、250KB を上限とする。
 */
export const MAX_BYTES = 250 * 1024;

/** 集計の基準日。コホートをどちらの日付で切るか */
export type Basis = 'reaction' | 'contract' | 'actual';

export const BASES: Record<Basis, { sql: string; label: string; note: string }> = {
  /**
   * ⚠️⚠️ **2026-09-24 に追加し、既定にした**（利用者の指示）。
   *   > とくに「反響日起算で」「実績日起算で」の文言がない場合、デフォルトは実績日起算とする
   */
  actual: {
    // ⚠️ 指標ごとに日付が違うため、1つの式では表せない。組み立ては actual.ts
    sql: '(指標ごとに異なる)',
    label: '実績日',
    note:
      '⚠️ 指標ごとに「その出来事が起きた日」でその月に数える（契約数は契約日、来場数は来場日）。' +
      '⚠️ ダッシュボードの店舗別動向（shopTrend）・反響推移（customerTrend）と同じ数え方であり、' +
      '画面の数字と突き合わせられるのはこちら。' +
      '⚠️ 反響の獲得月とは対応しない。1月に反響を取り3月に契約した顧客は、' +
      'leads が1月、contracts が3月に立つ。' +
      '⚠️ そのため同じ月の leads と contracts から転換率を出しても「その反響の契約率」にはならない。' +
      'コホートとしての転換率を見たいときは basis = reaction を使うこと。' +
      '⚠️ 実績日を持たない指標（lost / 架電・面談ログ系 / highRank など）は null を返す。0件ではない。',
  },
  reaction: {
    sql: phaseDate('reaction'),
    label: '反響取得日',
    note:
      'その月に獲得した反響が、その後どこまで進んだかを見る（コホート集計）。' +
      '⚠️ ダッシュボードの shop/ customer 画面と同じ数え方。' +
      '⚠️ 「反響日起算で」と言われたらこれを使う。',
  },
  contract: {
    sql: phaseDate('contract'),
    label: '契約日',
    note:
      'その月に何件契約したかを見る。反響の獲得月とは対応しない。' +
      '⚠️ 契約日が入っている顧客だけが母数になるため、leads と contracts は必ず同じ値になり、' +
      '契約率は常に100%になる。転換率を見たい場合は basis = reaction を使うこと。',
  },
};

export interface PivotOptions {
  groupBy: DimensionKey[];
  metrics: MetricKey[];
  rates: RateKey[];
  basis: Basis;
  /** 'YYYY-MM'。基準日がこの月以降 */
  from?: string;
  /** 'YYYY-MM'。基準日がこの月以前 */
  to?: string;
  /** 軸と同じキーで等値絞り込み */
  filters: Partial<Record<DimensionKey, string>>;
  /** ステータスが「重複」の顧客を母数から除くか */
  excludeDuplicated: boolean;
  /**
   * ⚠️ 事業（2026-09-22 追加）。⚠️ **省略すると注文事業**（今までと同じ）。
   *   ⚠️⚠️ **テーブルと工程の定義がまるごと変わる**（columns.ts の DIVISION_CONFIG）。
   */
  division?: AnalysisDivision;
}

export type PivotRow = Record<string, string | number | null>;

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

interface JoinNeed {
  inquiry: boolean;
  call: boolean;
  interview: boolean;
}

/**
 * 軸のSQL式を引く。
 *
 * ⚠️⚠️ **建売の販促媒体だけは表から引けない**（2026-09-24 追加）。
 *   ⚠️ 画面と同じ項目名にまとめる必要があり、
 *     ⚠️ ⚠️ **反響日起算では `medium_kaeru` を読んでから式を組み立てる**ため。
 *   ⚠️ 組み立ては features/analysis/trendMedium.ts。
 *
 * ⚠️ ⚠️ **軸・絞り込み・中央値の3箇所すべてでこれを使うこと。**
 *   ⚠️ 1箇所でも `dimension().sql()` を直に呼ぶと、そこだけ生値になって食い違う。
 */
const dimensionSql = (
  key: DimensionKey,
  basisSql: string,
  mediumSql: string | null
): string => (key === 'medium' && mediumSql !== null ? mediumSql : dimension(key).sql(basisSql));

/**
 * 建売の販促媒体の式を用意する。⚠️ 注文事業では `null`（今までどおり生値）。
 */
const resolveMediumSql = async (
  division: AnalysisDivision,
  basis: Basis
): Promise<string | null> => {
  if (division !== 'kaeru') return null;
  if (basis === 'actual') return kaeruMediumSqlActual();
  return kaeruMediumSqlCohort(await fetchShownMediums());
};

/**
 * FROM 句を組み立てる。
 *
 * ⚠️ 結合先の3テーブルは master_data.id に対して重複行を持つ
 *   （実測: inquiry_customer.pg_id 27件 / call_sheet.id 2件 / interview_sheet.id 1件）。
 *   そのまま JOIN すると COUNT(*) が水増しされるため、必ず事前集計してから結合する。
 *   shop_list も同名店舗が複数行ある場合に備えて shop 単位に畳む。
 */
const buildFrom = (
  need: JoinNeed,
  division: AnalysisDivision = 'order'
): { sql: string; params: SqlParam[] } => {
  // ⚠️⚠️ **テーブル名は許可表から引くこと。** ⚠️ リクエストの値を埋め込まない
  const config = DIVISION_CONFIG[division];

  let sql = `
    FROM ${config.table} m
    JOIN (
      SELECT shop,
             MIN(brand)   AS brand,
             MIN(section) AS section,
             MIN(area)    AS area
        FROM shop_list
       WHERE division = ? AND report_flag = 1 AND shop <> ''
       GROUP BY shop
    ) s ON s.shop = m.in_charge_store`;

  const params: SqlParam[] = [config.shopDivision];

  if (need.inquiry) {
    // 1顧客が複数の反響レコードを持つ場合（27件）は MIN で1件に寄せる。
    // 反響媒体は軸としての利用なので、どれか1つに確定できれば足りる。
    sql += `
    LEFT JOIN (
      SELECT pg_id, MIN(response_medium) AS response_medium
        FROM inquiry_customer
       WHERE delete_flag = 0 AND pg_id <> ''
       GROUP BY pg_id
    ) ic ON ic.pg_id = m.id`;
  }

  if (need.call) {
    // call_log は JSON 配列。実データは日本語が生UTF-8の行と \uXXXX エスケープの行が
    // 混在しているが、JSON_SEARCH はどちらも正しく照合する
    // （LIKE '%通電%' だとエスケープ済みの行を取りこぼす）。
    // note には顧客との会話内容が入るため、件数以外は取り出さない。
    sql += `
    LEFT JOIN (
      SELECT id,
             SUM(COALESCE(JSON_LENGTH(call_log), 0)) AS call_count,
             SUM(COALESCE(JSON_LENGTH(JSON_SEARCH(call_log, 'all', '通電', NULL, '$[*].action')), 0)) AS call_connected
        FROM call_sheet
       WHERE id <> ''
       GROUP BY id
    ) cs ON cs.id = m.id`;
  }

  if (need.interview) {
    // interview_log の note にも個人情報が入るため、件数のみ集計する
    /**
     * ⚠️ `interview_log` の本文も持ち出す（2026-09-22）。
     *   ⚠️ ⚠️ **中身は返さない。** ⚠️ 担当者名と突き合わせて
     *     ⚠️ **「本人が面談したか」を数えるためだけ**に使う（METRICS.interviewsLed）。
     *   ⚠️ `MAX()` なのは、⚠️ **1顧客1行がほぼ前提**だから
     *     （実測 18,161行 / 18,160人）。⚠️ 複数行あれば新しくない方を落とす。
     */
    sql += `
    LEFT JOIN (
      SELECT id,
             SUM(COALESCE(JSON_LENGTH(interview_log), 0)) AS interview_count,
             MAX(interview_log) AS interview_log
        FROM interview_sheet
       WHERE id <> ''
       GROUP BY id
    ) iv ON iv.id = m.id`;
  }

  return { sql, params };
};

/**
 * WHERE 句を組み立てる。
 *
 * ⚠️ プレースホルダはSQLの出現順にバインドされる。
 *   buildFrom() のパラメータを必ず先に並べること。
 */
/**
 * @param basisSql 集計基準日の式。
 *   ⚠️⚠️ **`null` は実績日起算（basis = actual）を意味する。**
 *     ⚠️ ⚠️ **基準日による絞り込みを一切しない。**
 *       ⚠️ 絞ると「反響が期間外で、契約だけが期間内」の顧客が落ちる。
 */
const buildWhere = (
  options: PivotOptions,
  basisSql: string | null,
  mediumSql: string | null
): { sql: string; params: SqlParam[] } => {
  const conditions = ['m.show_dashboard = 1'];
  const params: SqlParam[] = [];

  if (basisSql !== null) {
    conditions.push(`${basisSql} IS NOT NULL`);
    // 0004年のような入力ミスが実在し、月次軸を壊すため足切りする
    conditions.push(`${basisSql} >= ?`);
    params.push(MIN_VALID_DATE);

    if (options.from !== undefined) {
      conditions.push(`DATE_FORMAT(${basisSql}, '%Y-%m') >= ?`);
      params.push(options.from);
    }
    if (options.to !== undefined) {
      conditions.push(`DATE_FORMAT(${basisSql}, '%Y-%m') <= ?`);
      params.push(options.to);
    }
  }

  if (options.excludeDuplicated) {
    conditions.push("COALESCE(m.status, '') <> '重複'");
  }

  for (const [key, value] of Object.entries(options.filters)) {
    if (value === undefined) continue;

    /**
     * ⚠️⚠️ **実績日起算では月・四半期・年で絞り込めない。**
     *   ⚠️ 指標ごとに日付が違うため、⚠️ **どの指標の月で絞るのかが決まらない。**
     *   ⚠️ ⚠️ **from / to を使ってもらう。**
     */
    if (basisSql === null && TIME_DIMENSIONS.includes(key as DimensionKey)) {
      throw AppError.badRequest(
        `実績日起算（basis = actual）では ${key} での絞り込みはできません。` +
          '指標ごとに見る日付が違うため、どの日付の月で絞るのかが決まらないためです。' +
          'from / to で期間を指定するか、basis = reaction（反響日起算）を使ってください。'
      );
    }

    // 絞り込みも軸と同じ許可リストのSQL式を使う。値はプレースホルダ経由
    conditions.push(
      `${dimensionSql(key as DimensionKey, basisSql ?? 'NULL', mediumSql)} = ?`
    );
    params.push(value);
  }

  return { sql: `WHERE ${conditions.join('\n     AND ')}`, params };
};

/** 数値カラムは mysql2 が文字列で返すことがある（DECIMAL 等）ため明示的に数値化する */
const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** 軸の値の組み合わせから、中央値クエリの結果を突き合わせるためのキーを作る */
const rowKey = (row: PivotRow, groupBy: DimensionKey[]): string =>
  JSON.stringify(groupBy.map((key) => row[key]));

/** rows がコンテキストに載る大きさか確認する */
const assertPayloadSize = (rows: PivotRow[], groupBy: readonly string[]): void => {
  const bytes = Buffer.byteLength(JSON.stringify(rows), 'utf8');
  if (bytes > MAX_BYTES) {
    throw AppError.badRequest(
      `集計結果が ${Math.round(bytes / 1024)} KB になり、上限の ${Math.round(MAX_BYTES / 1024)} KB を超えました（${rows.length}行）。` +
        'groupBy の軸を減らす、metrics を絞る、from / to で期間を狭める、のいずれかで小さくしてください。' +
        `（指定された軸: ${groupBy.join(', ')}）`
    );
  }
};

/** ⚠️ 実績日起算のときだけ付く情報。meta に載せて Claude に渡す */
export interface ActualInfo {
  /** ⚠️ 省略されたときに補った期間も含む、実際に使った期間 */
  from: string;
  to: string;
  /** 月・四半期・年のうち、バケットとして使った軸 */
  bucketDimension?: DimensionKey;
  /** ⚠️⚠️ **null を返した指標とその理由**（⚠️ 0件ではない） */
  nullMetrics: Record<string, string>;
}

export interface PivotResult {
  rows: PivotRow[];
  basis: (typeof BASES)[Basis];
  actual?: ActualInfo;
  /** ⚠️ 建売で販促媒体を使ったときだけ付く、項目名の説明（2026-09-24 追加） */
  mediumNote?: string;
}

/**
 * 集計基準日を事業に合わせて引く（2026-09-22 追加）。
 *
 * ⚠️⚠️ **契約日の列が事業で違う。**
 *   ⚠️ ⚠️ **建売で注文の列を使うと「申込日」で切ってしまう。**
 */
export const basisSqlFor = (basis: Basis, division: AnalysisDivision): string =>
  basis === 'contract' ? phaseDateOf(division, 'contract') : phaseDateOf(division, 'reaction');

export const runPivot = async (options: PivotOptions): Promise<PivotResult> => {
  // ⚠️ 実績日起算は組み立てがまるごと違う（指標ごとに日付が変わる）
  if (options.basis === 'actual') return runActualPivot(options);

  const division: AnalysisDivision = options.division ?? 'order';
  const basis = BASES[options.basis];
  const basisSql = basisSqlFor(options.basis, division);

  const requested = options.metrics;
  const medianMetrics = requested.filter((key) => metric(key).kind === 'median');

  // 比率の算出に必要な件数指標は、明示的に要求されていなくても内部で取得する
  const needed = new Set<MetricKey>(requested);
  if (options.rates.length > 0) {
    needed.add('leads');
    for (const rate of options.rates) {
      needed.add(RATES[rate].numerator);
      // ⚠️ 分母の指標も取らないと比率が出せない
      // ⚠️ ここはコホート（反響日起算・契約日起算）側なので分母は leads
      needed.add(denominatorFor(rate, options.division ?? 'order', false));
    }
  }
  const countMetrics = [...needed].filter((key) => metric(key).kind === 'count');

  // 重いJOINは、それを必要とする指標・軸が要求されたときだけ足す
  const need: JoinNeed = { inquiry: false, call: false, interview: false };
  for (const key of [...options.groupBy, ...(Object.keys(options.filters) as DimensionKey[])]) {
    if (dimension(key).needsInquiry === true) need.inquiry = true;
  }
  for (const key of countMetrics) {
    const m = metric(key);
    if (m.kind !== 'count') continue;
    if (m.needsCall === true) need.call = true;
    if (m.needsInterview === true) need.interview = true;
  }

  // ⚠️ 建売の販促媒体だけ、画面と同じ項目名にまとめる式に差し替える
  const mediumSql = await resolveMediumSql(division, options.basis);

  const from = buildFrom(need, division);
  const where = buildWhere(options, basisSql, mediumSql);
  const params = [...from.params, ...where.params];

  // 軸は d0,d1… / 指標は a0,a1… の別名で受け取り、アプリ側でキー名に戻す。
  // 日本語のキー名をSQLの別名にすると識別子のクォートで事故りやすいため。
  const dimensionSelects = options.groupBy.map(
    (key, i) => `${dimensionSql(key, basisSql, mediumSql)} AS d${i}`
  );
  const metricSelects = countMetrics.map((key, i) => {
    // ⚠️ 事業ごとに工程の列が違う（metricSqlFor）
    return `${metricSqlFor(division, key)} AS a${i}`;
  });

  const groupNumbers = options.groupBy.map((_, i) => i + 1).join(', ');
  const groupByClause = options.groupBy.length === 0 ? '' : `GROUP BY ${groupNumbers}`;
  const orderByClause = options.groupBy.length === 0 ? '' : `ORDER BY ${groupNumbers}`;

  const raws = await query<DynamicRow>(
    `
    SELECT ${[...dimensionSelects, ...metricSelects].join(',\n           ')}
    ${from.sql}
    ${where.sql}
    ${groupByClause}
    ${orderByClause}
    LIMIT ${MAX_ROWS + 1}
  `,
    params
  );

  if (raws.length > MAX_ROWS) {
    throw AppError.badRequest(
      `集計結果が ${MAX_ROWS} 行を超えました。groupBy の軸を減らすか、from / to で期間を絞ってください。` +
        `（指定された軸: ${options.groupBy.join(', ')}）`
    );
  }

  const rows: PivotRow[] = raws.map((raw) => {
    const row: PivotRow = {};
    options.groupBy.forEach((key, i) => {
      // 空欄はSQL側で (未設定) に畳んである。NULL が来るのは想定外だが保険で寄せる
      row[key] = (raw[`d${i}`] as string | null) ?? UNSET_LABEL;
    });

    const values = new Map<MetricKey, number | null>();
    countMetrics.forEach((key, i) => values.set(key, toNumber(raw[`a${i}`])));

    // 出力するのは要求された指標だけ（比率のために取ったものは出さない）
    for (const key of requested) {
      const m = metric(key);
      if (m.kind !== 'count') continue;
      const value = values.get(key) ?? null;
      // 件数は整数で返す。平均値（decimal）は 4.0 を 4 に丸めず小数のまま返す
      row[key] = value !== null && m.decimal !== true ? Math.round(value) : value;
    }

    for (const rate of options.rates) {
      const numerator = values.get(RATES[rate].numerator);
      // ⚠️ 反響日起算の分母は今までどおり leads
      const denominator = values.get(denominatorFor(rate, division, false));
      row[rate] =
        denominator === null || denominator === undefined || denominator === 0
          || numerator === null || numerator === undefined
          ? null
          : Math.round((numerator / denominator) * 1000) / 10;
    }

    return row;
  });

  if (medianMetrics.length > 0) {
    await attachMedians(rows, medianMetrics, options, basisSql, need, mediumSql);
  }

  assertPayloadSize(rows, options.groupBy);

  return { rows, basis, mediumNote: await mediumNoteFor(division, options, false) };
};

/**
 * 建売で販促媒体を使ったときだけ、項目名の説明を添える。
 * ⚠️⚠️ **書かないと、画面の「Web検索」行と件数が合わない理由が伝わらない。**
 */
const mediumNoteFor = async (
  division: AnalysisDivision,
  options: PivotOptions,
  basisIsActual: boolean
): Promise<string | undefined> => {
  if (division !== 'kaeru') return undefined;

  const used =
    options.groupBy.includes('medium') || options.filters.medium !== undefined;
  if (!used) return undefined;

  const shown = basisIsActual ? [] : await fetchShownMediums();
  return kaeruMediumNote(basisIsActual, shown);
};

/**
 * 実績日起算（basis = actual）の集計。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **反響日起算と決定的に違う点**
 *
 *   1. ⚠️ **WHERE で基準日を絞らない。**
 *      ⚠️ 絞ると「反響は期間外、契約だけ期間内」の顧客が落ちる。
 *   2. ⚠️ **指標ごとに見る日付が違う。**
 *      ⚠️ そのため `metricSqlFor()` は使わず、actual.ts の定義から組み立てる。
 *   3. ⚠️⚠️ **月の軸は顧客の列からではなく、こちらが作った月のカレンダーから出す。**
 *      ⚠️ 1行の顧客が複数の月に数えられるため、CROSS JOIN で月を掛ける。
 *
 * ⚠️ 期間を省略すると ⚠️ **直近24ヶ月**になる（全期間だと月×全行で重い）。
 * ─────────────────────────────────────────────
 */
const runActualPivot = async (options: PivotOptions): Promise<PivotResult> => {
  const division: AnalysisDivision = options.division ?? 'order';
  const basis = BASES.actual;

  // ⚠️ 期間を確定する。⚠️ **省略されたら補う**（実績日起算では必須）
  const to = options.to ?? currentMonth();
  const from = options.from ?? monthsAgo(DEFAULT_MONTHS - 1);

  if (from > to) {
    throw AppError.badRequest(`from（${from}）が to（${to}）より後になっています。`);
  }

  const months = monthRange(from, to);
  if (months.length > MAX_BUCKETS) {
    throw AppError.badRequest(
      `実績日起算で指定できる期間は最大 ${MAX_BUCKETS} ヶ月です（指定: ${from} 〜 ${to}）。` +
        'from / to で期間を絞ってください。'
    );
  }

  /**
   * ⚠️⚠️ **時間軸は1つまで。**
   *   ⚠️ 月と年を同時に指定されても、⚠️ **どちらのバケットで数えるか決まらない。**
   */
  const timeDimensions = options.groupBy.filter((key) => TIME_DIMENSIONS.includes(key));
  if (timeDimensions.length > 1) {
    throw AppError.badRequest(
      `実績日起算では時間の軸（${TIME_DIMENSIONS.join(' / ')}）を同時に2つ以上は使えません` +
        `（指定: ${timeDimensions.join(', ')}）。1つに絞ってください。`
    );
  }
  const timeDimension = timeDimensions[0];
  const buckets =
    timeDimension === undefined ? null : bucketsOf(timeDimension, months).map(assertBucket);

  const requested = options.metrics;
  const medianMetrics = requested.filter((key) => metric(key).kind === 'median');

  // 比率の算出に必要な件数指標は、明示的に要求されていなくても内部で取得する
  const needed = new Set<MetricKey>(requested);
  if (options.rates.length > 0) {
    needed.add('leads');
    for (const rate of options.rates) {
      needed.add(RATES[rate].numerator);
      // ⚠️ 分母の指標も取らないと比率が出せない
      // ⚠️ 実績日起算は画面と同じ分母（次アポ率なら実来場）を取る
      needed.add(denominatorFor(rate, division, true));
    }
  }
  const countMetrics = [...needed].filter((key) => metric(key).kind === 'count');

  /**
   * ⚠️ 実績日起算では架電・面談ログの指標は null を返すため、
   *   ⚠️ ⚠️ **重い JOIN が要るのは軸だけ**になる。
   */
  const need: JoinNeed = { inquiry: false, call: false, interview: false };
  for (const key of [...options.groupBy, ...(Object.keys(options.filters) as DimensionKey[])]) {
    if (dimension(key).needsInquiry === true) need.inquiry = true;
  }

  // ⚠️ 建売の販促媒体だけ、画面と同じ項目名にまとめる式に差し替える
  const mediumSql = await resolveMediumSql(division, 'actual');

  const fromClause = buildFrom(need, division);
  const where = buildWhere(options, null, mediumSql);

  let fromSql = fromClause.sql;
  if (buckets !== null) {
    /**
     * ⚠️⚠️ **バケットはSQLに直接書き込んでいる。**
     *   ⚠️ 値は from / to から**組み立てた**もので、⚠️ `assertBucket()` を通してある。
     *   ⚠️ ⚠️ **ここを緩めないこと。**
     */
    const rows = buckets.map((bucket) => `SELECT '${bucket}' AS bucket`).join('\n      UNION ALL ');
    fromSql += `\n    CROSS JOIN (\n      ${rows}\n    ) cal`;
  }

  // ⚠️ SELECT 句のプレースホルダは FROM / WHERE より**先に**並べること
  const selectParams: SqlParam[] = [];

  /** その日付が、いま数えているバケット（または期間全体）に入るか */
  const inRange = (dateExpr: string): string => {
    if (buckets !== null && timeDimension !== undefined) {
      return `${bucketExpr(timeDimension, dateExpr)} = cal.bucket`;
    }
    selectParams.push(from, to);
    return `DATE_FORMAT(${dateExpr}, '%Y-%m') BETWEEN ? AND ?`;
  };

  const dimensionSelects = options.groupBy.map((key, i) =>
    key === timeDimension
      ? `cal.bucket AS d${i}`
      : // ⚠️ 時間以外の軸は基準日を使わない。ダミーを渡す
        `${dimensionSql(key, 'NULL', mediumSql)} AS d${i}`
  );

  const nullMetrics: Record<string, string> = {};

  const metricSelects = countMetrics.map((key, i) => {
    /**
     * リードタイムの平均。
     * ⚠️ 終点の日がその期間にある顧客だけで平均する（例: その月に契約した人）。
     */
    if (key === 'avgDaysToFirstInterview' || key === 'avgDaysToContract') {
      const end = actualEndDateExpr(division, key === 'avgDaysToContract' ? 'contract' : 'visit');
      if (end === 'NULL') return `NULL AS a${i}`;
      const value = daysBetween(actualFromDateExpr(division), end);
      return `ROUND(AVG(CASE WHEN ${inRange(end)} THEN ${value} END), 1) AS a${i}`;
    }

    const sql = actualCountSql(division, key, inRange);

    // ⚠️⚠️ **実績日が無い指標は null。** ⚠️ **0 にしないこと**
    if (sql === null) {
      const reason = NO_ACTUAL_DATE[key];
      if (requested.includes(key) && reason !== undefined) nullMetrics[key] = reason;
      return `NULL AS a${i}`;
    }

    // ⚠️ その事業に無い工程（注文の「申込」など）は常に0件
    if (sql === '') return `0 AS a${i}`;

    /**
     * ⚠️⚠️ **`COALESCE` を外さないこと。**
     *   ⚠️ 日付が NULL の行では比較結果も NULL になり、
     *     ⚠️ ⚠️ **全行が NULL だと SUM が 0 ではなく NULL を返す。**
     */
    return `SUM(COALESCE(${sql}, 0)) AS a${i}`;
  });

  const groupNumbers = options.groupBy.map((_, i) => i + 1).join(', ');
  const groupByClause = options.groupBy.length === 0 ? '' : `GROUP BY ${groupNumbers}`;
  const orderByClause = options.groupBy.length === 0 ? '' : `ORDER BY ${groupNumbers}`;

  const raws = await query<DynamicRow>(
    `
    SELECT ${[...dimensionSelects, ...metricSelects].join(',\n           ')}
    ${fromSql}
    ${where.sql}
    ${groupByClause}
    ${orderByClause}
    LIMIT ${MAX_ROWS + 1}
  `,
    [...selectParams, ...fromClause.params, ...where.params]
  );

  if (raws.length > MAX_ROWS) {
    throw AppError.badRequest(
      `集計結果が ${MAX_ROWS} 行を超えました。groupBy の軸を減らすか、from / to で期間を絞ってください。` +
        `（指定された軸: ${options.groupBy.join(', ')}）`
    );
  }

  const rows: PivotRow[] = raws.map((raw) => {
    const row: PivotRow = {};
    options.groupBy.forEach((key, i) => {
      row[key] = (raw[`d${i}`] as string | null) ?? UNSET_LABEL;
    });

    const values = new Map<MetricKey, number | null>();
    countMetrics.forEach((key, i) => values.set(key, toNumber(raw[`a${i}`])));

    for (const key of requested) {
      const m = metric(key);
      if (m.kind !== 'count') continue;
      const value = values.get(key) ?? null;
      row[key] = value !== null && m.decimal !== true ? Math.round(value) : value;
    }

    for (const rate of options.rates) {
      const numerator = values.get(RATES[rate].numerator);
      /**
       * ⚠️⚠️ **実績日起算の分母は画面（反響推移）に合わせる。**
       *   ⚠️ 例: 注文の次アポ率・契約率の分母は ⚠️ **実来場**であって総反響ではない。
       */
      const denominator = values.get(denominatorFor(rate, division, true));
      row[rate] =
        denominator === null || denominator === undefined || denominator === 0
          || numerator === null || numerator === undefined
          ? null
          : Math.round((numerator / denominator) * 1000) / 10;
    }

    return row;
  });

  if (medianMetrics.length > 0) {
    await attachMediansActual(
      rows,
      medianMetrics,
      options,
      need,
      division,
      from,
      to,
      nullMetrics,
      mediumSql
    );
  }

  assertPayloadSize(rows, options.groupBy);

  return {
    rows,
    basis,
    actual: { from, to, bucketDimension: timeDimension, nullMetrics },
    mediumNote: await mediumNoteFor(division, options, true),
  };
};

/**
 * 実績日起算の中央値。
 *
 * ⚠️⚠️ **中央値だけは指標ごとに基準日を差し替えて、普通のコホート集計として取る。**
 *   ⚠️ 例: `medianDaysToContract` は ⚠️ **契約日を基準日にする**。
 *     ⚠️ ⚠️ **その月に契約した顧客のリードタイム**になり、画面の読み方と一致する。
 *   ⚠️ 月のバケットは `DATE_FORMAT(契約日, '%Y-%m')` になるので、
 *     ⚠️ **上のカレンダー由来のバケット文字列とそのまま突き合う。**
 */
const attachMediansActual = async (
  rows: PivotRow[],
  medianMetrics: MetricKey[],
  options: PivotOptions,
  need: JoinNeed,
  division: AnalysisDivision,
  from: string,
  to: string,
  nullMetrics: Record<string, string>,
  mediumSql: string | null
): Promise<void> => {
  for (const key of medianMetrics) {
    /**
     * ⚠️ 中央値は ⚠️ **終点の日を基準日にして**、普通のコホート集計として取る。
     *   ⚠️ 例: `medianDaysToContract` は ⚠️ **その月に契約した顧客**のリードタイムになる。
     */
    const basisSql = actualEndDateExpr(
      division,
      key === 'medianDaysToFirstInterview' ? 'visit' : 'contract'
    );

    // ⚠️ その事業に無い工程。⚠️ 0 ではなく null を返す
    if (basisSql === 'NULL') {
      nullMetrics[key] = `${division === 'kaeru' ? '建売分譲事業' : '注文事業'}にこの工程が無いため算出できない。`;
      for (const row of rows) row[key] = null;
      continue;
    }

    await attachMedians(rows, [key], { ...options, from, to }, basisSql, need, mediumSql);
  }
};

/**
 * 中央値を別クエリで取り、軸の値で突き合わせて行にマージする。
 *
 * MariaDB は PERCENTILE_CONT を集計関数として使えず（本番10.5 / ローカル10.11 で確認）、
 * MEDIAN() はウィンドウ関数としてしか書けない。
 * そのため PARTITION BY で軸ごとに値を出し、DISTINCT で1行に畳む。
 */
const attachMedians = async (
  rows: PivotRow[],
  medianMetrics: MetricKey[],
  options: PivotOptions,
  basisSql: string,
  need: JoinNeed,
  mediumSql: string | null
): Promise<void> => {
  const from = buildFrom(need, options.division ?? 'order');
  const where = buildWhere(options, basisSql, mediumSql);
  const params = [...from.params, ...where.params];

  const selects: string[] = [];
  const partition: string[] = [];
  options.groupBy.forEach((key, i) => {
    const expr = dimensionSql(key, basisSql, mediumSql);
    selects.push(`${expr} AS d${i}`);
    partition.push(expr);
  });

  const over = partition.length === 0 ? '' : `PARTITION BY ${partition.join(', ')}`;

  medianMetrics.forEach((key, i) => {
    const m = metric(key);
    if (m.kind !== 'median') throw new Error(`中央値指標ではありません: ${key}`);
    // MEDIAN は NULL を無視するため、日数が算出できない顧客は自然に母数から外れる
    // ⚠️ 事業ごとに工程の列が違う（medianValueSqlFor）
    selects.push(`MEDIAN(${medianValueSqlFor(options.division ?? 'order', key)}) OVER (${over}) AS m${i}`);
  });

  const raws = await query<DynamicRow>(
    `
    SELECT DISTINCT ${selects.join(',\n                    ')}
    ${from.sql}
    ${where.sql}
    LIMIT ${MAX_ROWS + 1}
  `,
    params
  );

  const byKey = new Map<string, PivotRow>();
  for (const raw of raws) {
    const keyRow: PivotRow = {};
    options.groupBy.forEach((key, i) => {
      keyRow[key] = (raw[`d${i}`] as string | null) ?? UNSET_LABEL;
    });
    const values: PivotRow = {};
    medianMetrics.forEach((key, i) => {
      const value = toNumber(raw[`m${i}`]);
      values[key] = value === null ? null : Math.round(value * 10) / 10;
    });
    byKey.set(rowKey(keyRow, options.groupBy), values);
  }

  for (const row of rows) {
    const values = byKey.get(rowKey(row, options.groupBy));
    for (const key of medianMetrics) {
      row[key] = values?.[key] ?? null;
    }
  }
};

// ---------------------------------------------------------------------------
// 未同期リード（inquiry_customer.sync = 0）
// ---------------------------------------------------------------------------

/**
 * 未同期リードで使える軸。
 *
 * inquiry_customer は master_data と別テーブルなので軸の定義も別になる。
 * ⚠️ 氏名・電話番号・メールアドレス・住所の列は軸に加えないこと。
 */
const UNSYNCED_DIMENSIONS = {
  month: { label: '月（反響日の年月）', basis: true },
  store: { label: '店舗', sql: 'ic.shop' },
  brand: { label: 'ブランド（shop_list.brand）', sql: 's.brand' },
  section: { label: '営業課', sql: 's.section' },
  area: { label: 'エリア', sql: 's.area' },
  responseMedium: { label: '反響媒体', sql: 'ic.response_medium' },
} as const satisfies Record<string, { label: string; sql?: string; basis?: boolean }>;

/**
 * 「同期不要」を表す条件。
 *
 * 重複クリック・業者・ブラックリストのタグが付いた反響は、
 * **そもそも顧客台帳に取り込む必要がない**。担当者が意図的にそう判断した
 * 結果であって、対応が漏れているわけではない。
 *
 * ⚠️ これを「未同期」に数えてはならない。
 *   数えると、業者反響や重複クリックが多い店舗・媒体ほど
 *   「追客できていない」ように見え、歩留まりを実態より悪く見せる。
 *   評価を誤らせるため、必ず別カテゴリとして分離する。
 *
 * ⚠️ ダッシュボード側（frontend/src/components/list/listTags.ts の isExcluded）と
 *   同じ定義にすること。片方だけ変えると、マネージャーが画面とClaudeの数字を
 *   見比べたときに食い違う。
 *
 * ⚠️ これらのカラムは 2026-09-02 のマイグレーションで追加された。
 *   それ以前は black_list カラムに文字列を追記し、出現回数の偶奇で
 *   判定していた（SQLからは実質絞り込めなかった）。
 *   移行SQL: backend/scripts/sql/2026-09-02_inquiry_tag_flags.sql
 */
const NO_SYNC_NEEDED_SQL =
  '(ic.duplicate_flag = 1 OR ic.support_flag = 1 OR ic.black_flag = 1)';

export type UnsyncedDimensionKey = keyof typeof UNSYNCED_DIMENSIONS;

export const UNSYNCED_DIMENSION_KEYS = Object.keys(
  UNSYNCED_DIMENSIONS
) as UnsyncedDimensionKey[];

export const unsyncedDimensionLabel = (key: UnsyncedDimensionKey): string =>
  UNSYNCED_DIMENSIONS[key].label;

export interface UnsyncedOptions {
  groupBy: UnsyncedDimensionKey[];
  from?: string;
  to?: string;
}

/**
 * 未同期リードを集計する。
 *
 * inquiry_customer.sync = 0 の反響は pg_id を持たず master_data に紐づかない。
 * つまり顧客台帳に取り込まれておらず、追客されていない可能性がある。
 * master_data 側からは存在自体が見えないため、専用の集計として切り出している。
 *
 * 反響は3つに分かれる。
 *
 *   inquiries = noSyncNeeded + unsynced + synced
 *
 *   noSyncNeeded … 同期不要。重複クリック / 業者 / ブラックリスト。
 *                  担当者が「取り込まない」と判断済みのもの
 *   unsynced     … 同期すべきなのに未同期。これだけが「追客漏れの可能性」
 *   synced       … 同期済み
 *
 * 返す列:
 *   inquiries      … 全反響数
 *   noSyncNeeded   … 同期不要と判断された件数
 *   syncTarget     … 同期すべき件数（inquiries − noSyncNeeded）
 *   unsynced       … syncTarget のうち未同期
 *   synced         … syncTarget のうち同期済み
 *   unsyncedRatePct… unsynced ÷ syncTarget のパーセント
 */
export const runUnsynced = async (options: UnsyncedOptions): Promise<PivotRow[]> => {
  const inquiryDate = asDate('ic.inquiry_date');

  const selects = options.groupBy.map((key, i) => {
    const definition = UNSYNCED_DIMENSIONS[key];
    const expr =
      'basis' in definition && definition.basis === true
        ? `DATE_FORMAT(${inquiryDate}, '%Y-%m')`
        : (definition as { sql: string }).sql;
    return `${groupExpr(expr)} AS d${i}`;
  });

  const conditions = [
    'ic.delete_flag = 0',
    `${inquiryDate} IS NOT NULL`,
    `${inquiryDate} >= ?`,
  ];
  // FROM 内の division が先に来るため、パラメータもその順で並べる
  const params: SqlParam[] = [TARGET_DIVISION, MIN_VALID_DATE];

  if (options.from !== undefined) {
    conditions.push(`DATE_FORMAT(${inquiryDate}, '%Y-%m') >= ?`);
    params.push(options.from);
  }
  if (options.to !== undefined) {
    conditions.push(`DATE_FORMAT(${inquiryDate}, '%Y-%m') <= ?`);
    params.push(options.to);
  }

  const groupNumbers = options.groupBy.map((_, i) => i + 1).join(', ');

  const raws = await query<DynamicRow>(
    `
    SELECT ${[
      ...selects,
      'COUNT(*) AS inquiries',
      `SUM(${NO_SYNC_NEEDED_SQL}) AS no_sync_needed`,
      `SUM(NOT ${NO_SYNC_NEEDED_SQL}) AS sync_target`,
      `SUM(ic.sync = 0 AND NOT ${NO_SYNC_NEEDED_SQL}) AS unsynced`,
      `SUM(ic.sync = 1 AND NOT ${NO_SYNC_NEEDED_SQL}) AS synced`,
    ].join(',\n           ')}
      FROM inquiry_customer ic
      JOIN (
        SELECT shop, MIN(brand) AS brand, MIN(section) AS section, MIN(area) AS area
          FROM shop_list
         WHERE division = ? AND report_flag = 1 AND shop <> ''
         GROUP BY shop
      ) s ON s.shop = ic.shop
     WHERE ${conditions.join('\n       AND ')}
     ${options.groupBy.length === 0 ? '' : `GROUP BY ${groupNumbers}`}
     ${options.groupBy.length === 0 ? '' : `ORDER BY ${groupNumbers}`}
     LIMIT ${MAX_ROWS + 1}
  `,
    params
  );

  if (raws.length > MAX_ROWS) {
    throw AppError.badRequest(
      `集計結果が ${MAX_ROWS} 行を超えました。groupBy の軸を減らすか、from / to で期間を絞ってください。`
    );
  }

  const rows = raws.map((raw) => {
    const row: PivotRow = {};
    options.groupBy.forEach((key, i) => {
      row[key] = (raw[`d${i}`] as string | null) ?? UNSET_LABEL;
    });
    const syncTarget = toNumber(raw.sync_target) ?? 0;
    const unsynced = toNumber(raw.unsynced) ?? 0;

    row.inquiries = toNumber(raw.inquiries) ?? 0;
    row.noSyncNeeded = toNumber(raw.no_sync_needed);
    row.syncTarget = syncTarget;
    row.unsynced = unsynced;
    row.synced = toNumber(raw.synced);
    // ⚠️ 分母は inquiries ではなく syncTarget（同期すべき件数）。
    //   同期不要のものを分母に入れると、業者反響の多い媒体ほど
    //   未同期率が低く見えてしまい、店舗・媒体の比較にならない。
    row.unsyncedRatePct =
      syncTarget === 0 ? null : Math.round((unsynced / syncTarget) * 1000) / 10;
    return row;
  });

  assertPayloadSize(rows, options.groupBy);

  return rows;
};
