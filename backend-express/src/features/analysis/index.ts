import { z } from 'zod';
import { recordAnalysisQuery } from './audit';
import type { DimensionKey } from './dimensions';
import { DIMENSION_KEYS } from './dimensions';
import { buildCatalog, buildResponseMeta, unsyncedCaveats } from './meta';
import type { MetricKey, RateKey } from './metrics';
import { FUNNEL_METRICS, METRIC_KEYS, RATE_KEYS } from './metrics';
import type { Basis, UnsyncedDimensionKey } from './query';
import {
  MAX_ROWS,
  runPivot,
  runUnsynced,
  UNSYNCED_DIMENSION_KEYS,
  unsyncedDimensionLabel,
} from './query';
import { defineFeature } from '../../core/feature';
import { route } from '../../core/route';
import { booleanQuery, optionalText } from '../../core/schema';

/**
 * 分析API（注文事業）。
 *
 * Claude Desktop から MCP サーバー経由で呼ばれ、返ってきたJSONだけを根拠に
 * 日本語で推論される想定。そのため
 *   ・個人情報は集計値に落として一切返さない
 *   ・数字の意味とデータの癖を meta に日本語で必ず添える
 *   ・1レスポンスがコンテキストに載る大きさに収まるよう制限する
 *   ・誰がいつ何を引いたかを監査ログに残す
 * の4点をすべてのルートで守る。
 *
 * 参照テーブル: master_data / interview_sheet / call_sheet / inquiry_customer / shop_list
 */

// ---------------------------------------------------------------------------
// クエリスキーマ
// ---------------------------------------------------------------------------

/**
 * カンマ区切り、または同名パラメータの繰り返しを配列として受け取る。
 * 値は許可リスト（z.enum）で検証されるため、SQLに未知の文字列が渡ることはない。
 */
const csvEnum = <T extends string>(values: readonly [T, ...T[]], max: number) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((raw) =>
      (Array.isArray(raw) ? raw : raw.split(','))
        .map((value) => value.trim())
        .filter((value) => value !== '')
    )
    .pipe(z.array(z.enum(values)).max(max, `指定できるのは最大 ${max} 件です`));

/** 'YYYY-MM' 形式の月 */
const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'YYYY-MM 形式（例: 2026-04）で指定してください');

/** 軸を4つ以上重ねると行数が跳ね上がり、Claude のコンテキストに載らなくなる */
const MAX_GROUP_BY = 3;

/** 全ての集計軸を、そのまま等値絞り込みの条件としても受け取れるようにする */
const filterShape = Object.fromEntries(
  DIMENSION_KEYS.map((key) => [key, optionalText])
) as Record<DimensionKey, typeof optionalText>;

const extractFilters = (source: Record<string, unknown>): Record<string, string> => {
  const filters: Record<string, string> = {};
  for (const key of DIMENSION_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value !== '') filters[key] = value;
  }
  return filters;
};

const commonQuery = {
  basis: z.enum(['reaction', 'contract']).optional().transform((v) => v ?? 'reaction'),
  from: monthString.optional(),
  to: monthString.optional(),
  excludeDuplicated: booleanQuery.optional().transform((v) => v === true),
  ...filterShape,
};

const pivotQuery = z.object({
  groupBy: csvEnum(DIMENSION_KEYS as [DimensionKey, ...DimensionKey[]], MAX_GROUP_BY)
    .optional()
    .transform((v) => v ?? (['month'] as DimensionKey[])),
  metrics: csvEnum(METRIC_KEYS as [MetricKey, ...MetricKey[]], METRIC_KEYS.length)
    .optional()
    .transform((v) => v ?? FUNNEL_METRICS),
  rates: csvEnum(RATE_KEYS as [RateKey, ...RateKey[]], RATE_KEYS.length)
    .optional()
    .transform((v) => v ?? ([] as RateKey[])),
  ...commonQuery,
});

const funnelQuery = z.object({
  groupBy: csvEnum(DIMENSION_KEYS as [DimensionKey, ...DimensionKey[]], MAX_GROUP_BY)
    .optional()
    .transform((v) => v ?? (['month', 'section'] as DimensionKey[])),
  ...commonQuery,
});

const unsyncedQuery = z.object({
  groupBy: csvEnum(
    UNSYNCED_DIMENSION_KEYS as [UnsyncedDimensionKey, ...UnsyncedDimensionKey[]],
    MAX_GROUP_BY
  )
    .optional()
    .transform((v) => v ?? (['month', 'section'] as UnsyncedDimensionKey[])),
  from: monthString.optional(),
  to: monthString.optional(),
});

// ---------------------------------------------------------------------------
// ルート定義
// ---------------------------------------------------------------------------

