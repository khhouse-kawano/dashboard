import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { adspendMeta, runAdspend } from '../analysis/adspend';
import { runCompetitor } from '../analysis/competitor';
import type { DimensionKey } from '../analysis/dimensions';
import { DIMENSION_KEYS } from '../analysis/dimensions';
import { buildCatalog, buildResponseMeta } from '../analysis/meta';
import type { MetricKey, RateKey } from '../analysis/metrics';
import { FUNNEL_METRICS, METRIC_KEYS, RATE_KEYS } from '../analysis/metrics';
import { runPivot } from '../analysis/query';
import type { JobScope } from './job';

/**
 * 「Claudeによる分析」で Claude に渡す道具。
 *
 * ⚠️⚠️ **数字は必ずここから取らせる。** Claude に自分で歩留まりを計算させると、
 *   ダッシュボードの画面と食い違う。中身は MCP 用の分析API（features/analysis）と同じ関数で、
 *   画面と同じ定義で集計される。
 *
 *   実績日起算（部署・店舗の KPI） … get_kpi_actual  → runPivot(basis = 'actual')
 *   反響日起算（広告費の KPI）     … get_ad_spend    → runAdspend（顧客分析の画面と同じ）
 *
 * ⚠️ runPivot の basis = 'reaction' は画面と数え方が違う（契約のステータスを見ない）ため、道具にしていない。
 * ⚠️ 事業部は分析の条件で固定し、Claude には選ばせない。
 */

/** 1回の結果の上限。超えたら絞り込みを頼む（⚠️ 黙って切ると、欠けた数字で結論を出される） */
const MAX_RESULT_CHARS = 150_000;

const monthString = z.string().regex(/^\d{4}-\d{2}$/);

const kpiActualInput = z.object({
  groupBy: z.array(z.enum(DIMENSION_KEYS as [DimensionKey, ...DimensionKey[]])).min(1).max(3),
  metrics: z.array(z.enum(METRIC_KEYS as [MetricKey, ...MetricKey[]])).optional(),
  rates: z.array(z.enum(RATE_KEYS as [RateKey, ...RateKey[]])).optional(),
  from: monthString.optional(),
  to: monthString.optional(),
  filters: z
    .object({
      store: z.string().optional(),
      section: z.string().optional(),
      brand: z.string().optional(),
      staff: z.string().optional(),
      medium: z.string().optional(),
      area: z.string().optional(),
      rank: z.string().optional(),
    })
    .optional(),
  wholeDivision: z.boolean().optional(),
  excludeDuplicated: z.boolean().optional(),
});

const adSpendInput = z.object({
  from: monthString.optional(),
  to: monthString.optional(),
  medium: z.string().optional(),
  shop: z.string().optional(),
  section: z.string().optional(),
  area: z.string().optional(),
  wholeDivision: z.boolean().optional(),
});

const competitorInput = z.object({
  months: z.number().int().min(1).max(24).optional(),
  shop: z.string().optional(),
  staff: z.string().optional(),
  wholeDivision: z.boolean().optional(),
});

export const reportInput = z.object({
  title: z.string().min(1).max(255),
  summary: z.string().min(1).max(2000),
  html: z.string().min(200),
});
export type ReportInput = z.infer<typeof reportInput>;

export const SUBMIT_TOOL = 'submit_report';

