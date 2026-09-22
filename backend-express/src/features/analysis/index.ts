import { z } from 'zod';
import { recordAnalysisQuery } from './audit';
import type { CompetitorDivision } from './competitor';
import { runCompetitor } from './competitor';
import { getReport, listReports, MAX_HTML_BYTES, reportSpec, saveReport } from './report';
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

/**
 * 競合分析のデータ。
 *
 * ⚠️ `months` は ⚠️ **そのまま渡す行数に効く**（＝Claude 側の読み込み量に効く）。
 *   ⚠️ 既定は12ヶ月。⚠️ 24を超えると古すぎて打ち手に使えない。
 */
const competitorQuery = z.object({
  division: z
    .enum(['order', 'kaeru'])
    .optional()
    .transform((v) => v ?? 'order'),
  months: z.coerce.number().int().min(1).max(36).optional().transform((v) => v ?? 12),
});

/** レポートの保存。⚠️ html だけは長さの上限を別に見る */
const reportBody = z.object({
  title: z.string().min(1, 'title は必須です').max(255),
  category: z.string().max(64).optional().transform((v) => v ?? 'competitor'),
  division: z.string().max(32).optional().transform((v) => v ?? ''),
  period: z.string().max(64).optional().transform((v) => v ?? ''),
  dataAsOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dataAsOf は YYYY-MM-DD 形式で指定してください')
    .optional(),
  html: z.string().min(1, 'html は必須です'),
});

