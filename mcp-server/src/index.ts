#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { getJson, loadConfig, postJson } from './apiClient.js';

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

/** 保存系の実行部。GETと同じく例外をツールエラーに変換する */
const send = async (path: string, payload: unknown) => {
  try {
    return asToolResult(await postJson(config, path, payload));
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
      '分析APIで指定できる集計軸・指標・比率の一覧と、データ品質の注意点を返す。' +
      '⚠️ 注文事業（order）と建売分譲事業（kaeru）の両方に対応している。' +
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
      '応答の meta に「直近月の読み方」が入っているので必ず読むこと。' +
      '\n\n「●●さんの実績を教えて」のような担当者の質問には groupBy=["staff"] を使う。' +
      '1人に絞るときは staff にその氏名を入れる。' +
      '⚠️ staff は「現在の担当者」であり、担当替えがあると過去の実績ごと移る。' +
      '\n\n⚠️ ダッシュボードの画面と数字を突き合わせるときは、firstInterview ではなく' +
      'query_analysis_pivot の visits（実来場数）/ nextAppointments（次アポ数）を使うこと。' +
      'これらは「上位の工程に進んだ人は下位も達成した」として数えており、画面と同じになる。',
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
            // ⚠️ 2026-09-22 追加。⚠️ **担当者別**（master_data.in_charge_user）
            'staff',
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
      division: z
        .enum(['order', 'kaeru'])
        .optional()
        .describe(
          '事業。order = 注文事業（既定） / kaeru = 建売分譲事業。' +
            '⚠️ 建売は工程が違う（総反響→接触→来場・案内→次アポ→事前審査→申込→契約）。' +
            '⚠️ 指標名は注文と揃えてあるが中身は切り替わる。' +
            '⚠️ 建売に「失注」は無いため lost は null になる'
        ),
      from: monthField.describe('開始月。省略すると最古のデータから'),
      to: monthField.describe('終了月。省略すると最新のデータまで'),
      section: z.string().optional().describe('営業課で絞る。例: 宮崎営業課'),
      store: z.string().optional().describe('店舗で絞る。例: KH鹿児島店'),
      brand: z.string().optional().describe('ブランドで絞る。例: KH'),
      // ⚠️ 2026-09-22 追加。⚠️ **氏名は台帳の表記どおりに**（姓名の間に空白が入る）
      staff: z.string().optional().describe('担当者で絞る。例: 中川 稜。⚠️ 姓名の間の空白も台帳どおりに'),
      excludeDuplicated: z
        .boolean()
        .optional()
        .describe('true にするとステータス「重複」の顧客を母数から外す'),
    }),
  },
  async (args) =>
    call('funnel', {
      groupBy: csv(args.groupBy),
      division: args.division,
      from: args.from,
      to: args.to,
      section: args.section,
      store: args.store,
      brand: args.brand,
      staff: args.staff,
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
      division: z
        .enum(['order', 'kaeru'])
        .optional()
        .describe(
          '事業。order = 注文事業（既定） / kaeru = 建売分譲事業。' +
            '⚠️ 建売は工程が違う（総反響→接触→来場・案内→次アポ→事前審査→申込→契約）。' +
            '⚠️ 指標名は注文と揃えてあるが中身は切り替わる。' +
            '⚠️ 建売に「失注」は無いため lost は null になる'
        ),
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
      division: args.division,
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
// 5. 競合分析（顧客1件ごと）
// ---------------------------------------------------------------------------

server.registerTool(
  'get_competitor_deals',
  {
    title: '競合との勝敗（顧客1件ごと）',
    description:
      '競合の記録がある商談を、顧客1件ごとに返す。契約（win）と失注（lost）の両方が入っており、' +
      '他社名・失注理由・面談メモ・予算帯・土地の有無が付いている。' +
      '\n\n「どの会社に負けているか」「なぜ負けたのか」「勝ちパターンは何か」' +
      'といった、集計値では答えられない質問に使う。' +
      '\n\n⚠️ 他のツールと違い、これだけは集計値ではなく生の行を返す。' +
      '行数が多いので、months を必要以上に広げないこと（既定の12ヶ月で足りることが多い）。' +
      '\n\n⚠️ 応答の meta にある「データ品質の注意点」を必ず読むこと。' +
      'とくに counts.truncated が true のときは全件ではないため、' +
      'ここから勝率を出して全社の実力値として語ってはならない。' +
      '\n\n⚠️ own_group は国分ハウジンググループ自身の社名で、競合ではない。勝敗に数えないこと。' +
      '\n\n⚠️ memo の **** は伏字（個人情報）である。中身を推測しないこと。' +
      '\n\n「●●店の▲▲さんの勝敗分析」のような質問には staff と shop で絞る。' +
      '⚠️ 担当者は「◯◯店 管理」に付け替えられた顧客も旧担当で拾うので、' +
      '失注した商談も本人の実績として出る。' +
      '⚠️ 絞ると件数が一気に減る。⚠️ 数十件で勝率を語らないこと。',
    inputSchema: z.object({
      division: z
        .enum(['order', 'kaeru'])
        .optional()
        .describe('order = 注文事業（既定） / kaeru = 建売分譲事業'),
      months: z
        .number()
        .int()
        .min(1)
        .max(36)
        .optional()
        .describe('さかのぼる月数。既定は12。24を超えると古すぎて打ち手に使えない'),
    }),
  },
  async (args) =>
    call('competitor', {
      division: args.division,
      months: args.months === undefined ? undefined : String(args.months),
    })
);

// ---------------------------------------------------------------------------
// 6. レポート（HTML）
// ---------------------------------------------------------------------------

server.registerTool(
  'get_report_spec',
  {
    title: 'レポートHTMLの書き方',
    description:
      '分析レポートを HTML で書くときの決まり（1ファイル完結・外部読み込み禁止・必ず書くこと・' +
      '書いてはいけないこと）と、保存のしかたを返す。' +
      '\n\n⚠️ 「HTMLで出力して」「レポートにまとめて」と言われたら、書き始める前に必ず1度呼ぶこと。' +
      'ここで体裁をそろえておかないと、過去の分析と読み比べられなくなる。',
    inputSchema: z.object({}),
  },
  async () => call('report/spec', {})
);

server.registerTool(
  'save_analysis_report',
  {
    title: 'レポート（HTML）を保存する',
    description:
      '書き上げた分析レポートの HTML をダッシュボードに保存する。保存すると' +
      '「他社動向 → Claudeによる競合分析」から誰でも開けるようになる。' +
      '\n\n⚠️ 呼ぶ前に get_report_spec を読むこと。体裁の決まりがある。' +
      '\n\n⚠️ 上書きではなく毎回1件増える。作り直すたびに古い版も残る。' +
      '\n\n⚠️ 利用者が「保存して」と言っていないのに勝手に保存しないこと。' +
      '全社が見る画面に出るため。',
    inputSchema: z.object({
      title: z.string().describe('一覧に出す見出し。例: 競合別 勝因・敗因分析（2026年5月期）'),
      html: z.string().describe('HTMLの全文。1ファイルで完結していること'),
      category: z.string().optional().describe("分析の種類。いまは 'competitor' のみ（既定）"),
      division: z
        .enum(['order', 'kaeru', ''])
        .optional()
        .describe("'order' = 注文事業 / 'kaeru' = 建売分譲事業 / '' = 全社"),
      period: z.string().optional().describe('分析の対象期間。例: 2025/06〜2026/05'),
      dataAsOf: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式')
        .optional()
        .describe(
          'データを取得した日。⚠️ 画面に常時表示され、読む人が最新だと誤解しないための表示に使う'
        ),
    }),
  },
  async (args) =>
    send('report', {
      title: args.title,
      html: args.html,
      category: args.category,
      division: args.division,
      period: args.period,
      dataAsOf: args.dataAsOf,
    })
);

server.registerTool(
  'list_analysis_reports',
  {
    title: '保存済みレポートの一覧',
    description:
      'ダッシュボードに保存されている分析レポートの一覧を返す（本文は含まない）。' +
      '\n\n「前回はどう分析したか」「いつのデータで作ったか」を確かめるときに使う。' +
      '本文を読みたいときは get_analysis_report を呼ぶこと。',
    inputSchema: z.object({
      category: z.string().optional().describe("種類で絞る。例: competitor"),
    }),
  },
  async (args) => call('report', { category: args.category })
);

server.registerTool(
  'get_analysis_report',
  {
    title: '保存済みレポートを1件読む',
    description:
      '保存済みの分析レポートを本文（HTML）つきで1件返す。' +
      '\n\n⚠️ 本文は60KB前後ある。前回の内容を踏まえて書き直すときだけ呼ぶこと。' +
      '一覧を見たいだけなら list_analysis_reports で足りる。',
    inputSchema: z.object({
      no: z.number().int().positive().describe('レポート番号。list_analysis_reports で確認する'),
    }),
  },
  async (args) => call(`report/${args.no}`, {})
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
