#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { getJson, loadConfig } from './apiClient.js';

/**
 * 注文事業のKPI・歩留まりを Claude Desktop から問い合わせるための MCP サーバー。
 *
 * ─────────────────────────────────────────────
 * 構成
 *   Claude Desktop ─(stdio)→ このプロセス ─(HTTPS)→ VPS の分析API ─→ 本番DB
 *
 *   マネージャーのPC上で動く「ローカルMCP」にしてある。
 *   リモートMCP（Claude Desktop のカスタムコネクタ）にすると OAuth 認可サーバーの
 *   構築が必須になるため、APIキーを環境変数で渡せる stdio を選んだ。
 * ─────────────────────────────────────────────
 *
 * ⚠️ ツールの description は Claude が読む唯一の説明である。
 *   「どういう日本語の質問のときに使うか」「何を返すか」「使ってはいけない場面」を
 *   ここに書いておかないと、Claude は軸を取り違えたり、意味のない集計を要求したりする。
 *   実装の都合ではなく、利用者の言葉で書くこと。
 */

const config = loadConfig();
const server = new McpServer({ name: 'khg-analysis', version: '0.1.0' });

/** APIの応答をそのまま Claude に渡す。meta に日本語の注意書きが入っている */
const asToolResult = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
});

/** 失敗はエラー内容を本文に載せて返す。Claude が理由を読んで直せるようにする */
const asToolError = (error: unknown) => ({
  isError: true,
  content: [
    {
      type: 'text' as const,
      text: error instanceof Error ? error.message : String(error),
    },
  ],
});

/** 全ツール共通の実行部。例外を必ずツールエラーに変換する */
const call = async (path: string, params: Record<string, string | undefined>) => {
  try {
    return asToolResult(await getJson(config, path, params));
  } catch (error) {
    return asToolError(error);
  }
};

/** 配列で受け取った軸・指標をAPIのクエリ形式（カンマ区切り）に直す */
const csv = (values: string[] | undefined): string | undefined =>
  values === undefined || values.length === 0 ? undefined : values.join(',');

const monthField = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'YYYY-MM 形式（例: 2026-04）')
  .optional();

// ---------------------------------------------------------------------------
// 1. カタログ
// ---------------------------------------------------------------------------

server.registerTool(
  'list_analysis_dimensions',
  {
    title: '分析APIで使える軸と指標の一覧',
    description:
      '注文事業の分析APIで指定できる集計軸・指標・比率の一覧と、データ品質の注意点を返す。' +
      '\n\n他のツールを使う前に必ず1度呼ぶこと。軸や指標の正確な名前がわからないまま' +
      'query_analysis_pivot を呼ぶと、存在しない名前を指定してエラーになる。' +
      '\n\nこの応答には「フェーズの到達件数は単調減少しない」など、数字を読み違えないための' +
      '重要な前提が含まれている。分析結果を述べる前に必ず目を通すこと。',
    inputSchema: z.object({}),
  },
  async () => call('meta', {})
);

// ---------------------------------------------------------------------------
// 2. ファネル
// ---------------------------------------------------------------------------

server.registerTool(
  'get_funnel',
  {
    title: 'ファネルと転換率',
    description:
      '反響→通電→初回面談→第二面談→事前審査→契約 の件数と、反響数を分母にした転換率を返す。' +
      '\n\n「歩留まりを見たい」「契約率はどうなっている」「どの店舗の成績が良いか」' +
      'といった質問に最初に使うツール。パラメータなしで呼ぶと月×営業課の全期間になる。' +
      '\n\n⚠️ 転換率の分母はすべて反響数。前のフェーズを分母にした段階別の転換率' +
      '（通電→初回面談など）を自分で計算してはならない。フェーズごとに入力率が' +
      '大きく違うため、意味のない数字になる。' +
      '\n\n⚠️ 直近3ヶ月は面談・契約がまだ出揃っておらず転換率が低く見える。' +
      '応答の meta に「直近月の読み方」が入っているので必ず読むこと。',
    inputSchema: z.object({
      groupBy: z
        .array(
          z.enum([
            'month',
            'quarter',
            'year',
            'store',
            'brand',
            'section',
            'area',
            'medium',
            'rank',
            'status',
            'lostReason',
            'competitorLostReason',
            'responseMedium',
          ])
        )
        .max(3)
        .optional()
        .describe('集計軸。最大3つ。省略すると month と section。例: ["month","store"]'),
      from: monthField.describe('開始月。省略すると最古のデータから'),
      to: monthField.describe('終了月。省略すると最新のデータまで'),
      section: z.string().optional().describe('営業課で絞る。例: 宮崎営業課'),
      store: z.string().optional().describe('店舗で絞る。例: KH鹿児島店'),
      brand: z.string().optional().describe('ブランドで絞る。例: KH'),
      excludeDuplicated: z
        .boolean()
        .optional()
        .describe('true にするとステータス「重複」の顧客を母数から外す'),
    }),
  },
  async (args) =>
    call('funnel', {
      groupBy: csv(args.groupBy),
      from: args.from,
      to: args.to,
      section: args.section,
      store: args.store,
      brand: args.brand,
      excludeDuplicated: args.excludeDuplicated === true ? 'true' : undefined,
    })
);