const WHOLE_DIVISION_DESC =
  'true にすると、分析条件の課・店舗の絞り込みを外して事業部全体を集計する。' +
  '比較の基準（事業部平均など）が欲しいときだけ使う。省略時は分析条件の範囲だけを集計する。';

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_catalog',
    description:
      '集計軸・指標・比率の一覧と、データ品質の注意点を返す。最初に1回呼んで、使える指標と落とし穴を確認すること。',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_kpi_actual',
    description:
      '【実績日起算】部署・店舗・担当者の KPI（反響・来場・次アポ・事前審査・契約など）と歩留まりを、' +
      'ダッシュボードの「店舗・担当別反響」「全社報告用フォーマット」と同じ定義で集計する。' +
      '各工程はその出来事が起きた月で数える。来場は visits、次アポは nextAppointments を使うこと' +
      '（firstInterview / secondInterview は画面の数字と一致しないので来場数・次アポ数として使わない）。' +
      '比率は rates で指定する（契約率・次アポ率の分母は来場。画面と同じ）。',
    input_schema: {
      type: 'object',
      properties: {
        groupBy: {
          type: 'array',
          items: { type: 'string', enum: DIMENSION_KEYS },
          description: '集計軸（最大3つ）。例: ["month"]、["store"]、["month","medium"]、["staff"]',
        },
        metrics: {
          type: 'array',
          items: { type: 'string', enum: METRIC_KEYS },
          description: `指標。省略時は ${FUNNEL_METRICS.join(', ')}`,
        },
        rates: {
          type: 'array',
          items: { type: 'string', enum: RATE_KEYS },
          description: '比率。例: ["visitRatePct","nextAppointmentRatePct","contractRatePct"]',
        },
        from: { type: 'string', description: 'YYYY-MM。省略時は分析条件の開始月' },
        to: { type: 'string', description: 'YYYY-MM。省略時は分析条件の終了月' },
        filters: {
          type: 'object',
          description: '追加の絞り込み（等値）。値は台帳の表記どおり',
          properties: {
            store: { type: 'string' },
            section: { type: 'string' },
            brand: { type: 'string' },
            staff: { type: 'string' },
            medium: { type: 'string' },
            area: { type: 'string' },
            rank: { type: 'string' },
          },
          additionalProperties: false,
        },
        wholeDivision: { type: 'boolean', description: WHOLE_DIVISION_DESC },
        excludeDuplicated: { type: 'boolean', description: 'ステータス「重複」の顧客を除く' },
      },
      required: ['groupBy'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_ad_spend',
    description:
      '【反響日起算】販促媒体ごとの広告費と、反響・来場・次アポ・契約の件数・歩留まり・単価（反響単価・来場単価・契約単価など）を、' +
      'ダッシュボードの「販促媒体別広告費」と同じ定義で返す。その期間に反響が入った顧客が、その後どこまで進んだかを数える。' +
      '広告費・獲得単価・媒体ごとの費用対効果を語るときは必ずこれを使うこと。',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM。省略時は分析条件の開始月' },
        to: { type: 'string', description: 'YYYY-MM。省略時は分析条件の終了月' },
        medium: { type: 'string', description: '販促媒体名で絞る（総反響の行は常に返る）' },
        shop: { type: 'string', description: '店舗で絞る' },
        section: { type: 'string', description: '課で絞る' },
        area: { type: 'string', description: 'エリアで絞る' },
        wholeDivision: { type: 'boolean', description: WHOLE_DIVISION_DESC },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_competitor_deals',
    description:
      '競合との勝敗を分析するための、商談1件ごとのデータ（契約 / 失注、競合名、失注理由、面談メモ）を返す。' +
      '個人情報は伏字。件数が多いので、競合・失注の分析が必要なときだけ使うこと。',
    input_schema: {
      type: 'object',
      properties: {
        months: { type: 'integer', description: '何ヶ月さかのぼるか（1〜24。既定12）' },
        shop: { type: 'string', description: '店舗で絞る' },
        staff: { type: 'string', description: '担当者で絞る（台帳の表記どおり）' },
        wholeDivision: { type: 'boolean', description: WHOLE_DIVISION_DESC },
      },
      additionalProperties: false,
    },
  },
  {
    name: SUBMIT_TOOL,
    description:
      '分析を終えたら、レポートを1回だけ提出する。提出すると分析は終わる。' +
      'html は 1 ファイルで完結した HTML（<meta charset="utf-8"> を含む。外部ファイル・外部スクリプト・画像の読み込みは不可）。',
    // ⚠️ HTML は長いので、生成と並行して受け取る（受け取ったあと reportInput で必ず検証する）
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '一覧に出す見出し（40字程度まで）' },
        summary: { type: 'string', description: '結論の要約（1〜3文）' },
        html: { type: 'string', description: 'レポートの HTML 全文' },
      },
      required: ['title', 'summary', 'html'],
      additionalProperties: false,
    },
  },
];

