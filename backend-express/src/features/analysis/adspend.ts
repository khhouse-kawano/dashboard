import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { asDate, DIVISION_CONFIG, PHASE_COLUMNS } from './columns';
import type { AnalysisDivision, AnalysisPhase } from './columns';
import { MEDIUM_ALIAS, OTHER_ROW, resolveTrendMedium } from './trendMedium';

/**
 * 販促媒体ごとの広告費とKPI単価（2026-09-29 追加 / v2.2.153）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **画面と同じ数字を返すことだけを目的にしたエンドポイントである。**
 *
 *   事業   合わせる画面
 *   注文   customer/CustomerOrder.tsx（販促媒体別 反響・歩留まり）
 *   建売   customer/CustomerKaeru.tsx（同・建売分譲事業）
 *
 * ⚠️ ⚠️ **なぜ `/pivot` の指標にしなかったか**
 *   ⚠️ 広告費は `budget` テーブルにあり、⚠️⚠️ **顧客1件ごとには紐づかない**
 *     （媒体 × 月 × 店舗でしか持っていない）。
 *   ⚠️ ⚠️ **`master_data` を SUM する仕組みに混ぜると、軸の組み合わせ次第で
 *     ⚠️ 同じ広告費が何度も足される。**
 *
 * ⚠️⚠️ **基準日は反響日起算で固定**（`/pivot` の既定は実績日起算）。
 *   ⚠️ ⚠️ **画面が反響日で切っているため。** ⚠️ 揃えないと単価の分母が合わない。
 *
 * ⚠️⚠️ **KPIの判定は画面をそのまま写している。**
 *   ⚠️ ⚠️ **`/pivot` の同名の指標とは一致しない**（下の `filledPhase` の注記）。
 * ─────────────────────────────────────────────
 */

/** ⚠️ 画面の「総反響」行。⚠️ **すべての顧客・すべての広告費** */
const TOTAL_ROW = '総反響';

/**
 * ⚠️⚠️ **建売で「ホームページ反響」の広告費として数える `budget.medium`。**
 *
 * ⚠️ ⚠️ **frontend/src/components/customer/customerKaeruUtils.ts の
 *   `HOMEPAGE_BUDGET_MEDIUMS` をそのまま写したもの。**
 *   ⚠️ **片方だけ直さないこと。**
 *
 * ⚠️⚠️ **顧客側と同じ判定にはできない。**
 *   ⚠️ 販促費に `hp_campaign` は無く、
 *     ⚠️ ⚠️ **`Amazonギフトカード` のように `medium_kaeru` に無い名前も含める**ため。
 */
const HOMEPAGE_BUDGET_MEDIUMS: string[] = [
  'インターネット検索',
  'SNS広告',
  'Amazonギフトカード',
  'チラシ',
  'LP制作',
];

/**
 * ⚠️ 建売の画面は、開始月を選ばなくても ⚠️ **2025年1月より前を数えない**。
 *   ⚠️ CustomerKaeru.tsx の `PERIOD_START`。⚠️ **顧客と広告費の両方に効く。**
 */
const KAERU_PERIOD_START = '2025-01';

/** 販促費の `section`。⚠️ 画面（customer/queries.ts の BUDGET_SECTION）と同じ */
const BUDGET_SECTION: Record<AnalysisDivision, string> = {
  order: 'order',
  kaeru: 'spec',
};

/**
 * 文字列リテラル。⚠️⚠️ **`HOME'S` のようにシングルクォートを含む名前がある。**
 *   ⚠️ trendMedium.ts と同じもの。⚠️ **必ずここを通すこと。**
 */
const lit = (value: string): string => `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "''")}'`;

/** 末尾の空白と改行を落とす。⚠️ 画面の `cleanMedium()` と同じ */
const cleaned = (column: string): string =>
  `TRIM(REPLACE(REPLACE(COALESCE(${column}, ''), '\\r', ''), '\\n', ''))`;