// ---------------------------------------------------------------------------
// 3. 汎用集計
// ---------------------------------------------------------------------------

server.registerTool(
  'query_analysis_pivot',
  {
    title: '軸と指標を指定した集計',
    description:
      '集計軸と指標を自由に指定して集計する。get_funnel で足りないときに使う。' +
      '\n\n例: 「媒体別のリードタイム」なら groupBy=["medium"]、' +
      'metrics=["leads","contracts","medianDaysToContract"]。' +
      '\n\n指定できる軸と指標の正確な名前は list_analysis_dimensions で確認すること。' +
      '\n\n⚠️ basis="contract" にすると契約日が入っている顧客だけが母数になり、' +
      'leads と contracts が必ず同じ値・契約率が常に100%になる。' +
      '転換率を見たいときは basis を指定しない（既定の reaction）こと。' +
      'basis="contract" は「その月に何件契約したか」の内訳を見るためのもの。',
    inputSchema: z.object({
      groupBy: z
        .array(z.string())
        .max(3)
        .optional()
        .describe('集計軸。最大3つ。list_analysis_dimensions の「集計軸」から選ぶ'),
      metrics: z
        .array(z.string())
        .optional()
        .describe('指標。list_analysis_dimensions の「指標」から選ぶ'),
      rates: z
        .array(z.string())
        .optional()
        .describe('比率。list_analysis_dimensions の「比率」から選ぶ'),
      basis: z
        .enum(['reaction', 'contract'])
        .optional()
        .describe('集計基準日。既定は reaction（反響取得日）'),
      from: monthField.describe('開始月'),
      to: monthField.describe('終了月'),
      section: z.string().optional().describe('営業課で絞る'),
      store: z.string().optional().describe('店舗で絞る'),
      brand: z.string().optional().describe('ブランドで絞る'),
      medium: z.string().optional().describe('販促媒体で絞る'),
      rank: z.string().optional().describe('顧客ランクで絞る。例: Aランク'),
      status: z.string().optional().describe('ステータスで絞る。例: 契約済み'),
      excludeDuplicated: z.boolean().optional().describe('ステータス「重複」を母数から外す'),
    }),
  },
  async (args) =>
    call('pivot', {
      groupBy: csv(args.groupBy),
      metrics: csv(args.metrics),
      rates: csv(args.rates),
      basis: args.basis,
      from: args.from,
      to: args.to,
      section: args.section,
      store: args.store,
      brand: args.brand,
      medium: args.medium,
      rank: args.rank,
      status: args.status,
      excludeDuplicated: args.excludeDuplicated === true ? 'true' : undefined,
    })
);

// ---------------------------------------------------------------------------
// 4. 未同期リード
// ---------------------------------------------------------------------------

server.registerTool(
  'get_unsynced_inquiries',
  {
    title: '追客漏れの可能性がある反響',
    description:
      '反響台帳に来たが顧客台帳に取り込まれていない反響（未同期リード）の件数と比率を返す。' +
      '\n\n「取りこぼしはないか」「追客漏れを知りたい」といった質問に使う。' +
      '\n\n⚠️ ここで数える反響は get_funnel / query_analysis_pivot の母数には' +
      '一切含まれていない。両者の件数を足し合わせてはならない（二重計上になる）。' +
      '\n\n⚠️ 未同期であること自体が必ず問題とは限らない。重複反響や明らかな冷やかしも' +
      '含まれるため、店舗間・媒体間の差を見る指標として扱うこと。',
    inputSchema: z.object({
      groupBy: z
        .array(z.enum(['month', 'store', 'brand', 'section', 'area', 'responseMedium']))
        .max(3)
        .optional()
        .describe('集計軸。最大3つ。省略すると month と section'),
      from: monthField.describe('開始月'),
      to: monthField.describe('終了月'),
    }),
  },
  async (args) =>
    call('unsynced', {
      groupBy: csv(args.groupBy),
      from: args.from,
      to: args.to,
    })
);

// ---------------------------------------------------------------------------
// 起動
// ---------------------------------------------------------------------------

const main = async (): Promise<void> => {
  // ⚠️ stdout は MCP のプロトコルが流れる経路なので、絶対に console.log しないこと。
  //   1行でも混ざるとJSON-RPCのパースが壊れ、Claude Desktop から
  //   「サーバーが応答しない」ように見える。ログは stderr に出す。
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[khg-analysis] 起動しました。接続先: ${config.baseUrl}`);
};

main().catch((error: unknown) => {
  console.error('[khg-analysis] 起動に失敗しました:', error);
  process.exit(1);
});