/** 画面に出す途中経過の文言 */
export const progressLabel = (name: string): string => {
  switch (name) {
    case 'get_catalog':
      return '使える指標と注意点を確認しています';
    case 'get_kpi_actual':
      return '実績（実績日起算）を集計しています';
    case 'get_ad_spend':
      return '広告費と単価（反響日起算）を集計しています';
    case 'get_competitor_deals':
      return '競合との商談を読み込んでいます';
    case SUBMIT_TOOL:
      return 'レポートを仕上げています';
    default:
      return 'データを確認しています';
  }
};

const toResult = (value: unknown): string => {
  const text = JSON.stringify(value);
  if (text.length > MAX_RESULT_CHARS) {
    throw new Error(
      `結果が大きすぎます（${text.length.toLocaleString()} 文字）。集計軸を減らすか、期間・店舗で絞って呼び直してください。`
    );
  }
  return text;
};

const blank = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value.trim();

/**
 * 道具を実行して、Claude に返す文字列を作る。
 *
 * ⚠️ 入力は Claude が書いたもの。必ず zod で検証してから使う（eager_input_streaming では API 側が検証しない）。
 * ⚠️ 失敗は例外で返す。呼び出し側が is_error の tool_result にする。
 */
export const executeTool = async (name: string, input: unknown, scope: JobScope): Promise<string> => {
  switch (name) {
    case 'get_catalog':
      return toResult(buildCatalog());

    case 'get_kpi_actual': {
      const q = kpiActualInput.parse(input);
      const filters: Partial<Record<DimensionKey, string>> = {};
      for (const [key, value] of Object.entries(q.filters ?? {})) {
        const v = blank(value);
        if (v !== undefined) filters[key as DimensionKey] = v;
      }
      if (q.wholeDivision !== true) {
        if (scope.section !== '' && filters.section === undefined) filters.section = scope.section;
        if (scope.shop !== '' && filters.store === undefined) filters.store = scope.shop;
      }
      const metrics = q.metrics ?? FUNNEL_METRICS;
      const rates = q.rates ?? [];
      const from = q.from ?? scope.from;
      const to = q.to ?? scope.to;

      const { rows, basis, actual, mediumNote } = await runPivot({
        groupBy: q.groupBy,
        metrics,
        rates,
        basis: 'actual',
        from,
        to,
        filters,
        excludeDuplicated: q.excludeDuplicated === true,
        division: scope.division,
      });
      const meta = buildResponseMeta({
        groupBy: q.groupBy,
        metrics,
        rates,
        basis,
        from,
        to,
        filters,
        excludeDuplicated: q.excludeDuplicated === true,
        rowCount: rows.length,
        division: scope.division,
        actual,
        mediumNote,
      });
      return toResult({ meta, rows });
    }

    case 'get_ad_spend': {
      const q = adSpendInput.parse(input);
      const whole = q.wholeDivision === true;
      const options = {
        division: scope.division,
        from: q.from ?? scope.from,
        to: q.to ?? scope.to,
        medium: blank(q.medium),
        shop: blank(q.shop) ?? (whole || scope.shop === '' ? undefined : scope.shop),
        section: blank(q.section) ?? (whole || scope.section === '' ? undefined : scope.section),
        area: blank(q.area),
      };
      const result = await runAdspend(options);
      return toResult({ meta: adspendMeta(options, result), rows: result.rows });
    }

    case 'get_competitor_deals': {
      const q = competitorInput.parse(input);
      const whole = q.wholeDivision === true;
      const result = await runCompetitor({
        division: scope.division,
        months: q.months ?? 12,
        shop: blank(q.shop) ?? (whole || scope.shop === '' ? undefined : scope.shop),
        staff: blank(q.staff),
      });
      return toResult({
        meta: {
          対象: result.division,
          期間: `直近 ${result.months} ヶ月`,
          件数: result.counts,
          注意:
            'outcome: win = 契約（解約を含む）/ lost = 失注。counts.truncated が true のときは全件ではない。' +
            'memo の **** は伏字なので中身を推測しないこと。own_group はグループ内の取り合いで、競合の勝敗に数えないこと。',
        },
        columns: result.columns,
        rows: result.rows,
      });
    }

    default:
      throw new Error(`知らない道具です: ${name}`);
  }
};