export const analysis = defineFeature({
  name: '分析（注文事業）',
  basePath: '/analysis',
  routes: {
    'GET /meta': route({
      summary: '集計軸・指標の一覧と、データ品質の注意点を返す（Claude / MCP の導入用）',
      auth: 'analysisKey',
      handler: async ({ ctx }) => {
        recordAnalysisQuery(ctx.req, { endpoint: 'meta', durationMs: 0, status: 'ok' });
        return buildCatalog();
      },
    }),

    'GET /pivot': route({
      summary: '軸と指標を指定して顧客データを集計する（汎用）',
      auth: 'analysisKey',
      query: pivotQuery,
      handler: async ({ query: q, ctx }) => {
        const filters = extractFilters(q);
        const startedAt = Date.now();

        try {
          const { rows, basis } = await runPivot({
            groupBy: q.groupBy,
            metrics: q.metrics,
            rates: q.rates,
            basis: q.basis as Basis,
            from: q.from,
            to: q.to,
            filters,
            excludeDuplicated: q.excludeDuplicated,
          });

          recordAnalysisQuery(ctx.req, {
            endpoint: 'pivot',
            groupBy: q.groupBy,
            metrics: q.metrics,
            basis: q.basis,
            from: q.from,
            to: q.to,
            filters,
            rowCount: rows.length,
            durationMs: Date.now() - startedAt,
            status: 'ok',
          });

          return {
            meta: buildResponseMeta({
              groupBy: q.groupBy,
              metrics: q.metrics,
              rates: q.rates,
              basis,
              from: q.from,
              to: q.to,
              filters,
              excludeDuplicated: q.excludeDuplicated,
              rowCount: rows.length,
            }),
            rows,
          };
        } catch (error) {
          recordAnalysisQuery(ctx.req, {
            endpoint: 'pivot',
            groupBy: q.groupBy,
            metrics: q.metrics,
            basis: q.basis,
            from: q.from,
            to: q.to,
            filters,
            durationMs: Date.now() - startedAt,
            status: 'bad_request',
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
    }),

    'GET /funnel': route({
      summary:
        '反響→通電→初回面談→第二面談→事前審査→契約 のファネルと転換率を返す（既定は 月 × 営業課）',
      auth: 'analysisKey',
      query: funnelQuery,
      handler: async ({ query: q, ctx }) => {
        const filters = extractFilters(q);
        const startedAt = Date.now();

        const { rows, basis } = await runPivot({
          groupBy: q.groupBy,
          metrics: FUNNEL_METRICS,
          rates: RATE_KEYS,
          basis: q.basis as Basis,
          from: q.from,
          to: q.to,
          filters,
          excludeDuplicated: q.excludeDuplicated,
        });

        recordAnalysisQuery(ctx.req, {
          endpoint: 'funnel',
          groupBy: q.groupBy,
          metrics: FUNNEL_METRICS,
          basis: q.basis,
          from: q.from,
          to: q.to,
          filters,
          rowCount: rows.length,
          durationMs: Date.now() - startedAt,
          status: 'ok',
        });

        const meta = buildResponseMeta({
          groupBy: q.groupBy,
          metrics: FUNNEL_METRICS,
          rates: RATE_KEYS,
          basis,
          from: q.from,
          to: q.to,
          filters,
          excludeDuplicated: q.excludeDuplicated,
          rowCount: rows.length,
        });

        // 直近の月は「まだ結果が出ていない」だけで、成績が悪いわけではない。
        // これを書いておかないと、直近月の転換率の低下を実態のある悪化として読まれる。
        const now = new Date();
        const ym = (offsetMonths: number): string => {
          const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };
        meta['直近月の読み方'] =
          `契約までは平均で2ヶ月前後かかる。basis = reaction の場合、直近3ヶ月（${ym(-2)} 以降）の` +
          `コホートは面談・契約の数がまだ出揃っていないため、転換率が低く見える。` +
          `当月（${ym(0)}）は反響数そのものもまだ増える。`;

        return { meta, rows };
      },
    }),

    'GET /unsynced': route({
      summary:
        '顧客台帳に未同期の反響（inquiry_customer.sync = 0）を集計する。追客漏れの可能性を測る指標',
      auth: 'analysisKey',
      query: unsyncedQuery,
      handler: async ({ query: q, ctx }) => {
        const startedAt = Date.now();
        const rows = await runUnsynced({ groupBy: q.groupBy, from: q.from, to: q.to });

        recordAnalysisQuery(ctx.req, {
          endpoint: 'unsynced',
          groupBy: q.groupBy,
          from: q.from,
          to: q.to,
          rowCount: rows.length,
          durationMs: Date.now() - startedAt,
          status: 'ok',
        });

        return {
          meta: {
            generatedAt: new Date().toISOString(),
            対象: '注文事業の店舗に紐づく反響（inquiry_customer）。report_flag = 1 の店舗のみ。',
            集計基準日: '反響日（inquiry_customer.inquiry_date）',
            期間: {
              from: q.from ?? '指定なし（最古のデータから）',
              to: q.to ?? '指定なし（最新のデータまで）',
            },
            集計軸: q.groupBy.map((key) => `${key} = ${unsyncedDimensionLabel(key)}`),
            指標の意味: {
              inquiries: '反響の総件数（同期済み + 未同期）',
              unsynced: '顧客台帳に未同期の件数（sync = 0）。追客されていない可能性がある',
              synced: '顧客台帳に同期済みの件数（sync = 1）',
              unsyncedRatePct: '未同期率（unsynced ÷ inquiries）。単位はパーセント',
            },
            行数: rows.length,
            制約: `1レスポンスの最大行数は ${MAX_ROWS} 行`,
            データ品質の注意点: unsyncedCaveats(),
          },
          rows,
        };
      },
    }),
  },
});