const reportListQuery = z.object({
  category: z.string().max(64).optional(),
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

    'GET /competitor': route({
      summary:
        '競合との勝敗を分析するための、顧客1件ごとのデータを返す。' +
        '個人情報は伏字。集計値ではないのはこのエンドポイントだけ',
      auth: 'analysisKey',
      query: competitorQuery,
      handler: async ({ query: q, ctx }) => {
        const startedAt = Date.now();
        const result = await runCompetitor({
          division: q.division as CompetitorDivision,
          months: q.months,
        });

        recordAnalysisQuery(ctx.req, {
          endpoint: 'competitor',
          filters: { division: q.division },
          rowCount: result.rows.length,
          durationMs: Date.now() - startedAt,
          status: 'ok',
        });

        return {
          meta: {
            generatedAt: new Date().toISOString(),
            対象: `${result.division}。show_dashboard = 1 の顧客のうち、競合の記録があるものだけ。`,
            期間: `直近 ${result.months} ヶ月`,
            件数: result.counts,
            列の意味: {
              outcome: 'win = 契約（解約を含む） / lost = 失注。決着していない案件と重複は含まない',
              status: '台帳のステータスそのもの',
              month: '契約月（win）または失注月（lost）。失注日が無ければ反響月',
              competitors: '競合欄と面談シートの両方から拾った他社名。複数は | 区切り',
              own_group:
                '国分ハウジンググループ自身の社名。' +
                '⚠️ 競合ではなくグループ内での取り合いを表す。競合の勝敗に数えないこと',
              lost_reason: '選択式の失注理由。⚠️ 空欄が多い',
              memo:
                '面談シート（面談ごとに担当者が書いた記録）。「日付 アクション: 内容」を / でつないだもの。' +
                '⚠️ 他社名が出てくる面談を優先して入れてあり、全部の面談が入っているわけではない',
              has_land: '顧客が土地を持っているか',
              budget: '予算の帯。⚠️ 金額そのものは返していない',
            },
            データ品質の注意点: [
              '⚠️ 最重要: counts.truncated = true のとき、返しているのは全件ではない。' +
                '契約・失注それぞれ最大 ' +
                `${result.counts.quotaPerSide} 件までを新しい順に返している。` +
                '⚠️ wins と losses から勝率を計算し、全社の実力値として語ってはならない。',
              '⚠️ lost_reason が空の行が多いのは入力されていないためで、理由が無いという意味ではない。' +
                '記録率そのものを課題として扱うこと。',
              '⚠️ competitors は自由記述から拾っているため、表記ゆれがある' +
                '（例:「タマホーム」と「タマホーム_大安心の家」）。数えるときは寄せること。',
              '⚠️ counts.foundFromMemo は、競合欄が空で面談シートからのみ他社名が見つかった件数。' +
                '競合欄の記録率が低いことを示す。',
              '⚠️ 建売分譲事業には「失注」というステータスが無いため「追客終了」を負けとして扱っている。' +
                'これは他社に負けたとは限らず、予算・時期の都合も含む。',
              '⚠️ 個人情報（氏名・電話・メール・住所・物件名）は含めていない。' +
                'memo の中の **** は伏字である。⚠️ 中身を推測しないこと。',
            ],
            HTMLで出力したい場合: 'GET /analysis/report/spec に書き方の指示がある。',
          },
          columns: result.columns,
          rows: result.rows,
        };
      },
    }),

    'GET /report/spec': route({
      summary: '分析レポート（HTML）の書き方と、保存のしかたを返す',
      auth: 'analysisKey',
      handler: async ({ ctx }) => {
        recordAnalysisQuery(ctx.req, { endpoint: 'report/spec', durationMs: 0, status: 'ok' });
        return reportSpec();
      },
    }),

    'GET /report': route({
      summary: '保存済みの分析レポートの一覧（本文は含まない）',
      auth: 'analysisKey',
      query: reportListQuery,
      handler: async ({ query: q, ctx }) => {
        const startedAt = Date.now();
        const rows = await listReports(q.category);

        recordAnalysisQuery(ctx.req, {
          endpoint: 'report/list',
          rowCount: rows.length,
          durationMs: Date.now() - startedAt,
          status: 'ok',
        });

        return { rows };
      },
    }),

    'POST /report': route({
      summary: '書き上げた分析レポート（HTML）を保存する。ダッシュボードの画面に出る',
      auth: 'analysisKey',
      body: reportBody,
      handler: async ({ body, ctx }) => {
        const startedAt = Date.now();

        /**
         * ⚠️⚠️ **中身は検査しない。** ⚠️ 画面側で iframe に閉じ込める。
         *   ⚠️ 検査ですり抜けを防ぐ設計にしないこと（必ず抜け道が残る）。
         * ⚠️ 大きさだけは見る。⚠️ **DB と画面の両方が詰まるため。**
         */
        if (Buffer.byteLength(body.html, 'utf8') > MAX_HTML_BYTES) {
          recordAnalysisQuery(ctx.req, {
            endpoint: 'report/save',
            durationMs: Date.now() - startedAt,
            status: 'bad_request',
            errorMessage: 'html too large',
          });
          throw new Error(
            `HTML が大きすぎます（上限 ${Math.floor(MAX_HTML_BYTES / 1024)}KB）。` +
              '画像を埋め込んでいる場合は外してください。'
          );
        }

        const no = await saveReport({
          title: body.title,
          category: body.category,
          division: body.division,
          period: body.period,
          html: body.html,
          // ⚠️ MCP から入った分は誰が実行したか分からない。⚠️ **画面と区別が付くようにする**
          staff: 'MCP',
          dataAsOf: body.dataAsOf,
        });

        recordAnalysisQuery(ctx.req, {
          endpoint: 'report/save',
          rowCount: 1,
          durationMs: Date.now() - startedAt,
          status: 'ok',
        });

        return {
          no,
          message: '保存しました。ダッシュボードの 他社動向 → Claudeによる競合分析 から開けます。',
        };
      },
    }),

    'GET /report/:no': route({
      summary: '保存済みの分析レポートを1件、本文つきで返す',
      auth: 'analysisKey',
      params: z.object({ no: z.coerce.number().int().positive() }),
      handler: async ({ params, ctx }) => {
        const startedAt = Date.now();
        const row = await getReport(params.no);

        recordAnalysisQuery(ctx.req, {
          endpoint: 'report/get',
          rowCount: row === null ? 0 : 1,
          durationMs: Date.now() - startedAt,
          status: row === null ? 'bad_request' : 'ok',
        });

        if (row === null) {
          throw new Error(`レポート ${params.no} は見つかりませんでした。`);
        }

        return row;
      },
    }),

    'GET /unsynced': route({
      summary:
        '反響を「同期不要」「未同期」「同期済み」に分けて集計する。' +
        '重複・業者・ブラックリストは同期不要として別枠にし、未同期（追客漏れの可能性）には数えない',
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
              inquiries: '反響の総件数。noSyncNeeded + unsynced + synced に一致する',
              noSyncNeeded:
                '「同期不要」と判断された件数（重複クリック / 業者 / ブラックリスト）。' +
                '担当者が意図的に顧客台帳へ取り込まなかったもので、追客漏れではない',
              syncTarget: '同期すべき件数（inquiries − noSyncNeeded）。以降の分母はこれ',
              unsynced:
                '同期すべきなのに未同期の件数（sync = 0）。これだけが「追客漏れの可能性」を示す',
              synced: '同期すべきもののうち同期済みの件数（sync = 1）',
              unsyncedRatePct:
                '未同期率（unsynced ÷ syncTarget）。単位はパーセント。分母は inquiries ではない',
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
