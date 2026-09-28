# 分析APIに実績日起算を入れ、既定にする（v2.2.147）

⚠️ 指示（`ReadMeClaude.md`）:

> # UI改修
> フロントエンドは変更しないため引き続きv2.2.147にて作業
>
> ## 要件
> - 分析APIの改修
>     * バックエンドのみの改修希望 MCPサーバーは変えずに
>     **反響日起算で** **実績日起算で**
>     といった文言で反響状況を尋ねられた場合のレスポンス
>     **反響日起算** 反響取得した日をもとに歩留まりを計算
>         …frontend/src/components/shop
>         …frontend/src/components/customer
>         ディレクトリを参照
>
>     **実績日起算** 実行日をもとに歩留まりを計算
>         …frontend/src/components/shopTrend
>         …frontend/src/components/customerTrend
>         ディレクトリを参照

⚠️ 口頭での追加指示（同日）:

> なお、とくに**反響日起算で** **実績日起算で**の文言がない場合、デフォルトは実績日起算とする

---

## ⚠️ 何が足りなかったか

⚠️ 分析APIの集計基準日は ⚠️ **`reaction` と `contract` の2つだけ**だった。

| | 改修前のAPI | 画面 |
|---|---|---|
| 反響日起算 | ⚠️ `basis=reaction`（既定） | `shop/` `customer/` |
| ⚠️ **実績日起算** | ⚠️⚠️ **無い** | `shopTrend/` `customerTrend/` |

⚠️⚠️ **`basis=contract` は実績日起算の代用にならない。**
⚠️ ⚠️ **契約日が入っている顧客しか母数に入らず、`leads` と `contracts` が必ず同じ値になる。**

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| `backend-express/src/features/analysis/` | ⚠️ **`actual.ts`** | ⚠️ **新規** |
| 同上 | `query.ts` | ⚠️ **`runActualPivot()` / `attachMediansActual()` を追加** |
| 同上 | `index.ts` | ⚠️ `basis` に `actual` を追加し ⚠️ **既定に** |
| 同上 | `meta.ts` | ⚠️ 説明文を全面的に追記 |

⚠️⚠️ **フロントは1行も触っていない。** ⚠️ **MCP サーバーも触っていない。** ⚠️ **DB も変えていない。**

---

## ⚠️ MCP を変えずに済んだ理由

⚠️ MCP の `basis` は ⚠️ **`z.enum(['reaction','contract'])`** のままである。

| 利用者の言い方 | Claude が送るもの | 結果 |
|---|---|---|
| ⚠️ **「実績日起算で」** | ⚠️⚠️ **何も送らない** | ⚠️ 既定＝`actual` |
| ⚠️ **（どちらとも言わない）** | ⚠️⚠️ **何も送らない** | ⚠️ 既定＝`actual` |
| ⚠️ **「反響日起算で」** | ⚠️ `basis=reaction` | ⚠️ **今の enum で通る** |

⚠️⚠️ **MCP の説明文に「既定の reaction」と書いてあり、そこだけ古い。**
⚠️ ⚠️ **`GET /meta` と毎回の応答 meta に「既定は実績日起算」と明記して打ち消している。**
⚠️ **次に MCP を配布する版で、説明文も直すこと。**

---

## 1. 追加したファイル

### `backend-express/src/features/analysis/actual.ts`（新規・全文）

