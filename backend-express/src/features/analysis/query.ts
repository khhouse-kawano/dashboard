import type { RowDataPacket } from 'mysql2/promise';
import { asDate, MIN_VALID_DATE, phaseDate, TARGET_DIVISION, UNSET_LABEL, groupExpr } from './columns';
import type { DimensionKey } from './dimensions';
import { dimension } from './dimensions';
import type { MetricKey, RateKey } from './metrics';
import { metric, RATES } from './metrics';
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
export type Basis = 'reaction' | 'contract';

export const BASES: Record<Basis, { sql: string; label: string; note: string }> = {
  reaction: {
    sql: phaseDate('reaction'),
    label: '反響取得日',
    note: 'その月に獲得した反響が、その後どこまで進んだかを見る（コホート集計）。',
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
 * FROM 句を組み立てる。
 *
 * ⚠️ 結合先の3テーブルは master_data.id に対して重複行を持つ
 *   （実測: inquiry_customer.pg_id 27件 / call_sheet.id 2件 / interview_sheet.id 1件）。
 *   そのまま JOIN すると COUNT(*) が水増しされるため、必ず事前集計してから結合する。
 *   shop_list も同名店舗が複数行ある場合に備えて shop 単位に畳む。
 */
const buildFrom = (need: JoinNeed): { sql: string; params: SqlParam[] } => {
  let sql = `
    FROM master_data m
    JOIN (
      SELECT shop,
             MIN(brand)   AS brand,
             MIN(section) AS section,
             MIN(area)    AS area
        FROM shop_list
       WHERE division = ? AND report_flag = 1 AND shop <> ''
       GROUP BY shop
    ) s ON s.shop = m.in_charge_store`;

  const params: SqlParam[] = [TARGET_DIVISION];

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
    sql += `
    LEFT JOIN (
      SELECT id, SUM(COALESCE(JSON_LENGTH(interview_log), 0)) AS interview_count
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
const buildWhere = (
  options: PivotOptions,
  basisSql: string
): { sql: string; params: SqlParam[] } => {
  const conditions = [
    'm.show_dashboard = 1',
    `${basisSql} IS NOT NULL`,
    // 0004年のような入力ミスが実在し、月次軸を壊すため足切りする
    `${basisSql} >= ?`,
  ];
  const params: SqlParam[] = [MIN_VALID_DATE];

  if (options.from !== undefined) {
    conditions.push(`DATE_FORMAT(${basisSql}, '%Y-%m') >= ?`);
    params.push(options.from);
  }
  if (options.to !== undefined) {
    conditions.push(`DATE_FORMAT(${basisSql}, '%Y-%m') <= ?`);
    params.push(options.to);
  }
  if (options.excludeDuplicated) {
    conditions.push("COALESCE(m.status, '') <> '重複'");
  }

  for (const [key, value] of Object.entries(options.filters)) {
    if (value === undefined) continue;
    // 絞り込みも軸と同じ許可リストのSQL式を使う。値はプレースホルダ経由
    conditions.push(`${dimension(key as DimensionKey).sql(basisSql)} = ?`);
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

export interface PivotResult {
  rows: PivotRow[];
  basis: (typeof BASES)[Basis];
}

export const runPivot = async (options: PivotOptions): Promise<PivotResult> => {
  const basis = BASES[options.basis];
  const basisSql = basis.sql;

  const requested = options.metrics;
  const medianMetrics = requested.filter((key) => metric(key).kind === 'median');

  // 比率の算出に必要な件数指標は、明示的に要求されていなくても内部で取得する
  const needed = new Set<MetricKey>(requested);
  if (options.rates.length > 0) {
    needed.add('leads');
    for (const rate of options.rates) needed.add(RATES[rate].numerator);
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

  const from = buildFrom(need);
  const where = buildWhere(options, basisSql);
  const params = [...from.params, ...where.params];

  // 軸は d0,d1… / 指標は a0,a1… の別名で受け取り、アプリ側でキー名に戻す。
  // 日本語のキー名をSQLの別名にすると識別子のクォートで事故りやすいため。
  const dimensionSelects = options.groupBy.map(
    (key, i) => `${dimension(key).sql(basisSql)} AS d${i}`
  );
  const metricSelects = countMetrics.map((key, i) => {
    const m = metric(key);
    if (m.kind !== 'count') throw new Error(`件数指標ではありません: ${key}`);
    return `${m.sql} AS a${i}`;
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

    const leads = values.get('leads');
    for (const rate of options.rates) {
      const numerator = values.get(RATES[rate].numerator);
      row[rate] =
        leads === null || leads === undefined || leads === 0 || numerator === null || numerator === undefined
          ? null
          : Math.round((numerator / leads) * 1000) / 10;
    }

    return row;
  });

  if (medianMetrics.length > 0) {
    await attachMedians(rows, medianMetrics, options, basisSql, need);
  }

  assertPayloadSize(rows, options.groupBy);

  return { rows, basis };
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
  need: JoinNeed
): Promise<void> => {
  const from = buildFrom(need);
  const where = buildWhere(options, basisSql);
  const params = [...from.params, ...where.params];

  const selects: string[] = [];
  const partition: string[] = [];
  options.groupBy.forEach((key, i) => {
    const expr = dimension(key).sql(basisSql);
    selects.push(`${expr} AS d${i}`);
    partition.push(expr);
  });

  const over = partition.length === 0 ? '' : `PARTITION BY ${partition.join(', ')}`;

  medianMetrics.forEach((key, i) => {
    const m = metric(key);
    if (m.kind !== 'median') throw new Error(`中央値指標ではありません: ${key}`);
    // MEDIAN は NULL を無視するため、日数が算出できない顧客は自然に母数から外れる
    selects.push(`MEDIAN(${m.valueSql}) OVER (${over}) AS m${i}`);
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
      'SUM(ic.sync = 0) AS unsynced',
      'SUM(ic.sync = 1) AS synced',
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
    const inquiries = toNumber(raw.inquiries) ?? 0;
    const unsynced = toNumber(raw.unsynced) ?? 0;

    row.inquiries = inquiries;
    row.unsynced = unsynced;
    row.synced = toNumber(raw.synced);
    row.unsyncedRatePct = inquiries === 0 ? null : Math.round((unsynced / inquiries) * 1000) / 10;
    return row;
  });

  assertPayloadSize(rows, options.groupBy);

  return rows;
};