/**
 * ⚠️⚠️ **その工程の日付が「入っている」か。**
 *
 * ⚠️ ⚠️ **`phaseReached()` とは違う。** ⚠️ あちらは日付として読めるかを見る。
 *   ⚠️⚠️ **画面は文字列が空でないかどうかしか見ていない**ので、こちらに合わせる。
 *   ⚠️ ⚠️ **日付として壊れている値があると、ここだけ1件多く数える。**
 *     ⚠️ 画面と同じ挙動である。
 */
const filledPhase = (division: AnalysisDivision, phase: AnalysisPhase): string => {
  const columns = PHASE_COLUMNS[division][phase] ?? [];
  if (columns.length === 0) return 'FALSE';
  return columns.map((column) => `TRIM(COALESCE(m.${column}, '')) <> ''`).join(' OR ');
};

/** 反響取得日。⚠️ 期間の絞り込みにだけ使う（⚠️ **こちらは日付として読む**） */
const reactionDate = (division: AnalysisDivision): string =>
  asDate(`m.${PHASE_COLUMNS[division].reaction[0]}`);

const STATUS = "TRIM(COALESCE(m.status, ''))";
const RANK = "TRIM(COALESCE(m.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, ''))";

/**
 * 事業ごとのKPI式。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **上位の工程に進んだ人は、下位の工程も達成したものとして数える。**
 *   ⚠️ 画面と同じ。⚠️ ⚠️ **営業が前の工程の日付を入れないため**である。
 *
 * ⚠️ 注文（CustomerOrder.tsx）
 *     来場   = 面談 OR 次アポ OR 事前審査 OR 契約
 *     次アポ = 次アポ OR 事前審査 OR 契約
 *     契約   = 契約日あり かつ ⚠️⚠️ **ステータスが 契約済み / 解約**
 *
 * ⚠️ 建売（CustomerKaeru.tsx）
 *     契約 = （自社契約 OR 仲介契約）かつ ⚠️⚠️ **ステータスが 契約済み**（⚠️ 解約を含まない）
 *     申込 = 申込 OR 契約
 *     来場 = 面談 OR 物件案内 OR 申込
 *     接触 = 接触 OR 来場
 * ─────────────────────────────────────────────
 */
interface KpiSpec {
  /** 出力するキー → SQL の条件式 */
  steps: { key: string; label: string; sql: string }[];
  /** 歩留まりの分母（⚠️ **画面と同じ「ひとつ左の工程」**） */
  rates: { key: string; label: string; numerator: string; denominator: string }[];
  /** ランクの絞り込み。⚠️ 注文だけステータスで絞る */
  rankStatus: string | null;
}

const kpiSpec = (division: AnalysisDivision): KpiSpec => {
  if (division === 'kaeru') {
    const contract = `((${filledPhase('kaeru', 'contract')}) AND ${STATUS} = '契約済み')`;
    const application = `((${filledPhase('kaeru', 'application')}) OR ${contract})`;
    const visit = `((${filledPhase('kaeru', 'visit')}) OR ${application})`;
    const contact = `((${filledPhase('kaeru', 'contact')}) OR ${visit})`;

    return {
      steps: [
        { key: 'contacts', label: '接触数', sql: contact },
        { key: 'visits', label: '来場数', sql: visit },
        { key: 'applications', label: '申込数', sql: application },
        { key: 'contracts', label: '契約数', sql: contract },
      ],
      rates: [
        { key: 'contactRatePct', label: '接触率（接触 ÷ 総反響）', numerator: 'contacts', denominator: 'leads' },
        { key: 'visitRatePct', label: '来場率（来場 ÷ 接触）', numerator: 'visits', denominator: 'contacts' },
        { key: 'applicationRatePct', label: '申込率（申込 ÷ 来場）', numerator: 'applications', denominator: 'visits' },
        { key: 'contractRatePct', label: '契約率（契約 ÷ 申込）', numerator: 'contracts', denominator: 'applications' },
      ],
      // ⚠️⚠️ **建売はステータスで絞らない**（show_dashboard = 1 をすべて見込みとして扱う運用）
      rankStatus: null,
    };
  }

  const contract = `((${filledPhase('order', 'contract')}) AND ${STATUS} IN ('契約済み', '解約'))`;
  const nextAppointment =
    `(${filledPhase('order', 'nextAppointment')}` +
    ` OR ${filledPhase('order', 'preScreening')}` +
    ` OR ${filledPhase('order', 'contract')})`;
  const visit = `((${filledPhase('order', 'visit')}) OR ${nextAppointment})`;

  return {
    steps: [
      { key: 'visits', label: '来場数', sql: visit },
      { key: 'nextAppointments', label: '次アポ数', sql: nextAppointment },
      { key: 'contracts', label: '契約数', sql: contract },
    ],
    rates: [
      { key: 'visitRatePct', label: '来場率（来場 ÷ 総反響）', numerator: 'visits', denominator: 'leads' },
      { key: 'nextAppointmentRatePct', label: '次アポ率（次アポ ÷ 来場）', numerator: 'nextAppointments', denominator: 'visits' },
      { key: 'contractRatePct', label: '契約率（契約 ÷ 来場）', numerator: 'contracts', denominator: 'visits' },
    ],
    // ⚠️ 注文はランクを「見込み」だけで数える（画面と同じ）
    rankStatus: '見込み',
  };
};