```ts
import { asDate, PHASE_COLUMNS, PHASE_ORDER } from './columns';
import type { AnalysisDivision, AnalysisPhase } from './columns';
import type { DimensionKey } from './dimensions';
import type { MetricKey } from './metrics';

/** ⚠️ 集計基準日に依存する軸。⚠️ **実績日起算ではこの軸だけ扱いが変わる** */
export const TIME_DIMENSIONS: DimensionKey[] = ['month', 'quarter', 'year'];

export type ActualSpec =
  | { kind: 'count'; phase: AnalysisPhase; rollUp: boolean; extraColumns?: string[] }
  | { kind: 'avgDays'; phase: AnalysisPhase; from: AnalysisPhase }
  | { kind: 'median'; phase: AnalysisPhase }
  | { kind: 'none'; reason: string };

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
  leads: { kind: 'count', phase: 'reaction', rollUp: false },
  zeroReception: { kind: 'count', phase: 'zeroReception', rollUp: false },
  energized: { kind: 'count', phase: 'contact', rollUp: false },
  firstInterview: { kind: 'count', phase: 'visit', rollUp: false },
  secondInterview: { kind: 'count', phase: 'nextAppointment', rollUp: false },
  preScreening: { kind: 'count', phase: 'preScreening', rollUp: false },
  contracts: { kind: 'count', phase: 'contract', rollUp: false },

  contacts: { kind: 'count', phase: 'contact', rollUp: true },
  visits: { kind: 'count', phase: 'visit', rollUp: true },
  nextAppointments: { kind: 'count', phase: 'nextAppointment', rollUp: true },
  applications: { kind: 'count', phase: 'application', rollUp: true },

  reservations: {
    kind: 'count',
    phase: 'visit',
    rollUp: false,
    extraColumns: ['reserved_interview'],
  },

  lost: NO_DATE(/* 省略。下の「実績日が無い指標」を参照 */ NO_STATUS_DATE),
  prospective: NO_DATE(NO_STATUS_DATE),
  duplicated: NO_DATE(NO_STATUS_DATE),
  highRank: NO_DATE(NO_STATUS_DATE),

  callCountAvg: NO_DATE(NO_LOG_DATE),
  callConnectedAvg: NO_DATE(NO_LOG_DATE),
  noCallRecord: NO_DATE(NO_LOG_DATE),
  interviewLogAvg: NO_DATE(NO_LOG_DATE),
  interviewsLed: NO_DATE(NO_LOG_DATE),

  avgDaysToFirstInterview: { kind: 'avgDays', phase: 'visit', from: 'reaction' },
  avgDaysToContract: { kind: 'avgDays', phase: 'contract', from: 'reaction' },
  medianDaysToFirstInterview: { kind: 'median', phase: 'visit' },
  medianDaysToContract: { kind: 'median', phase: 'contract' },
  medianDaysFirstInterviewToContract: { kind: 'median', phase: 'contract' },
};

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

export const actualFromDateExpr = (
  division: AnalysisDivision,
  phase: AnalysisPhase
): string => {
  const columns = PHASE_COLUMNS[division][phase] ?? [];
  return columns.length === 0 ? 'NULL' : asDate(`m.${columns[0]}`);
};

export const DEFAULT_MONTHS = 24;
export const MAX_BUCKETS = 120;

const nextMonth = (ym: string): string => {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5, 7));
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const monthsAgo = (count: number): string => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - count, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const monthRange = (from: string, to: string): string[] => {
  const months: string[] = [];
  let cursor = from;
  while (cursor <= to && months.length <= MAX_BUCKETS) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }
  return months;
};

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

export const bucketExpr = (key: DimensionKey, dateExpr: string): string => {
  if (key === 'year') return `DATE_FORMAT(${dateExpr}, '%Y')`;
  if (key === 'quarter') return `CONCAT(YEAR(${dateExpr}), '-Q', QUARTER(${dateExpr}))`;
  return `DATE_FORMAT(${dateExpr}, '%Y-%m')`;
};

export const assertBucket = (bucket: string): string => {
  if (!/^[0-9]{4}(-(0[1-9]|1[0-2])|-Q[1-4])?$/u.test(bucket)) {
    throw new Error(`集計バケットの形式が不正です: ${bucket}`);
  }
  return bucket;
};
```

⚠️ ファイル本体には、それぞれの判断の理由を長いコメントで書いてある（ここでは省略）。

---

## 2. ⚠️ 数え方（⚠️ **画面と同じにしてある**）