const RANKS = ['Sランク', 'Aランク', 'Bランク', 'Cランク'] as const;

export interface AdspendOptions {
  division: AnalysisDivision;
  /** 'YYYY-MM' */
  from?: string;
  to?: string;
  /** 販促媒体名。⚠️ 指定するとその行だけ返す（⚠️ **総反響行は常に返す**） */
  medium?: string;
  shop?: string;
  section?: string;
  area?: string;
}

export interface AdspendRow {
  medium: string;
  adSpend: number;
  leads: number;
  [key: string]: string | number | null;
}

interface CountRow extends RowDataPacket {
  medium: string;
  [key: string]: unknown;
}

interface BudgetRow extends RowDataPacket {
  medium: string;
  adSpend: unknown;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** 単価。⚠️ 分母が0なら null（⚠️ **0円と返すと「無料で取れた」と読まれる**） */
const unitPrice = (spend: number, count: number): number | null =>
  count > 0 ? Math.round(spend / count) : null;

/** 歩留まり。⚠️ 分母が0なら null（⚠️ 画面は0%だが、APIでは「母数なし」と区別する） */
const ratePct = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : null;

// ---------------------------------------------------------------------------
// 広告費（budget テーブル）
// ---------------------------------------------------------------------------

/**
 * 販促費の媒体名を、画面の行の名前へ振り分けるSQL。
 *
 * ⚠️⚠️ **顧客側とは判定が違う。** ⚠️ 販促費に `hp_campaign` は無い。
 *
 * ⚠️ 注文 … ⚠️ **媒体名の素の一致**（画面が `item.medium === value.medium` のため）
 * ⚠️ 建売 … ⚠️ **別名を寄せたうえで、5媒体をホームページ反響へ**
 */
const budgetMediumSql = (division: AnalysisDivision, items: string[], hpRow: string): string => {
  const MEDIUM = cleaned('b.medium');

  if (division === 'kaeru') {
    const normalizedWhens = Object.entries(MEDIUM_ALIAS).map(
      ([canonical, aliases]) =>
        `WHEN ${MEDIUM} IN (${aliases.map(lit).join(', ')}) THEN ${lit(canonical)}`
    );
    const normalized = `CASE ${normalizedWhens.join(' ')} ELSE ${MEDIUM} END`;

    const whens = [
      // ⚠️⚠️ **ホームページ反響を先に見る。** ⚠️ 画面も `isHomepageBudget` を先に見ている
      `WHEN ${MEDIUM} IN (${HOMEPAGE_BUDGET_MEDIUMS.map(lit).join(', ')}) THEN ${lit(hpRow)}`,
      ...items
        .filter((item) => item !== hpRow)
        .map((item) => `WHEN ${normalized} = ${lit(item)} THEN ${lit(item)}`),
    ];
    return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
  }

  const whens = items.map((item) => `WHEN ${MEDIUM} = ${lit(item)} THEN ${lit(item)}`);
  // ⚠️ 媒体マスタに1つも無いときに CASE が壊れないようにする
  if (whens.length === 0) return lit(OTHER_ROW);
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};

/** 販促費の月。⚠️ `budget_period` は `YYYY/MM/DD` の text */
const BUDGET_MONTH = "SUBSTRING(REPLACE(TRIM(COALESCE(b.budget_period, '')), '/', '-'), 1, 7)";

const fetchAdSpend = async (
  options: AdspendOptions,
  items: string[],
  hpRow: string
): Promise<Map<string, number>> => {
  const conditions = ['b.response_medium = 0', 'b.section = ?'];
  const params: (string | number)[] = [BUDGET_SECTION[options.division]];

  const from = options.from ?? (options.division === 'kaeru' ? KAERU_PERIOD_START : undefined);
  if (from !== undefined) {
    conditions.push(`${BUDGET_MONTH} >= ?`);
    params.push(from);
  }
  if (options.to !== undefined) {
    conditions.push(`${BUDGET_MONTH} <= ?`);
    params.push(options.to);
  }

  if (options.shop !== undefined) {
    conditions.push("TRIM(COALESCE(b.shop, '')) = ?");
    params.push(options.shop);
  }
  if (options.section !== undefined) {
    // ⚠️ 画面は `order_section.includes(section)` で見ている
    conditions.push("TRIM(COALESCE(b.order_section, '')) = ?");
    params.push(options.section);
  }
  if (options.area !== undefined) {
    /**
     * ⚠️⚠️ **画面はエリアの店舗を1つしか見ていない**（`shopArray.find(...)`）。
     *   ⚠️ ⚠️ **ここではそのエリアの全店舗を見る。** ⚠️ 画面より広く出る。
     *   ⚠️ 画面側の作りが意図どおりか分からないため、合理的なほうを採った。
     */
    conditions.push(
      "TRIM(COALESCE(b.shop, '')) IN (SELECT shop FROM shop_list WHERE area = ? AND shop <> '')"
    );
    params.push(options.area);
  }

  /**
   * ⚠️⚠️ **建売は「反響のある店舗」の販促費だけを見る**（画面と同じ）。
   *   ⚠️ ⚠️ **外すと、反響を1件も持たない店舗の広告費まで乗って単価が高く出る。**
   *   ⚠️ `NOT IN` で書かないこと（NULL と空文字が混ざっており1行も返らなくなる）。
   */
  if (options.division === 'kaeru') {
    conditions.push(`TRIM(COALESCE(b.shop, '')) IN (
      SELECT DISTINCT in_charge_store
        FROM master_data_kaeru
       WHERE show_dashboard = 1
         AND in_charge_store IS NOT NULL
         AND in_charge_store <> ''
    )`);
  }

  const rows = await query<BudgetRow>(
    `SELECT ${budgetMediumSql(options.division, items, hpRow)} AS medium,
            SUM(b.budget_value) AS adSpend
       FROM budget b
      WHERE ${conditions.join('\n        AND ')}
      GROUP BY 1`,
    params
  );

  const map = new Map<string, number>();
  for (const row of rows) map.set(row.medium, toNumber(row.adSpend));
  return map;
};

// ---------------------------------------------------------------------------
// KPI（顧客台帳）
// ---------------------------------------------------------------------------

const fetchCounts = async (
  options: AdspendOptions,
  mediumSql: string,
  spec: KpiSpec
): Promise<CountRow[]> => {
  const division = options.division;
  const reaction = reactionDate(division);

  const conditions = ['m.show_dashboard = 1'];
  const params: (string | number)[] = [];

  const from = options.from ?? (division === 'kaeru' ? KAERU_PERIOD_START : undefined);

  /**
   * ⚠️⚠️ **期間を指定していないときは、反響日で絞らない。**
   *
   * ⚠️ ⚠️ **画面は反響日が空の顧客も総反響に数えている。**
   *   ⚠️ 期間を選んでいないと日付の比較そのものを行わないため。
   *   ⚠️ ⚠️ **ここで `IS NOT NULL` を足すと、全期間のときだけ画面より少なく出る。**
   *
   * ⚠️ 期間を指定したときは、⚠️ **画面でも日付の比較に失敗して落ちる**ので、
   *   ⚠️ こちらで `IS NOT NULL` を足しても結果は同じになる。
   * ⚠️ ⚠️ **0004年のような壊れた日付も、期間の指定で自然に落ちる。**
   */
  if (from !== undefined || options.to !== undefined) {
    conditions.push(`${reaction} IS NOT NULL`);
  }
  if (from !== undefined) {
    conditions.push(`DATE_FORMAT(${reaction}, '%Y-%m') >= ?`);
    params.push(from);
  }
  if (options.to !== undefined) {
    conditions.push(`DATE_FORMAT(${reaction}, '%Y-%m') <= ?`);
    params.push(options.to);
  }

  if (options.shop !== undefined) {
    conditions.push("TRIM(COALESCE(m.in_charge_store, '')) = ?");
    params.push(options.shop);
  }
  if (options.section !== undefined || options.area !== undefined) {
    /**
     * ⚠️⚠️ **店舗台帳は LEFT JOIN にしてある**（`buildFrom()` は INNER JOIN）。
     *   ⚠️ ⚠️ **画面は店舗台帳と突き合わせていない。**
     *     ⚠️ 内部結合にすると ⚠️ **`shop_list` に無い店舗の顧客が総反響から消え、
     *       ⚠️ 画面の件数と合わなくなる。**
     */
    if (options.section !== undefined) {
      conditions.push('s.section = ?');
      params.push(options.section);
    }
    if (options.area !== undefined) {
      conditions.push('s.area = ?');
      params.push(options.area);
    }
  }

  const selects = [
    `${mediumSql} AS medium`,
    'COUNT(*) AS leads',
    ...spec.steps.map((step) => `SUM(${step.sql}) AS ${step.key}`),
    ...RANKS.map((rank, i) => {
      const status = spec.rankStatus === null ? '' : ` AND ${STATUS} = ${lit(spec.rankStatus)}`;
      return `SUM(${RANK} = ${lit(rank)}${status}) AS rank${i}`;
    }),
  ];

  return query<CountRow>(
    `SELECT ${selects.join(',\n            ')}
       FROM ${DIVISION_CONFIG[division].table} m
       LEFT JOIN (
         SELECT shop, MIN(section) AS section, MIN(area) AS area
           FROM shop_list
          WHERE shop <> ''
          GROUP BY shop
       ) s ON s.shop = m.in_charge_store
      WHERE ${conditions.join('\n        AND ')}
      GROUP BY 1`,
    params
  );
};

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export interface AdspendResult {
  rows: AdspendRow[];
  items: string[];
  spec: KpiSpec;
  /** 広告費が1円も入っていない媒体（⚠️ **単価を語ってはいけない行**） */
  noBudgetItems: string[];
}

export const runAdspend = async (options: AdspendOptions): Promise<AdspendResult> => {
  const division = options.division;
  const spec = kpiSpec(division);

  // ⚠️⚠️ **反響日起算（cohort）の項目名を使う。** ⚠️ 画面がその形だから
  const trend = await resolveTrendMedium(division, false);
  const hpRow = trend.items[0] ?? '';

  const [counts, budgets] = await Promise.all([
    fetchCounts(options, trend.sql, spec),
    fetchAdSpend(options, trend.items, division === 'kaeru' ? hpRow : ''),
  ]);

  /** 行の並び。⚠️ **総反響 → 媒体マスタの順 → その他**（画面と同じ） */
  const order = [...trend.items, OTHER_ROW];

  const countOf = new Map<string, CountRow>();
  for (const row of counts) countOf.set(row.medium, row);

  /** 総反響。⚠️⚠️ **行の合計ではなく、全件をそのまま足す** */
  const totals: Record<string, number> = { leads: 0 };
  for (const step of spec.steps) totals[step.key] = 0;
  RANKS.forEach((_, i) => { totals[`rank${i}`] = 0; });

  for (const row of counts) {
    totals.leads += toNumber(row.leads);
    for (const step of spec.steps) totals[step.key] += toNumber(row[step.key]);
    RANKS.forEach((_, i) => { totals[`rank${i}`] += toNumber(row[`rank${i}`]); });
  }

  let totalSpend = 0;
  for (const value of budgets.values()) totalSpend += value;

  const build = (name: string, source: Record<string, number>, spend: number): AdspendRow => {
    const row: AdspendRow = { medium: name, adSpend: spend, leads: source.leads ?? 0 };

    for (const step of spec.steps) row[step.key] = source[step.key] ?? 0;
    RANKS.forEach((rank, i) => { row[rank] = source[`rank${i}`] ?? 0; });

    for (const rate of spec.rates) {
      row[rate.key] = ratePct(Number(row[rate.numerator]), Number(row[rate.denominator]));
    }

    // ⚠️⚠️ **単価はどれも「広告費 ÷ その工程の件数」。** ⚠️ 分母だけが変わる
    row.leadUnitPrice = unitPrice(spend, row.leads);
    for (const step of spec.steps) {
      row[`${step.key}UnitPrice`] = unitPrice(spend, Number(row[step.key]));
    }

    return row;
  };

  const rows: AdspendRow[] = [build(TOTAL_ROW, totals, totalSpend)];

  for (const name of order) {
    const found = countOf.get(name);
    const source: Record<string, number> = { leads: toNumber(found?.leads) };
    for (const step of spec.steps) source[step.key] = toNumber(found?.[step.key]);
    RANKS.forEach((_, i) => { source[`rank${i}`] = toNumber(found?.[`rank${i}`]); });

    rows.push(build(name, source, budgets.get(name) ?? 0));
  }

  const noBudgetItems = rows
    .filter((row) => row.medium !== TOTAL_ROW && row.adSpend === 0 && row.leads > 0)
    .map((row) => row.medium);

  /**
   * ⚠️ 媒体を指定されたときは、⚠️ **その行と総反響だけ**にする。
   *   ⚠️ ⚠️ **総反響を落とさないこと。** ⚠️ 全体に対する位置が分からなくなる。
   */
  const filtered =
    options.medium === undefined
      ? rows
      : rows.filter((row) => row.medium === TOTAL_ROW || row.medium === options.medium);

  return { rows: filtered, items: order, spec, noBudgetItems };
};

/**
 * 応答の meta。
 *
 * ⚠️⚠️ **数字だけ返して助言させない。** ⚠️ 読み方と落とし穴を必ず添える。
 */
export const adspendMeta = (
  options: AdspendOptions,
  result: AdspendResult
): Record<string, unknown> => {
  const label = DIVISION_CONFIG[options.division].label;
  const screen = options.division === 'kaeru' ? '顧客分析（建売）' : '顧客分析（注文）';

  const columns: Record<string, string> = {
    medium: '販促媒体。⚠️ 総反響はすべての顧客・すべての広告費の合計',
    adSpend: '広告費（円）。budget テーブルの実績値',
    leads: '総反響数',
    leadUnitPrice: '反響単価（広告費 ÷ 総反響）。⚠️ 広告費が0なら null',
  };
  for (const step of result.spec.steps) {
    columns[step.key] = step.label;
    columns[`${step.key}UnitPrice`] = `${step.label.replace('数', '')}単価（広告費 ÷ ${step.label}）`;
  }
  for (const rate of result.spec.rates) columns[rate.key] = rate.label;
  for (const rank of RANKS) {
    columns[rank] =
      `${rank}の件数` +
      (result.spec.rankStatus === null
        ? ''
        : `（⚠️ ステータスが「${result.spec.rankStatus}」のものだけ）`);
  }

  return {
    generatedAt: new Date().toISOString(),
    対象: `${label}。show_dashboard = 1 の顧客と、budget テーブルの販促費（section = ${BUDGET_SECTION[options.division]} / response_medium = 0）。`,
    集計基準日:
      '⚠️⚠️ 反響取得日（コホート集計）で固定。' +
      `⚠️ ダッシュボードの「${screen}」がこの基準日で作られているため。` +
      '⚠️ 実績日起算では返せない（広告費が月×店舗×媒体でしか無く、工程ごとの日付に割り付けられないため）。',
    期間: {
      from: options.from ?? (options.division === 'kaeru' ? `指定なし（${KAERU_PERIOD_START} から）` : '指定なし（最古のデータから）'),
      to: options.to ?? '指定なし（最新のデータまで）',
    },
    絞り込み: {
      販促媒体: options.medium ?? '（指定なし。全媒体）',
      店舗: options.shop ?? '（指定なし）',
      営業課: options.section ?? '（指定なし）',
      エリア: options.area ?? '（指定なし）',
    },
    行数: result.rows.length,
    列の意味: columns,
    歩留まりの定義:
      '⚠️⚠️ 分母は「ひとつ左の工程」である。総反響を分母にした通過率ではない。' +
      result.spec.rates.map((rate) => rate.label).join(' / '),
    予算適正化を助言するときに必ず踏まえること: [
      '⚠️⚠️ 最重要: 単価が安い媒体に寄せればよい、という結論を安易に出さないこと。' +
        '⚠️ 件数が少ない媒体の単価は数件の増減で大きく動く。' +
        '⚠️ leads が10件未満の行の単価は、傾向として語ってはならない。',
      '⚠️⚠️ 広告費が0円の媒体は単価が null になる。⚠️ 「無料で獲得できている」という意味ではない。' +
        '⚠️ 広告費を別の媒体に計上しているか、費用のかからない経路（紹介・看板など）である。' +
        (result.noBudgetItems.length === 0
          ? ''
          : `⚠️ 今回この状態なのは ${result.noBudgetItems.join(' / ')}。`),
      '⚠️⚠️ 総反響の広告費は、媒体ごとの行の合計と一致する。' +
        '⚠️ ただし画面（ダッシュボード）には「その他」の行が無いため、' +
        '⚠️ 画面では総反響のほうが媒体行の合計より大きく見える。',
      '⚠️⚠️ 反響日起算なので、直近の月ほど契約がまだ出ていない。' +
        '⚠️ 契約単価が高く出るのは成績の悪化ではなく、時間が経っていないためである。' +
        '⚠️ 契約単価で媒体を比べるときは、少なくとも半年以上前までの期間で見ること。',
      '⚠️ 広告費は 媒体 × 月 × 店舗 でしか持っていない。' +
        '⚠️ 担当者別・ランク別には割り振れない。そうした単価を出してはならない。',
      '⚠️ 歩留まりと単価は別の話である。' +
        '⚠️ 反響単価が高くても契約率が高ければ契約単価は安くなる。' +
        '⚠️ 減らす・増やすの判断は契約単価（と件数の規模）で行うこと。',
      '⚠️ 増額を勧めるときは、その媒体が件数を伸ばせるかを確かめようがないことを断ること。' +
        '⚠️ 単価は「いまの出稿量での単価」であり、増やしても同じ単価で伸びる保証はない。',
    ],
    データ品質の注意点: [
      '⚠️⚠️ ダッシュボードの画面と同じ判定にしてある。' +
        '⚠️ そのため /analysis/pivot の同名の指標（visits / contracts など）とは一致しない。' +
        '⚠️ pivot は日付として読める値だけを数え、契約はステータスを見ていない。',
      '⚠️ 契約の数え方が事業で違う。' +
        '⚠️ 注文はステータスが「契約済み」と「解約」の両方を契約に数える（画面と同じ）。' +
        '⚠️ 建売は「契約済み」だけで、解約を含めない。',
      '⚠️ 店舗台帳（shop_list）に載っていない店舗の顧客も総反響に含めている（画面と同じ）。' +
        '⚠️ 店舗・営業課・エリアで絞ったときだけ、店舗台帳と突き合わせている。',
      '⚠️ 販促媒体の項目名の作り方は /analysis/meta の medium 軸と同じ。' +
        '⚠️ 1人の顧客は1つの項目にしか数えない。',
      ...(options.division === 'kaeru'
        ? [
            `⚠️⚠️ 建売は開始月を指定しなくても ${KAERU_PERIOD_START} より前を数えない（画面と同じ）。`,
            '⚠️ 建売は反響のある店舗の広告費だけを見ている（画面と同じ）。' +
              '⚠️ 外すと単価が実際より高く出る。',
            '⚠️ ホームページ反響の広告費は媒体名で決め打ちしている' +
              `（${HOMEPAGE_BUDGET_MEDIUMS.join(' / ')}）。`,
          ]
        : []),
    ],
  };
};