⚠️ 画面（[ShopTrendOrder.tsx:249-254](frontend/src/components/shopTrend/ShopTrendOrder.tsx#L249-L254)）は、1つの月について

```ts
const interviewValue = originalCustomerList.filter(c =>
    (formate(c.interview).includes(m) || formate(c.appointment).includes(m)
     || formate(c.screening).includes(m) || formate(c.contract).includes(m))
    && matchTarget(c)).length;
```

⚠️⚠️ **「その工程の日付、またはそれより後の工程の日付が、その月にあるか」**で数えている。
⚠️ これを `rollUp: true` として写した。

### ⚠️ 指標ごとの実績日

| 指標 | 実績日 | 丸め |
|---|---|---|
| `leads` | 反響日 | — |
| `energized` / `contacts` | 接触日 | `contacts` のみ丸めあり |
| `firstInterview` / `visits` | 来場日 | `visits` のみ丸めあり |
| `secondInterview` / `nextAppointments` | 次アポ日 | `nextAppointments` のみ丸めあり |
| `preScreening` | 事前審査日 | — |
| `applications` | 申込日 | ⚠️ 丸めあり（建売のみ） |
| `contracts` | 契約日 | — |
| `reservations` | ⚠️ 来場予約日 または 来場日 | — |
| `avgDaysTo*` / `medianDays*` | ⚠️⚠️ **終点の日**（契約月のリードタイム） | — |

### ⚠️⚠️ 同じ顧客が複数の月に立つ

⚠️ ⚠️ **1月に来場して3月に契約した顧客は、`visits` で1月と3月の両方に数えられる。**
⚠️ ⚠️ **画面もそうなっている。** ⚠️ **直すと歩留まりが画面と合わなくなる。**
⚠️ meta に ⚠️ **「期間をまたいで合計してはならない」**と書いて渡している。

### ⚠️ 実績日が無い指標

⚠️⚠️ **`null` を返す。** ⚠️ ⚠️ **`0` にしてはいけない。** ⚠️ **Claude が「失注0件」と語る。**

| 指標 | 理由 |
|---|---|
| `lost` / `prospective` / `duplicated` / `highRank` | ⚠️ 台帳の**現在の状態**で、いつそうなったかの日付が無い |
| `callCountAvg` / `callConnectedAvg` / `noCallRecord` / `interviewLogAvg` / `interviewsLed` | ⚠️ ログ件数の**現在値** |

⚠️ ⚠️ **理由は meta の「実績日が無く算出できなかった指標」に入れて返している。**

⚠️ `lost` については ⚠️ **失注日の列（`competitor_lost_contract_date`）を使う案も検討したが採らなかった。**
⚠️ ⚠️ **空欄が多く、失注数が実態より大幅に少なく出るため**である（2026-09-24 の利用者の判断）。

---

## 3. 追加した関数（`query.ts`・全文）

### `runActualPivot()`

```ts
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

  const needed = new Set<MetricKey>(requested);
  if (options.rates.length > 0) {
    needed.add('leads');
    for (const rate of options.rates) needed.add(RATES[rate].numerator);
  }
  const countMetrics = [...needed].filter((key) => metric(key).kind === 'count');

  const need: JoinNeed = { inquiry: false, call: false, interview: false };
  for (const key of [...options.groupBy, ...(Object.keys(options.filters) as DimensionKey[])]) {
    if (dimension(key).needsInquiry === true) need.inquiry = true;
  }

  const fromClause = buildFrom(need, division);
  const where = buildWhere(options, null);

  let fromSql = fromClause.sql;
  if (buckets !== null) {
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
      : `${dimension(key).sql('NULL')} AS d${i}`
  );

  const nullMetrics: Record<string, string> = {};

  const metricSelects = countMetrics.map((key, i) => {
    const spec = ACTUAL_SPEC[key];

    // ⚠️⚠️ **実績日が無い指標は null。** ⚠️ **0 にしないこと**
    if (spec.kind === 'none') {
      if (requested.includes(key)) nullMetrics[key] = spec.reason;
      return `NULL AS a${i}`;
    }

    if (spec.kind === 'avgDays') {
      const end = phaseDateOf(division, spec.phase);
      if (end === 'NULL') return `NULL AS a${i}`;
      const value = daysBetween(actualFromDateExpr(division, spec.from), end);
      return `ROUND(AVG(CASE WHEN ${inRange(end)} THEN ${value} END), 1) AS a${i}`;
    }

    const dates = actualDateExprs(division, spec);
    // ⚠️ その事業に無い工程（注文の「申込」など）は常に0件
    if (dates.length === 0) return `0 AS a${i}`;

    const hit = dates.map((dateExpr) => `(${inRange(dateExpr)})`).join(' OR ');
    return `SUM(COALESCE(${hit}, 0)) AS a${i}`;
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
    await attachMediansActual(rows, medianMetrics, options, need, division, from, to, nullMetrics);
  }

  assertPayloadSize(rows, options.groupBy);

  return {
    rows,
    basis,
    actual: { from, to, bucketDimension: timeDimension, nullMetrics },
  };
};
```

### `attachMediansActual()`

```ts
const attachMediansActual = async (
  rows: PivotRow[],
  medianMetrics: MetricKey[],
  options: PivotOptions,
  need: JoinNeed,
  division: AnalysisDivision,
  from: string,
  to: string,
  nullMetrics: Record<string, string>
): Promise<void> => {
  for (const key of medianMetrics) {
    const spec = ACTUAL_SPEC[key];
    const basisSql = spec.kind === 'median' ? phaseDateOf(division, spec.phase) : 'NULL';

    // ⚠️ その事業に無い工程。⚠️ 0 ではなく null を返す
    if (basisSql === 'NULL') {
      nullMetrics[key] = `${division === 'kaeru' ? '建売分譲事業' : '注文事業'}にこの工程が無いため算出できない。`;
      for (const row of rows) row[key] = null;
      continue;
    }

    await attachMedians(rows, [key], { ...options, from, to }, basisSql, need);
  }
};
```

⚠️ ⚠️ **中央値だけは基準日そのものを差し替えて、普通のコホート集計として取っている。**
⚠️ 月のバケットが `DATE_FORMAT(契約日, '%Y-%m')` になり、⚠️ **カレンダー由来のバケットとそのまま突き合う。**

---

## 4. 直した既存の関数

### `buildWhere()`（⚠️ **基準日で絞らない場合を足した**）

```ts
const buildWhere = (
  options: PivotOptions,
  basisSql: string | null
): { sql: string; params: SqlParam[] } => {
  const conditions = ['m.show_dashboard = 1'];
  const params: SqlParam[] = [];

  if (basisSql !== null) {
    conditions.push(`${basisSql} IS NOT NULL`);
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

    if (basisSql === null && TIME_DIMENSIONS.includes(key as DimensionKey)) {
      throw AppError.badRequest(
        `実績日起算（basis = actual）では ${key} での絞り込みはできません。` +
          '指標ごとに見る日付が違うため、どの日付の月で絞るのかが決まらないためです。' +
          'from / to で期間を指定するか、basis = reaction（反響日起算）を使ってください。'
      );
    }

    conditions.push(`${dimension(key as DimensionKey).sql(basisSql ?? 'NULL')} = ?`);
    params.push(value);
  }

  return { sql: `WHERE ${conditions.join('\n     AND ')}`, params };
};
```

⚠️⚠️ **`null` は「基準日で絞らない」を意味する。**
⚠️ ⚠️ **絞ると「反響は期間外、契約だけ期間内」の顧客が落ちる。**

### `runPivot()`（⚠️ 先頭で振り分けるだけ）

```ts
export const runPivot = async (options: PivotOptions): Promise<PivotResult> => {
  // ⚠️ 実績日起算は組み立てがまるごと違う（指標ごとに日付が変わる）
  if (options.basis === 'actual') return runActualPivot(options);
  ...
```

### `index.ts`（⚠️ **既定の変更**）

```ts
  basis: z.enum(['actual', 'reaction', 'contract']).optional().transform((v) => v ?? 'actual'),
```

---

## ⚠️ またブロックコメントを壊した

⚠️⚠️ **コメントに「アスタリスク＋スラッシュ」を書いてビルドが落ちた**（`index.ts:97`）。
⚠️ ⚠️ **そこでコメントが閉じる。**

⚠️ `rankingUi.tsx` のバッククォートと同じ種類の失敗である（⚠️ **こちらは2度やった**）。
⚠️ ⚠️ **同じ場所に注意書きを残した。**

---

## ⚠️ 確認（2026-09-24・ローカル）

⚠️ 検証用のAPIキーを ⚠️ **一時的に作り、使い終わって削除した**（⚠️ **値は一度も表示していない**）。

| # | 確認 | 結果 |
|---|---|---|
| 1 | `npx tsc --noEmit` / `npm run build` | ⚠️ **成功** |
| 2 | ⚠️ **実績日起算（既定）月別** | ⚠️ 2026-05 が leads 1,068 / visits 518 / contracts 87 |
| 3 | ⚠️ **反響日起算 月別** | ⚠️ 同月が visits 359 / contracts 57 ⚠️⚠️ **数字が変わる＝別の数え方になっている** |
| 4 | ⚠️⚠️ **画面と同じSQLで突き合わせ** | ⚠️⚠️ **2026-05 の実来場数 518 が完全一致** |
| 5 | ⚠️ 実績日が無い指標 | ⚠️⚠️ **`lost` / `noCallRecord` が `null`**（⚠️ 0 ではない）＋ meta に理由 |
| 6 | 中央値 | ⚠️ 契約月ごとに出る（2026-06 は 32.5日） |
| 7 | 建売（`division=kaeru`） | ⚠️ **動く**（2026-05 が leads 296 / contracts 46） |
| 8 | 四半期・年の軸 | ⚠️ **動く** |
| 9 | 軸なし（期間まとめ） | ⚠️ **動く**（2026-05 単月で 518） |
| 10 | ⚠️ 期間を省略 | ⚠️⚠️ **直近24ヶ月に補い、meta に「全期間ではない」と明記** |
| 11 | ⚠️ `month=2026-05` で絞る | ⚠️⚠️ **400。理由と代替手段を返す** |
| 12 | ⚠️ 営業課で絞る | ⚠️ **動く** |
| 13 | ⚠️ `energized` | ⚠️ 152 / 122 / 47（⚠️ **直接SQLと一致**）。⚠️ **2026-04以降は入力そのものが止まっており 0 が正しい** |
| 14 | ⚠️ 検証用APIキー | ⚠️ **削除済み（残り0件）** |

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **既定が変わったので、Claude Desktop から引く数字は今までと変わる**（⚠️ **画面と揃う方向**） |
| 2 | ⚠️⚠️ **MCP の説明文「既定の reaction」が古い。** ⚠️ **次に MCP を配布する版で直すこと** |
| 3 | ⚠️ 実績日起算では ⚠️ **同じ顧客が複数の月に立つ**。⚠️ **月をまたいで合計してはならない** |
| 4 | ⚠️ ⚠️ **画面（shopTrend）の定義を変えたら、`actual.ts` の `ACTUAL_SPEC` も直すこと。** ⚠️ 片方だけだと食い違う |
| 5 | ⚠️ 期間を省略すると ⚠️ **直近24ヶ月**。⚠️ 全期間が要るなら `from` を渡す |
| 6 | ⚠️ `lost` を実績日起算で出したくなったら、⚠️ **失注日の入力率を先に上げること** |
