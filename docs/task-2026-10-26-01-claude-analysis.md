# 作業記録 2026-10-26-01　v2.2.217 Claudeによる分析（Dashboard からの自由分析）・権限「マネージャー」

## 指示（ReadMeClaude.md）
- ClaudeAnalysis.tsx で使う API キーを、Claude Console で新しく発行したものに変える手順
- 決められた内容ではなく、自由に分析結果を得られるようにする
  - プロンプトの入力欄、事業部・店舗・期間を選ぶ欄、結果を HTML で表示する欄
  - 自動で HTML を書き出す。広告費の KPI の歩留まりは反響日起算、部署・店舗の KPI の歩留まりは実績日起算。Dashboard と矛盾させない
  - 曖昧な指示でも初回から深掘りする。必ず次の打ち手を提案する
  - 検証にはかなり時間がかかることを明記する
- 新しい権限 **Manager** を追加し、Master・BrandAdmin・Manager が使えるようにする
- 競合分析と Dashboard からの分析を分ける。「（Claudeのアイコン）による競合分析」の表記を消す
- Dashboard からの分析の UI を競合分析に合わせる（左にカード、右に結果）

## 決めたこと（2026-10-26 の回答。すべて推奨どおり）
1. 定型メニュー（反響推移・店舗別・媒体別）は消し、保存済みの結果は「過去の定型分析」として左のカードで読めるようにする
2. 表示名: BrandAdmin を「ブランド管理者」、新しい Manager を「マネージャー」
3. 分析の結果は、3つの権限の人なら全員分を見られる（チームで共有）
4. 1人1日5回まで
5. 中古リノベ・不動産企画係は対象外（② の分析の仕組みが注文・建売のみ）

## 作り
- 分析は **②（VPS）** で動かす。① の PHP は1回 120 秒で切れるため、数分〜十数分かかる分析は載らない
- 画面が `ai_analysis_start` を呼ぶと、② は受付番号だけを返し、裏で分析を続ける。進み具合と結果は表 `ai_analysis_job` に書く。画面は実行中の分析があるあいだ `ai_analysis_list` を5秒ごとに読み直す
- Claude（Opus 5.5・思考 high・拒否時は別モデルで継続・キャッシュ・ストリーミング）に道具を渡し、数字を自分で取りに行かせる（最大40往復）。道具の中身は **MCP 用の分析 API（features/analysis）と同じ関数**で、画面と同じ定義で集計される
  - `get_kpi_actual` … 実績日起算（`runPivot(basis='actual')`。店舗・担当別反響と同じ）
  - `get_ad_spend` … 反響日起算（`runAdspend`。販促媒体別広告費と同じ）
  - `get_competitor_deals` … 競合との商談（`runCompetitor`）
  - `get_catalog` … 指標と注意点の一覧（`buildCatalog`）
  - `submit_report` … レポートの提出（題・要約・HTML）
  - ⚠️ `runPivot(basis='reaction')` は画面と数え方が違う（契約のステータスを見ない）ため、道具にしていない
  - ⚠️ 旧 `backend/src/core/kpi.php` は画面と定義が違う（建売で申込を契約と数える・次アポに使用禁止の列）。新しい分析では使っていない
- 指示文（SYSTEM_PROMPT）に、指示書のルール（HTML・起算・矛盾させない・初回から深掘り・次の打ち手は必須）を固定で入れる
- レポートは iframe（`sandbox="allow-scripts"` だけ）で表示する。allow-same-origin を足すとログイン情報を読まれる
- ② が再起動すると実行中の分析は消えるため、起動時に「実行中のまま」の行を失敗にする（`failInterruptedJobs`）
- 削除は行を消さずに `deleted_at` を付ける（消すと1日の回数が減り、上限をすり抜けられる。テストで見つけて直した）
- 経過時間は ② が DB の時計で数えて返す（画面の時計と引き算すると、DB の時間帯が違うときにずれる。テストで見つけて直した）

## 追加・変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/aiAnalysis | **job.ts**（新規） | `createJob` `markRunning` `updateProgress` `finishJob` `failJob` `failInterruptedJobs` `getJobSummary` `getJobHtml` `listJobs` `countToday` `countActive` `deleteJob` |
| 同 | **tools.ts**（新規） | `TOOLS` `executeTool` `progressLabel` `reportInput` `SUBMIT_TOOL` |
| 同 | **prompt.ts**（新規） | `SYSTEM_PROMPT` `buildUserMessage` |
| 同 | **runner.ts**（新規） | `runAnalysisJob` `MODEL` |
| 同 | **index.ts**（新規） | `AI_ANALYSIS_AUTHORITY` `DAILY_LIMIT` `startAiAnalysis` `listAiAnalysis` `getAiAnalysis` `deleteAiAnalysis` |
| backend-express/src/gateway | registry.ts | `ai_analysis_start` `ai_analysis_list` `ai_analysis_get` `ai_analysis_delete` を登録。`kpi_filter_master` `kpi_analysis_list` `kpi_analysis_get` を 3つの権限に（`aiAnalysisForbidden`）。`withStatus` |
| backend-express/src/config | env.ts | `anthropicApiKey`（ANTHROPIC_API_KEY） |
| backend-express/src | server.ts | 起動時に `failInterruptedJobs()` |
| backend-express/src/features | staffAdmin.ts | `AUTH_BRANDS` に `Manager` |
| backend-express | package.json / package-lock.json | `@anthropic-ai/sdk` 0.133.0（公開から2週間以上たった版に固定） |
| / | docker-compose.prod.yml | `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}` |
| backend/src/core | express_proxy.php | 新しい request 4つを `expressProxyRequests()` と `expressProxyExclusive()` に |
| 同 | authz.php | `AUTHZ_KPI_ANALYSIS` `requireKpiAnalyst()` |
| backend/src/handlers | kpi_filter_master.php・kpi_analysis_list.php・kpi_analysis_get.php | `requireMaster` → `requireKpiAnalyst` |
| 同 | header_auth_insert.php | `$allowedBrands` に `Manager` |
| frontend/src/components/header | **ClaudeAnalysis.tsx**（作り直し） | 左にカード（新しい分析・分析の一覧・過去の定型分析）、右に結果 |
| 同 | Header.tsx | `AI_ANALYSIS_AUTHORITY`・`canUseClaude`（ボタンを3つの権限だけに）・全画面のモーダル・競合分析の改名（ロゴを外した） |
| 同 | EditAuth.tsx | `BRAND_OPTIONS` に Manager（マネージャー）。BrandAdmin を「ブランド管理者」に |
| 同 | CompetitorAnalysisReports.tsx | 見出しを「競合分析」に（ロゴを外した） |
| frontend/src/components | DailyAction.tsx | 「Claudeによる競合分析」→「競合分析」 |
| frontend/src/components/guide | guideScreens.ts | 「Claudeによる分析」に権限、「競合分析」に改名、権限の案内文 |
| frontend/src/utils | version.ts | 2.2.217 |
| backend/scripts/sql | **2026-10-26_ai_analysis_job.sql**（新規）・**2026-10-26_update_log_2.2.217.sql**（新規。ガイド記事3本を含む） | |
| backend/scripts/guide/articles/common | screen-150.md（書き直し）・screen-130.md・screen-190.md | 下を参照 |

## 業務ガイドの記事
- **Claudeによる分析**（書き直し）: 使える人・頼み方・書き方の例・数字の数え方（反響日起算 / 実績日起算）・結果の見方・回数の上限・競合分析の移動先
- **営業別契約率**: 「マネージャー・管理者のみ」→「ブランド管理者・管理者のみ」（BrandAdmin の表示名を変えたため）
- **業務ガイドの書き方（編集できる人向け）**: 同上

## テスト（ローカル。本物の Claude の代わりに模擬サーバーを使った）
⚠️ 本物の Claude を呼ぶと課金されるため、② の Anthropic の宛先を模擬サーバー（決まった tool_use / text を SSE で返す）に向けた。道具は本物の集計関数とローカル DB で動く。

- ① 経由・トークン無し → 401（新しい request 4つ・kpi_filter_master・kpi_analysis_list）
- 一般 → 403。マネージャー → 200（絞り込みマスタ 37店舗・過去の定型分析 28件）
- 入力の検証（依頼文が短い・期間が逆・36ヶ月超・事業部・店舗だけ・実在しない課）→ 400、日本語の文言
- 実行: 開始 → 実行中の二重開始は 409 → 完了前の取得は 409 → 6回データを取りに行き完了・HTML 保存・費用 $0.188（計算が合う）
  - 模擬サーバーに届いた要求: モデル `claude-opus-5-5`・effort high・thinking adaptive・`fallbacks: "default"`（beta `server-side-fallback-2026-07-01`）・キャッシュ・ストリーミング・道具5つ（`submit_report` だけ逐次受信）・指示文・分析の条件
  - 存在しない集計軸は is_error の tool_result で Claude に返る。提出せずに止まると提出を促す
- Claude に断られた（refusal）→ 失敗・利用者向けの文言・費用を記録
- 実行中に ② を再起動 → 「サーバーの再起動で分析が中断されました」で失敗になる（画面が待ち続けない）
- 1日の上限 → 429。削除は本人と Master だけ（他人の分は 403）。削除しても今日の回数は減らない
- ② を止める → 新しい request は ① が 502（404 ではない）。過去の定型分析の一覧は ① の PHP が代わりに返す（Manager で 200）
- 権限編集: ① 経由で Manager を保存できる。綴り違い（BrandAdimn）は「許可されていない権限です」
- Playwright（開発サーバー → ① → ②）
  - 一般: ボタンが出ない。他社動向に「競合分析」。開くと見出しが「競合分析」
  - マネージャー: 全画面で左にカード・右に結果。完了したレポートが iframe（allow-scripts）で開き、中のスクリプトが動く。失敗の理由が出る。過去の定型分析が開ける。上限に達するとボタンが「今日の上限に達しました」
  - マスター: 建売・課を選び、例を押して開始 → 右に進み具合（何をしているか・経過時間・回数）・ボタンが押せない → 完了でレポート
  - 権限編集: 選択肢が「開発者権限・ブランド管理者・マネージャー・一般・コンサル」
- ② の型チェック・① の PHP 構文・フロントのビルドが通る
- テストのスタッフ・分析の行は消した。② は模擬サーバー向けの設定から戻した

## 残したもの・気づいたこと
- `ClaudeAnalysisPrint.tsx` と `CompetitorAnalysisReports` の `embedded` は、もう使われていない（既存のコードなので消していない）
- ① の `kpi_analyze.php` / `kpi_analysis_delete.php` / `core/kpi.php` も画面からは呼ばれなくなった（残してある）
- 本物の Claude での確認は、デプロイ後に1回だけ行う（docs/deploy-v2.2.217.md「終わったら」）

---
# 新規ファイル（全文）

## backend-express/src/features/aiAnalysis/job.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { execute, executeLarge, query } from '../../db/pool';
import type { AnalysisDivision } from '../analysis/columns';

/**
 * 「Claudeによる分析」（v2.2.217）の実行記録 ai_analysis_job の読み書き。
 *
 * ⚠️ 1行が分析1回。queued → running → done / error と進む。
 * ⚠️ html は 64KB を超えることがあるため executeLarge() で書く（db/pool.ts の注記）。
 */

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface JobScope {
  division: AnalysisDivision;
  /** 空文字は「絞り込まない」 */
  section: string;
  shop: string;
  /** 'YYYY-MM' */
  from: string;
  to: string;
}

export interface NewJob extends JobScope {
  staffId: number;
  staffName: string;
  prompt: string;
}

interface JobRow extends RowDataPacket {
  id: number;
  staff_id: number;
  staff_name: string;
  status: JobStatus;
  prompt: string;
  division: AnalysisDivision;
  section: string;
  shop: string;
  period_from: string;
  period_to: string;
  progress: string;
  tool_calls: number;
  title: string;
  summary: string | null;
  html: string | null;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  elapsed_sec: number | null;
}

/** 一覧・状態確認で返す列（⚠️ html は重いので含めない） */
const SUMMARY_COLUMNS = `
  id, staff_id, staff_name, status, prompt, division, section, shop,
  period_from, period_to, progress, tool_calls, title, summary, model,
  input_tokens, output_tokens, cost_usd, error_message,
  DATE_FORMAT(created_at,  '%Y-%m-%d %H:%i:%s') AS created_at,
  DATE_FORMAT(started_at,  '%Y-%m-%d %H:%i:%s') AS started_at,
  DATE_FORMAT(finished_at, '%Y-%m-%d %H:%i:%s') AS finished_at,
  TIMESTAMPDIFF(SECOND, started_at, COALESCE(finished_at, NOW())) AS elapsed_sec
`;

export interface JobSummary {
  id: number;
  staffId: number;
  staffName: string;
  status: JobStatus;
  prompt: string;
  division: AnalysisDivision;
  section: string;
  shop: string;
  from: string;
  to: string;
  progress: string;
  toolCalls: number;
  title: string;
  summary: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  errorMessage: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /**
   * 開始からの経過秒数（終わっていれば所要秒数）。
   * ⚠️ DB の時計で数える。画面の時計と DB の時刻を引き算すると、時間帯が違うとき（ローカルの DB は UTC）にずれる。
   */
  elapsedSec: number | null;
}

const toSummary = (row: JobRow): JobSummary => ({
  id: row.id,
  staffId: row.staff_id,
  staffName: row.staff_name,
  status: row.status,
  prompt: row.prompt,
  division: row.division,
  section: row.section,
  shop: row.shop,
  from: row.period_from,
  to: row.period_to,
  progress: row.progress,
  toolCalls: row.tool_calls,
  title: row.title,
  summary: row.summary ?? '',
  model: row.model,
  inputTokens: row.input_tokens,
  outputTokens: row.output_tokens,
  costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
  errorMessage: row.error_message ?? '',
  createdAt: row.created_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  elapsedSec: row.elapsed_sec === null ? null : Number(row.elapsed_sec),
});

export const createJob = async (job: NewJob): Promise<number> => {
  const result = await execute(
    `INSERT INTO ai_analysis_job
       (staff_id, staff_name, status, prompt, division, section, shop, period_from, period_to, progress)
     VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?, '受け付けました。まもなく分析を始めます')`,
    [job.staffId, job.staffName, job.prompt, job.division, job.section, job.shop, job.from, job.to]
  );
  return result.insertId;
};

export const markRunning = async (id: number, model: string): Promise<void> => {
  await execute(
    `UPDATE ai_analysis_job
        SET status = 'running', model = ?, started_at = NOW(), progress = '分析を始めました'
      WHERE id = ?`,
    [model, id]
  );
};

/** 途中経過。⚠️ 画面に出る文言なので、利用者が読んで分かる日本語にすること */
export const updateProgress = async (id: number, progress: string, toolCalls: number): Promise<void> => {
  await execute('UPDATE ai_analysis_job SET progress = ?, tool_calls = ? WHERE id = ?', [
    progress.slice(0, 255),
    toolCalls,
    id,
  ]);
};

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export const finishJob = async (
  id: number,
  report: { title: string; summary: string; html: string },
  usage: UsageTotals,
  toolCalls: number
): Promise<void> => {
  await executeLarge(
    `UPDATE ai_analysis_job
        SET status = 'done', title = ?, summary = ?, html = ?, progress = '完了しました',
            tool_calls = ?, input_tokens = ?, output_tokens = ?, cost_usd = ?, finished_at = NOW()
      WHERE id = ?`,
    [
      report.title.slice(0, 255),
      report.summary,
      report.html,
      toolCalls,
      usage.inputTokens,
      usage.outputTokens,
      usage.costUsd,
      id,
    ]
  );
};

export const failJob = async (
  id: number,
  message: string,
  usage: UsageTotals | null,
  toolCalls: number
): Promise<void> => {
  await execute(
    `UPDATE ai_analysis_job
        SET status = 'error', error_message = ?, progress = '失敗しました', tool_calls = ?,
            input_tokens = ?, output_tokens = ?, cost_usd = ?, finished_at = NOW()
      WHERE id = ?`,
    [
      message.slice(0, 500),
      toolCalls,
      usage?.inputTokens ?? null,
      usage?.outputTokens ?? null,
      usage?.costUsd ?? null,
      id,
    ]
  );
};

/**
 * ⚠️ ② が再起動すると、実行中の分析はプロセスごと消える。
 *   起動時に「止まったまま running の行」を失敗にしておかないと、画面が永久に待ち続ける。
 */
export const failInterruptedJobs = async (): Promise<number> => {
  const result = await execute(
    `UPDATE ai_analysis_job
        SET status = 'error', progress = '失敗しました', finished_at = NOW(),
            error_message = 'サーバーの再起動で分析が中断されました。もう一度実行してください。'
      WHERE status IN ('queued', 'running')`
  );
  return result.affectedRows;
};

/** ⚠️ 削除した分析は、読み出しのどこにも出さない（回数を数えるときだけ含める） */
export const getJobSummary = async (id: number): Promise<JobSummary | null> => {
  const rows = await query<JobRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM ai_analysis_job WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] === undefined ? null : toSummary(rows[0]);
};

export const getJobHtml = async (id: number): Promise<string | null> => {
  const rows = await query<JobRow>('SELECT html FROM ai_analysis_job WHERE id = ? AND deleted_at IS NULL', [id]);
  return rows[0]?.html ?? null;
};

export const listJobs = async (limit: number): Promise<JobSummary[]> => {
  // ⚠️ LIMIT はプレースホルダにしない（mysql2 の execute は LIMIT ? を受け付けない）。数値に丸めてから埋め込む
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = await query<JobRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM ai_analysis_job WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ${safeLimit}`
  );
  return rows.map(toSummary);
};

/** 今日この人が実行した回数（⚠️ 失敗も、削除した分も数える。費用はかかっているため） */
export const countToday = async (staffId: number): Promise<number> => {
  const rows = await query<RowDataPacket & { c: number }>(
    'SELECT COUNT(*) AS c FROM ai_analysis_job WHERE staff_id = ? AND created_at >= CURDATE()',
    [staffId]
  );
  return Number(rows[0]?.c ?? 0);
};

/** いま動いている分析の数（全体と本人） */
export const countActive = async (staffId: number): Promise<{ all: number; mine: number }> => {
  const rows = await query<RowDataPacket & { all_count: number; mine: number }>(
    `SELECT COUNT(*) AS all_count, COALESCE(SUM(staff_id = ?), 0) AS mine
       FROM ai_analysis_job WHERE status IN ('queued', 'running')`,
    [staffId]
  );
  return { all: Number(rows[0]?.all_count ?? 0), mine: Number(rows[0]?.mine ?? 0) };
};

/**
 * 削除。⚠️ 行は消さずに deleted_at を付ける（DELETE すると countToday が減り、1日の上限をすり抜けられる）。
 * ⚠️ 本文（html）は消して軽くする。
 */
export const deleteJob = async (id: number): Promise<boolean> => {
  const result = await execute(
    `UPDATE ai_analysis_job SET deleted_at = NOW(), html = NULL
      WHERE id = ? AND deleted_at IS NULL AND status IN ('done', 'error')`,
    [id]
  );
  return result.affectedRows > 0;
};

```

## backend-express/src/features/aiAnalysis/tools.ts
```ts
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

```

## backend-express/src/features/aiAnalysis/prompt.ts
```ts
import { DIVISION_CONFIG } from '../analysis/columns';
import type { JobScope } from './job';

/**
 * 「Claudeによる分析」の指示文。
 *
 * ⚠️ SYSTEM_PROMPT は毎回まったく同じ文字列にすること（日付や利用者名を入れない）。
 *   変わると Anthropic 側のキャッシュが効かず、毎回の費用が上がる。
 *   分析ごとに変わる内容は buildUserMessage() に入れる。
 *
 * ⚠️ 利用者はプロンプトを書き慣れていない（ReadMeClaude.md の要件）。
 *   「もっと詳しく」のような曖昧な依頼でも、初回から深掘りした結果と次の打ち手を出させる。
 */
export const SYSTEM_PROMPT = `あなたは国分ハウジンググループ（注文住宅・建売住宅）のマーケティング・営業データのアナリストです。
社内の Dashboard に集まった反響・顧客・広告費のデータを、道具（tools）で集計しながら分析し、
経営会議や店長会議でそのまま使える HTML レポートを1本書いて submit_report で提出します。

# 読み手
- 店長・マネージャー・経営層。データ分析やシステムの専門家ではありません。
- 依頼文はプロンプトに慣れていない人が書いています。「もっと詳しく」「なんで悪いの」のように曖昧なことがあります。
  依頼の意図を汲み取り、聞き返さずに、読み手が次に知りたくなることまで先回りして調べてください。

# 進め方
1. 最初に get_catalog を1回呼び、使える指標と注意点を確認する。
2. 依頼を「何を判断したいのか」に言い換え、調べる観点を自分で決める。
3. 初回から深掘りする。全体の数字だけで終えず、少なくとも次のように掘り下げる。
   - 推移（月別）で、いつから・どのくらい変わったか
   - 内訳（店舗・担当者・販促媒体・ランクなど）で、どこが効いているか
   - 比較（事業部全体や前年同期）で、その差が大きいのか小さいのか
   - ファネルのどの段階（反響→来場→次アポ→契約）でつまずいているか
4. 数字が出そろったら、レポートを書いて submit_report で1回だけ提出する。

# 数字のルール（Dashboard と矛盾させないために必ず守る）
- 数字は道具が返した値だけを使う。自分で歩留まりや単価を計算し直さない。
  道具の結果に無い比率がどうしても必要なときは、計算式（分子÷分母）を本文に明記する。
- 広告費に関わる KPI（媒体別の反響数・歩留まり・反響単価・来場単価・契約単価・費用対効果）は
  **反響日起算** で語る → get_ad_spend を使う。
- 部署・店舗・担当者の KPI（反響・来場・次アポ・契約の件数と歩留まり、目標に対する進み具合）は
  **実績日起算** で語る → get_kpi_actual を使う。
- 来場は visits、次アポは nextAppointments、契約は contracts を使う。
  firstInterview / secondInterview は画面の来場数・次アポ数と一致しないので、それらの代わりに使わない。
- 実績日起算の同じ月の反響と契約は別々の顧客です。その比を「その月の反響の契約率」と書かない。
- 当月は月の途中なので、前月比の判断に使わない。反響日起算では直近2〜3ヶ月の来場・契約がまだ出そろっていない。
- 件数が少ない（数十件以下）対象の率の差は偶然でも起きる。断定せず「母数が小さい」と書く。
- 入力率が低い項目（失注理由など）は、それ自体を課題として扱い、全体を語る根拠にしない。
- 道具の meta に書かれた注意点は必ず読み、レポートに反映する。
- 道具がエラーを返したら、引数を直して呼び直す。

# レポート（submit_report の html）
- 1ファイルで完結した HTML。<meta charset="utf-8"> を入れる。外部の CSS・スクリプト・フォント・画像は読み込めない。
  グラフが必要ならインラインの SVG か、インラインの JavaScript で描く。
- 幅は 100%。横スクロールを出さない（画面の右半分に埋め込まれる）。表は列を絞るか、表の箱の中だけで横に流す。
- 印刷されることがある。背景色が消えても読めるようにする。
- 見た目は落ち着いた業務文書。本文は 14px 前後、見出しで構造を示す。
- 構成（この順）:
  1. 見出し、対象（事業部・課・店舗・期間）、データの起算（反響日起算 / 実績日起算のどちらを使ったか）、集計日
  2. 結論（3行以内）
  3. 分析（推移・内訳・比較・ファネル。表やグラフと、その数字が何を意味するか）
  4. 要因（データで確かめられた事実と、推測を分けて書く。推測には「推測」と明記する）
  5. 次の打ち手（必須。3〜5個。誰が・何を・いつまでに・どの数字で効果を確かめるか、まで具体的に）
  6. データの注意点（母数が小さいもの、入力率が低い項目、当月が途中であることなど）
- 書いてはいけないこと: 道具の結果に無い数値、個人を特定できる情報（伏字 **** の中身の推測を含む）。
- summary には結論を1〜3文で書く（一覧に表示される）。

すべて日本語で書いてください。`;

/** 分析ごとの依頼文。⚠️ 利用者の文章はそのまま渡す（指示の上書きは SYSTEM_PROMPT のルールが優先される） */
export const buildUserMessage = (scope: JobScope, prompt: string, today: string): string => {
  const division = DIVISION_CONFIG[scope.division].label;
  const target = [division, scope.section, scope.shop].filter((v) => v !== '').join(' › ');

  return `# 分析の条件
- 事業部: ${division}
- 対象: ${target}${scope.section === '' && scope.shop === '' ? '（事業部全体）' : ''}
- 期間: ${scope.from} 〜 ${scope.to}
- 今日: ${today}

道具は、引数を省略するとこの対象・期間で集計します。比較の基準が欲しいときは wholeDivision: true や、
期間（from / to）を変えて呼んでください。

# 依頼
${prompt}`;
};

```

## backend-express/src/features/aiAnalysis/runner.ts
```ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { JobScope, UsageTotals } from './job';
import { failJob, finishJob, markRunning, updateProgress } from './job';
import { buildUserMessage, SYSTEM_PROMPT } from './prompt';
import type { ReportInput } from './tools';
import { executeTool, progressLabel, reportInput, SUBMIT_TOOL, TOOLS } from './tools';

/**
 * 「Claudeによる分析」の実行（v2.2.217）。
 *
 * Claude に道具を渡し、データを取りに行かせながら分析させる（手書きのループ）。
 * 画面からの要求とは切り離して ② のプロセス内で動き、進み具合は ai_analysis_job に書く。
 *
 * ⚠️ 1回で数分〜十数分かかる。ゲートウェイの要求（120秒で切れる）の中で待たないこと。
 * ⚠️ 実行のたびに課金される。上限は registry 側（1人1日5回・同時実行数）でも掛けている。
 */

export const MODEL = 'claude-opus-5-5';

/** Claude とのやり取りの最大往復数。超えたら失敗にする（暴走で費用が膨らむのを防ぐ） */
const MAX_TURNS = 40;
/** レポートを出さずに止まったとき、提出を促す回数 */
const MAX_NUDGES = 2;

/**
 * 100万トークンあたりの単価（USD）。Claude Opus 5.5。
 * ⚠️ 拒否されて別のモデルで続いた場合も同じ単価で数えるため、費用は概算である。
 */
const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };

const costOf = (usage: Anthropic.Beta.BetaUsage): number =>
  ((usage.input_tokens ?? 0) * PRICE.input +
    (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    (usage.output_tokens ?? 0) * PRICE.output) /
  1_000_000;

let client: Anthropic | null = null;
const getClient = (): Anthropic => {
  if (client === null) {
    // ⚠️ 1回の応答が長い（レポートの HTML を書く）ため、既定より長く待つ
    client = new Anthropic({ apiKey: env.anthropicApiKey, timeout: 15 * 60 * 1000, maxRetries: 3 });
  }
  return client;
};

const todayJst = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

/** 失敗を利用者に見せる文言にする（⚠️ API の生のメッセージには英語や内部情報が混ざる） */
const userMessageOf = (error: unknown): string => {
  if (error instanceof Anthropic.AuthenticationError) return 'API キーが無効です。管理者に API キーの設定を確認してもらってください。';
  if (error instanceof Anthropic.PermissionDeniedError) return 'この API キーでは分析を実行できません。';
  if (error instanceof Anthropic.RateLimitError) return 'Claude が混み合っています。少し時間をおいて、もう一度実行してください。';
  if (error instanceof Anthropic.BadRequestError) {
    return /credit balance/i.test(error.message)
      ? 'Claude のクレジット残高が不足しています。管理者に連絡してください。'
      : '分析の依頼を Claude が受け付けませんでした。依頼文を変えて、もう一度実行してください。';
  }
  if (error instanceof Anthropic.APIConnectionError) return 'Claude に接続できませんでした。もう一度実行してください。';
  if (error instanceof Anthropic.APIError) return 'Claude 側で一時的な障害が起きています。時間をおいて、もう一度実行してください。';
  return error instanceof Error ? error.message : '分析に失敗しました。';
};

/**
 * 分析を最後まで実行する。⚠️ 例外を外に出さない（呼び出し側は待たずに放っておく）。
 */
export const runAnalysisJob = async (jobId: number, scope: JobScope, prompt: string): Promise<void> => {
  const usage: UsageTotals = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let toolCalls = 0;

  try {
    await markRunning(jobId, MODEL);

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: 'user', content: buildUserMessage(scope, prompt, todayJst()) },
    ];
    let nudges = 0;
    let report: ReportInput | null = null;

    for (let turn = 0; turn < MAX_TURNS && report === null; turn++) {
      const stream = getClient().beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        // ⚠️ Opus 5.5 は思考を止められない。深さは effort で決める（既定 medium より1段深く）
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        // ⚠️ 安全のための拒否が起きたら、同じ要求を別のモデルで続けてもらう
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // ⚠️ 指示文・道具・それまでのやり取りを毎回キャッシュする（往復が多いため費用が大きく下がる）
        cache_control: { type: 'ephemeral' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      const message = await stream.finalMessage();
      usage.inputTokens +=
        (message.usage.input_tokens ?? 0) +
        (message.usage.cache_creation_input_tokens ?? 0) +
        (message.usage.cache_read_input_tokens ?? 0);
      usage.outputTokens += message.usage.output_tokens ?? 0;
      usage.costUsd += costOf(message.usage);

      if (message.stop_reason === 'refusal') {
        throw new Error('Claude がこの依頼の分析を断りました。依頼文を変えて、もう一度実行してください。');
      }
      if (message.stop_reason === 'max_tokens') {
        throw new Error('レポートが長くなりすぎて途中で切れました。対象や観点を絞って、もう一度実行してください。');
      }

      messages.push({ role: 'assistant', content: message.content });

      const toolUses = message.content.filter(
        (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use'
      );

      if (toolUses.length === 0) {
        // レポートを出さずに止まった。提出を促す
        if (nudges >= MAX_NUDGES) throw new Error('Claude がレポートを提出しないまま止まりました。もう一度実行してください。');
        nudges++;
        messages.push({
          role: 'user',
          content: `分析結果は ${SUBMIT_TOOL} でレポートとして提出してください。`,
        });
        continue;
      }

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        toolCalls++;
        await updateProgress(jobId, progressLabel(toolUse.name), toolCalls);

        if (toolUse.name === SUBMIT_TOOL) {
          const parsed = reportInput.safeParse(toolUse.input);
          if (parsed.success) {
            report = parsed.data;
            break;
          }
          results.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            is_error: true,
            content: 'title・summary・html の3つがそろっていません（html は完結した HTML 全文）。もう一度提出してください。',
          });
          continue;
        }

        try {
          const content = await executeTool(toolUse.name, toolUse.input, scope);
          results.push({ type: 'tool_result', tool_use_id: toolUse.id, content });
        } catch (error) {
          results.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            is_error: true,
            content: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (report === null) messages.push({ role: 'user', content: results });
    }

    if (report === null) {
      throw new Error('分析が長くなりすぎたため打ち切りました。対象や観点を絞って、もう一度実行してください。');
    }

    await finishJob(jobId, report, usage, toolCalls);
    logger.info(
      `ai_analysis job=${jobId} done tools=${toolCalls} in=${usage.inputTokens} out=${usage.outputTokens} usd=${usage.costUsd.toFixed(4)}`
    );
  } catch (error) {
    logger.error(`ai_analysis job=${jobId} failed`, error instanceof Error ? error.message : error);
    try {
      await failJob(jobId, userMessageOf(error), usage, toolCalls);
    } catch (saveError) {
      logger.error(`ai_analysis job=${jobId} could not save failure`, saveError);
    }
  }
};

```

## backend-express/src/features/aiAnalysis/index.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { env } from '../../config/env';
import { query } from '../../db/pool';
import { DIVISION_CONFIG } from '../analysis/columns';
import type { AnalysisDivision } from '../analysis/columns';
import type { JobSummary } from './job';
import { countActive, countToday, createJob, deleteJob, getJobHtml, getJobSummary, listJobs } from './job';
import { runAnalysisJob } from './runner';

/**
 * 「Claudeによる分析」（v2.2.217）の受け口。registry.ts から呼ぶ。
 *
 * 使える人: Master・BrandAdmin（ブランド管理者）・Manager（マネージャー）。
 * 結果はこの3つの権限の人なら全員、全員分を見られる（チームで共有する。2026-10-26 の決定）。
 */

export const AI_ANALYSIS_AUTHORITY = ['Master', 'BrandAdmin', 'Manager'];

/** 1人1日の実行上限（2026-10-26 の決定）。⚠️ 失敗も数える */
export const DAILY_LIMIT = 5;
/** 同時に動かす分析の上限（全体）。② の負荷と費用の暴走を防ぐ */
const MAX_ACTIVE_ALL = 3;
/** 期間の最大の長さ（月） */
const MAX_SPAN_MONTHS = 36;

interface Result<T> {
  httpStatus: number;
  body: T | { status: 'error'; message: string };
}

const fail = (httpStatus: number, message: string): Result<never> => ({
  httpStatus,
  body: { status: 'error', message },
});

const startInput = z.object({
  prompt: z.string().trim().min(5, '分析したい内容を5文字以上で書いてください。').max(4000, '依頼文が長すぎます（4,000字まで）。'),
  division: z.enum(['order', 'kaeru'], { error: '事業部を選んでください。' }),
  section: z.string().trim().max(64).optional().transform((v) => v ?? ''),
  shop: z.string().trim().max(64).optional().transform((v) => v ?? ''),
  from: z.string().regex(/^\d{4}-\d{2}$/, '期間（開始月）の形式が正しくありません。'),
  to: z.string().regex(/^\d{4}-\d{2}$/, '期間（終了月）の形式が正しくありません。'),
});

const monthIndex = (ym: string): number => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};

/**
 * 課・店舗が、その事業部の report_flag = 1 の店舗に実在するか確かめる。
 * ⚠️ 画面の選択肢（kpi_filter_master）と同じ条件。画面の値をそのまま信用しない。
 */
const validateScope = async (division: AnalysisDivision, section: string, shop: string): Promise<string | null> => {
  if (section === '' && shop !== '') return '店舗を選ぶ前に課を選んでください。';
  if (section === '') return null;

  const rows = await query<RowDataPacket & { c: number }>(
    `SELECT COUNT(*) AS c FROM shop_list
      WHERE division = ? AND section = ? AND report_flag = 1 ${shop === '' ? '' : 'AND shop = ?'}`,
    shop === ''
      ? [DIVISION_CONFIG[division].shopDivision, section]
      : [DIVISION_CONFIG[division].shopDivision, section, shop]
  );
  return Number(rows[0]?.c ?? 0) > 0 ? null : '選んだ課・店舗が見つかりません。選び直してください。';
};

export const startAiAnalysis = async (
  staff: { id: number; name: string },
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok'; id: number; usedToday: number; dailyLimit: number }>> => {
  if (env.anthropicApiKey === '') {
    return fail(503, '分析の準備ができていません（API キーが設定されていません）。管理者に連絡してください。');
  }

  const parsed = startInput.safeParse(body);
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? '入力が正しくありません。');
  const input = parsed.data;

  const span = monthIndex(input.to) - monthIndex(input.from);
  if (span < 0) return fail(400, '期間の開始月が終了月より後になっています。');
  if (span >= MAX_SPAN_MONTHS) return fail(400, `期間は ${MAX_SPAN_MONTHS} ヶ月以内にしてください。`);

  const scopeError = await validateScope(input.division, input.section, input.shop);
  if (scopeError !== null) return fail(400, scopeError);

  const usedToday = await countToday(staff.id);
  if (usedToday >= DAILY_LIMIT) return fail(429, `本日の実行上限（${DAILY_LIMIT}回）に達しました。明日また実行してください。`);

  const active = await countActive(staff.id);
  if (active.mine > 0) return fail(409, 'あなたの分析がまだ実行中です。終わってから次の分析を始めてください。');
  if (active.all >= MAX_ACTIVE_ALL) return fail(429, 'ほかの人の分析が混み合っています。数分おいて、もう一度実行してください。');

  const scope = { division: input.division, section: input.section, shop: input.shop, from: input.from, to: input.to };
  const id = await createJob({ ...scope, staffId: staff.id, staffName: staff.name, prompt: input.prompt });

  // ⚠️ 待たない。ゲートウェイの要求は120秒で切れるが、分析は数分〜十数分かかる
  void runAnalysisJob(id, scope, input.prompt);

  return { httpStatus: 200, body: { status: 'ok', id, usedToday: usedToday + 1, dailyLimit: DAILY_LIMIT } };
};

const idOf = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const listAiAnalysis = async (
  staffId: number,
  body: Record<string, unknown>
): Promise<{ status: 'ok'; items: JobSummary[]; usedToday: number; dailyLimit: number; myStaffId: number }> => {
  const limit = idOf(body.limit) ?? 50;
  const [items, usedToday] = await Promise.all([listJobs(limit), countToday(staffId)]);
  // ⚠️ myStaffId は画面が「自分の分析か」（削除ボタン・実行中の判定）を見分けるために返す
  return { status: 'ok', items, usedToday, dailyLimit: DAILY_LIMIT, myStaffId: staffId };
};

export const getAiAnalysis = async (
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok'; item: JobSummary; html: string }>> => {
  const id = idOf(body.id);
  if (id === null) return fail(400, 'id が正しくありません。');
  const item = await getJobSummary(id);
  if (item === null) return fail(404, 'この分析は見つかりません。');
  if (item.status !== 'done') return fail(409, 'この分析はまだ終わっていません。');
  return { httpStatus: 200, body: { status: 'ok', item, html: (await getJobHtml(id)) ?? '' } };
};

/** 削除できるのは実行した本人か Master だけ */
export const deleteAiAnalysis = async (
  staff: { id: number; brand: string },
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok' }>> => {
  const id = idOf(body.id);
  if (id === null) return fail(400, 'id が正しくありません。');
  const item = await getJobSummary(id);
  if (item === null) return fail(404, 'この分析は見つかりません。');
  if (staff.brand !== 'Master' && item.staffId !== staff.id) {
    return fail(403, '削除できるのは、実行した本人か Master だけです。');
  }
  if (!(await deleteJob(id))) return fail(409, '実行中の分析は削除できません。');
  return { httpStatus: 200, body: { status: 'ok' } };
};

```

## frontend/src/components/header/ClaudeAnalysis.tsx
```tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import { CLAUDE_ORANGE } from './ClaudeIcon';
import ClaudeAnalysisResult from './ClaudeAnalysisResult';
import type { AnalysisKind, AnySnapshot, StructuredAnalysis } from './ClaudeAnalysisResult';

/**
 * Claudeによる分析（v2.2.217 で作り直した。Dashboard からの自由分析）。
 *
 * 分析したいことを文章で書き、事業部・課・店舗・期間を選ぶと、Claude がダッシュボードと
 * 同じ定義の数字を ② から自分で集めて分析し、HTML のレポートを書く。
 *
 *   左: 新しい分析の条件 → 分析の一覧（全員分）→ 過去の定型分析（v2.2.216 までの保存分）
 *   右: 選んだ分析の進み具合・結果
 *
 * ⚠️ 使えるのは Master・BrandAdmin・Manager だけ（Header.tsx がボタンを出し分け、② も確かめる）。
 * ⚠️ 1回で数分〜十数分かかる。分析は ② の中で続くので、画面を閉じても止まらない。
 *   実行中の分析があるあいだ、一覧を数秒ごとに読み直して進み具合を出す。
 * ⚠️ 実行のたびに課金される。1人1日5回まで（② が数える）。
 * ⚠️ レポートは Claude が書いた HTML。必ず iframe（sandbox="allow-scripts" だけ）の中で表示する。
 *   allow-same-origin を足すと、レポートの中からダッシュボードのログイン情報を読めてしまう。
 */

type Division = 'order' | 'kaeru';

const DIVISIONS: { value: Division; label: string; shopDivision: string }[] = [
    { value: 'order', label: '注文事業', shopDivision: '注文事業' },
    { value: 'kaeru', label: '建売分譲事業', shopDivision: '建売分譲事業' },
];
const divisionLabel = (value: string): string => DIVISIONS.find((d) => d.value === value)?.label ?? value;

/** 書き出しに迷う人のための例。押すと依頼文の欄に入る */
const EXAMPLES = [
    '直近半年で契約が伸びた店舗と落ちた店舗を比べて、差がどこで生まれているか教えて',
    '広告費に対して契約が取れている媒体と取れていない媒体を知りたい。来期の配分の見直し案も',
    '次アポ率が低い原因を、担当者別・媒体別に深掘りして',
    '前年の同じ時期と比べて反響が減っている原因と、すぐ打てる手を教えて',
];

/** 実行中の分析があるとき、一覧を読み直す間隔 */
const POLL_MS = 5000;

type JobStatus = 'queued' | 'running' | 'done' | 'error';

/** ai_analysis_list が返す1件（本文は含まない） */
type Job = {
    id: number;
    staffId: number;
    staffName: string;
    status: JobStatus;
    prompt: string;
    division: Division;
    section: string;
    shop: string;
    from: string;
    to: string;
    progress: string;
    toolCalls: number;
    title: string;
    summary: string;
    model: string;
    costUsd: number | null;
    errorMessage: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    /** 開始からの経過秒数（② が DB の時計で数える） */
    elapsedSec: number | null;
};

/** kpi_analysis_list が返す1件（v2.2.216 までの定型分析） */
type LegacyItem = {
    id: number;
    title: string;
    headline: string;
    analysis_type: AnalysisKind;
    created_at: string;
    staff_name: string | null;
};

type ShopMaster = { division: string; section: string; shop: string };

/** 右に出しているもの */
type Selected =
    | { kind: 'job'; id: number }
    | { kind: 'legacy'; item: LegacyItem };

const isActive = (status: JobStatus): boolean => status === 'queued' || status === 'running';

const ym = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** 既定の期間: 締まった直近6ヶ月（当月は月の途中なので入れない） */
const defaultPeriod = (): { from: string; to: string } => {
    const now = new Date();
    return {
        from: ym(new Date(now.getFullYear(), now.getMonth() - 6, 1)),
        to: ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    };
};

/** '2026-10-26 14:03:11' → '10/26 14:03' */
const shortTime = (value: string | null): string => {
    if (value === null || value === '') return '';
    const m = /^\d{4}-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(value);
    return m === null ? value : `${Number(m[1])}/${Number(m[2])} ${m[3]}:${m[4]}`;
};

/**
 * 開始からの経過（分・秒）。② が返した経過秒数に、一覧を読み込んでからの秒数を足す。
 * ⚠️ 開始時刻と画面の時計を引き算しないこと（DB の時間帯が違うとずれる）。
 */
const elapsedText = (elapsedSec: number | null, fetchedAt: number, now: number): string => {
    if (elapsedSec === null) return '';
    const sec = Math.max(0, elapsedSec + Math.floor((now - fetchedAt) / 1000));
    return `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, '0')}秒`;
};

const errorMessageOf = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const ClaudeAnalysis: React.FC = () => {
    const { authority } = useContext(AuthContext);
    const isMaster = authority === 'Master';

    // 条件
    const [division, setDivision] = useState<Division>('order');
    const [section, setSection] = useState('');
    const [shop, setShop] = useState('');
    const [period, setPeriod] = useState(defaultPeriod);
    const [prompt, setPrompt] = useState('');
    const [shopMaster, setShopMaster] = useState<ShopMaster[]>([]);

    // 一覧
    const [jobs, setJobs] = useState<Job[]>([]);
    const [usedToday, setUsedToday] = useState(0);
    const [dailyLimit, setDailyLimit] = useState(5);
    /** 自分の staff.id（② が一覧と一緒に返す）。自分の分析かどうかの判定に使う */
    const [myStaffId, setMyStaffId] = useState(0);
    const [legacy, setLegacy] = useState<LegacyItem[]>([]);
    const [legacyOpen, setLegacyOpen] = useState(false);

    // 右
    const [selected, setSelected] = useState<Selected | null>(null);
    const [html, setHtml] = useState<{ id: number; html: string } | null>(null);
    const [legacyBody, setLegacyBody] = useState<{ analysis: StructuredAnalysis; kpi: AnySnapshot } | null>(null);

    const [starting, setStarting] = useState(false);
    const [error, setError] = useState('');
    const [now, setNow] = useState(() => Date.now());
    /** 一覧を最後に読み込んだ時刻（経過時間の表示に使う） */
    const [fetchedAt, setFetchedAt] = useState(() => Date.now());

    // ------------------------------------------------------------------
    // 読み込み
    // ------------------------------------------------------------------
    const loadJobs = useCallback(async (): Promise<void> => {
        try {
            const res = await apiClient.post('', { request: 'ai_analysis_list', limit: 50 });
            if (res.data?.status !== 'ok') return;
            setJobs((res.data.items ?? []) as Job[]);
            setFetchedAt(Date.now());
            setUsedToday(Number(res.data.usedToday ?? 0));
            setDailyLimit(Number(res.data.dailyLimit ?? 5));
            setMyStaffId(Number(res.data.myStaffId ?? 0));
        } catch (e) {
            setError(errorMessageOf(e, '分析の一覧を読み込めませんでした。'));
        }
    }, []);

    useEffect(() => {
        void loadJobs();
        void (async () => {
            try {
                const res = await apiClient.post('', { request: 'kpi_filter_master' });
                if (res.data?.status === 'ok') setShopMaster((res.data.shops ?? []) as ShopMaster[]);
            } catch {
                // 課・店舗を選べないだけ。事業部全体の分析はできるので止めない
            }
            try {
                const res = await apiClient.post('', { request: 'kpi_analysis_list', limit: 100 });
                if (res.data?.status === 'ok') setLegacy((res.data.items ?? []) as LegacyItem[]);
            } catch {
                // 過去の定型分析が出ないだけ
            }
        })();
    }, [loadJobs]);

    // 実行中の分析があるあいだだけ、一覧を読み直す（経過時間の表示も1秒ごとに進める）
    const hasActive = jobs.some((job) => isActive(job.status));
    useEffect(() => {
        if (!hasActive) return;
        const poll = window.setInterval(() => { void loadJobs(); }, POLL_MS);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => { window.clearInterval(poll); window.clearInterval(tick); };
    }, [hasActive, loadJobs]);

    const selectedJob = selected?.kind === 'job' ? jobs.find((job) => job.id === selected.id) ?? null : null;

    // 選んだ分析が終わっていて本文が未取得なら取りに行く（実行中に選んでいた分析が終わったときも）
    useEffect(() => {
        if (selectedJob === null || selectedJob.status !== 'done' || html?.id === selectedJob.id) return;
        let cancelled = false;
        void (async () => {
            try {
                const res = await apiClient.post('', { request: 'ai_analysis_get', id: selectedJob.id });
                if (!cancelled && res.data?.status === 'ok') setHtml({ id: selectedJob.id, html: String(res.data.html ?? '') });
            } catch (e) {
                if (!cancelled) setError(errorMessageOf(e, 'レポートを開けませんでした。'));
            }
        })();
        return () => { cancelled = true; };
    }, [selectedJob, html]);

    // ------------------------------------------------------------------
    // 条件の選択肢（部門 → 課 → 店舗）
    // ------------------------------------------------------------------
    const shopDivision = DIVISIONS.find((d) => d.value === division)?.shopDivision ?? '';
    const sectionOptions = useMemo(() => {
        const seen = new Set<string>();
        shopMaster.forEach((s) => { if (s.division === shopDivision) seen.add(s.section); });
        return Array.from(seen);
    }, [shopMaster, shopDivision]);
    const shopOptions = useMemo(
        () => (section === '' ? [] : shopMaster.filter((s) => s.division === shopDivision && s.section === section).map((s) => s.shop)),
        [shopMaster, shopDivision, section]
    );

    const periodError = period.from === '' || period.to === ''
        ? '期間を選んでください。'
        : period.from > period.to ? '開始月が終了月より後になっています。' : '';
    const limitReached = usedToday >= dailyLimit;
    const myActive = jobs.some((job) => isActive(job.status) && job.staffId === myStaffId);
    const canStart = !starting && !myActive && prompt.trim().length >= 5 && periodError === '' && !limitReached;

    // ------------------------------------------------------------------
    // 操作
    // ------------------------------------------------------------------
    const start = async (): Promise<void> => {
        setError('');
        setStarting(true);
        try {
            const res = await apiClient.post('', {
                request: 'ai_analysis_start',
                prompt: prompt.trim(),
                division,
                section,
                shop,
                from: period.from,
                to: period.to,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '分析を始められませんでした。');
                return;
            }
            setPrompt('');
            setSelected({ kind: 'job', id: Number(res.data.id) });
            await loadJobs();
        } catch (e) {
            setError(errorMessageOf(e, '分析を始められませんでした。時間をおいて、もう一度お試しください。'));
        } finally {
            setStarting(false);
        }
    };

    const openLegacy = async (item: LegacyItem): Promise<void> => {
        setSelected({ kind: 'legacy', item });
        setLegacyBody(null);
        try {
            const res = await apiClient.post('', { request: 'kpi_analysis_get', id: item.id });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '保存された分析を開けませんでした。');
                return;
            }
            setLegacyBody({ analysis: res.data.analysis as StructuredAnalysis, kpi: res.data.kpi as AnySnapshot });
        } catch (e) {
            setError(errorMessageOf(e, '保存された分析を開けませんでした。'));
        }
    };

    const remove = async (job: Job): Promise<void> => {
        if (!window.confirm(`「${job.title || job.prompt.slice(0, 30)}」を削除します。よろしいですか？`)) return;
        try {
            const res = await apiClient.post('', { request: 'ai_analysis_delete', id: job.id });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '削除できませんでした。');
                return;
            }
            if (selected?.kind === 'job' && selected.id === job.id) setSelected(null);
            await loadJobs();
        } catch (e) {
            setError(errorMessageOf(e, '削除できませんでした。'));
        }
    };

    const scopeText = (job: Pick<Job, 'division' | 'section' | 'shop'>): string =>
        [divisionLabel(job.division), job.section, job.shop].filter((v) => v !== '').join(' › ');

    // ------------------------------------------------------------------
    // 描画
    // ------------------------------------------------------------------
    return (
        <div className="cla_wrap">
            <style>{`
                /* ⚠️ 全画面モーダルの Modal.Body は p-0 かつ overflow: hidden（Header.tsx）。余白と高さはこちらで持つ */
                .cla_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                            padding: 12px 32px 20px; box-sizing: border-box; }
                .cla_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column;
                             min-height: 0; flex: 1; gap: 12px; }
                .cla_note { font-size: 11px; color: #6b7280; line-height: 1.6; }
                .cla_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca;
                             border-radius: 8px; padding: 10px 12px; display: flex; gap: 8px; align-items: flex-start; }
                .cla_error button { margin-left: auto; border: 0; background: none; color: #b91c1c; cursor: pointer; }

                /* 左にカード、右に結果（競合分析と同じ形） */
                .cla_body { display: flex; gap: 12px; flex: 1 1 auto; min-height: 0; }
                .cla_side { width: 360px; flex: none; overflow: auto; display: flex; flex-direction: column; gap: 10px;
                            padding-right: 2px; }
                .cla_card { border: 1px solid #e8e6dc; border-radius: 10px; background: #fff; padding: 12px 14px;
                            display: flex; flex-direction: column; gap: 8px; }
                .cla_card_title { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; }
                .cla_row { display: flex; gap: 8px; }
                .cla_field { display: flex; flex-direction: column; gap: 3px; flex: 1 1 0; min-width: 0; }
                .cla_label { font-size: 11px; color: #6b7280; font-weight: 700; }
                .cla_input { border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 8px; font-size: 12px;
                             background: #fff; color: #1f2937; outline: none; width: 100%; }
                .cla_input:focus { border-color: ${CLAUDE_ORANGE}; }
                .cla_input:disabled { background: #f5f4f0; color: #9ca3af; }
                textarea.cla_input { resize: vertical; min-height: 110px; line-height: 1.6; }
                .cla_examples { display: flex; flex-wrap: wrap; gap: 5px; }
                .cla_example { border: 1px solid #f0d9cc; background: #fdf8f6; color: #8a4a33; border-radius: 999px;
                               font-size: 10.5px; padding: 3px 9px; cursor: pointer; text-align: left; line-height: 1.4; }
                .cla_example:hover { border-color: ${CLAUDE_ORANGE}; }
                .cla_start { border: 0; border-radius: 8px; background: ${CLAUDE_ORANGE}; color: #fff; font-size: 13px;
                             font-weight: 700; padding: 8px 14px; cursor: pointer; }
                .cla_start:disabled { background: #d1d5db; cursor: not-allowed; }
                .cla_warn { font-size: 11px; color: #8a6d3b; background: #fdf8e7; border: 1px solid #f0e2b6;
                            border-radius: 6px; padding: 6px 8px; line-height: 1.6; }

                .cla_item { border: 1px solid #e8e6dc; border-radius: 10px; background: #fff; padding: 9px 11px;
                            cursor: pointer; text-align: left; width: 100%; display: block; }
                .cla_item:hover { border-color: ${CLAUDE_ORANGE}; }
                .cla_item.is_on { border-color: ${CLAUDE_ORANGE}; background: #fdf8f6; }
                .cla_item_title { font-weight: 700; font-size: 12px; line-height: 1.45; }
                .cla_item_meta { font-size: 10px; color: #6b7280; margin-top: 4px; display: flex; gap: 5px; flex-wrap: wrap; }
                .cla_tag { background: #f3f4f6; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
                .cla_state { display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700;
                             border-radius: 999px; padding: 2px 7px; margin-right: 5px; vertical-align: 1px; white-space: nowrap; }
                .cla_state.is_running { background: ${CLAUDE_ORANGE}; color: #fff; }
                .cla_state.is_done { background: #dcfce7; color: #166534; }
                .cla_state.is_error { background: #fee2e2; color: #991b1b; }
                .cla_del { border: 0; background: none; color: #9ca3af; cursor: pointer; font-size: 11px; padding: 0; margin-top: 4px; }
                .cla_del:hover { color: #dc2626; }
                .cla_toggle { border: 0; background: none; padding: 0; font-size: 12px; font-weight: 700; color: #4b5563;
                              cursor: pointer; display: flex; align-items: center; gap: 6px; }

                .cla_view { flex: 1 1 auto; min-width: 0; border: 1px solid #e8e6dc; border-radius: 10px; background: #fff;
                            display: flex; flex-direction: column; overflow: hidden; }
                .cla_view_head { border-bottom: 1px solid #e8e6dc; padding: 8px 12px; display: flex; align-items: center;
                                 gap: 8px; flex-wrap: wrap; }
                .cla_view_scroll { flex: 1 1 auto; overflow: auto; padding: 14px 18px; }
                .cla_frame { flex: 1 1 auto; width: 100%; border: 0; }
                .cla_empty { padding: 48px 24px; color: #6b7280; font-size: 12.5px; line-height: 1.9; max-width: 640px; margin: 0 auto; }
                .cla_empty h3 { font-size: 15px; color: #1f2937; margin: 0 0 8px; font-weight: 700; }
                .cla_running { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px;
                               text-align: center; }
                .cla_progress { font-size: 14px; font-weight: 700; color: #1f2937; }
                .cla_prompt { white-space: pre-wrap; font-size: 12px; color: #4b5563; background: #faf9f5;
                              border: 1px solid #e8e6dc; border-radius: 8px; padding: 10px 12px; max-width: 640px; text-align: left; }
            `}</style>

            <div className="cla_inner">
                <span className="cla_note">
                    分析したいことを文章で書くと、Claude がダッシュボードと同じ数字を集めて深掘りし、次の打ち手まで含めたレポートを書きます。
                    広告費の歩留まりは反響日起算、部署・店舗の歩留まりは実績日起算で数えます。
                </span>

                {error !== '' && (
                    <div className="cla_error">
                        <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                        <span>{error}</span>
                        <button type="button" onClick={() => setError('')} aria-label="閉じる">×</button>
                    </div>
                )}

                <div className="cla_body">
                    {/* ───────── 左: カード ───────── */}
                    <div className="cla_side">
                        <div className="cla_card">
                            <span className="cla_card_title">
                                <i className="fa-solid fa-wand-magic-sparkles" style={{ color: CLAUDE_ORANGE }} aria-hidden="true" />
                                新しい分析
                            </span>

                            <div className="cla_row">
                                <label className="cla_field">
                                    <span className="cla_label">事業部</span>
                                    <select id="cla-division" className="cla_input" value={division}
                                        onChange={(e) => { setDivision(e.target.value as Division); setSection(''); setShop(''); }}>
                                        {DIVISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </label>
                                <label className="cla_field">
                                    <span className="cla_label">課</span>
                                    <select id="cla-section" className="cla_input" value={section}
                                        onChange={(e) => { setSection(e.target.value); setShop(''); }}>
                                        <option value="">事業部全体</option>
                                        {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </label>
                            </div>

                            <label className="cla_field">
                                <span className="cla_label">店舗</span>
                                <select id="cla-shop" className="cla_input" value={shop} disabled={section === ''}
                                    onChange={(e) => setShop(e.target.value)}>
                                    <option value="">{section === '' ? '課を選ぶと選べます' : '課内すべて'}</option>
                                    {shopOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>

                            <div className="cla_row">
                                <label className="cla_field">
                                    <span className="cla_label">期間（開始月）</span>
                                    <input id="cla-from" type="month" className="cla_input" value={period.from}
                                        onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
                                </label>
                                <label className="cla_field">
                                    <span className="cla_label">期間（終了月）</span>
                                    <input id="cla-to" type="month" className="cla_input" value={period.to}
                                        onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
                                </label>
                            </div>
                            {periodError !== '' && <span className="cla_note" style={{ color: '#b91c1c' }}>{periodError}</span>}

                            <label className="cla_field">
                                <span className="cla_label">分析したいこと</span>
                                <textarea id="cla-prompt" className="cla_input" value={prompt} maxLength={4000}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="例: 鹿児島の店舗で契約が減っている理由と、来月からできる対策を教えて" />
                            </label>
                            <div className="cla_examples">
                                {EXAMPLES.map((text) => (
                                    <button key={text} type="button" className="cla_example" onClick={() => setPrompt(text)}>
                                        {text}
                                    </button>
                                ))}
                            </div>
                            <span className="cla_note">
                                うまく書けなくても大丈夫です。「もっと詳しく」くらいの書き方でも、最初から深掘りして、次の打ち手まで出します。
                            </span>

                            <div className="cla_warn">
                                <i className="fa-regular fa-clock me-1" aria-hidden="true" />
                                分析には <b>5〜15分ほど</b>かかります。画面を閉じても分析は続き、終わると下の一覧に出ます。
                                <br />1人1日 {dailyLimit} 回まで（今日 {usedToday} 回）。実行のたびに費用がかかります。
                            </div>

                            <button type="button" className="cla_start" disabled={!canStart}
                                onClick={() => { void start(); }}>
                                {starting ? '受け付けています…' : myActive ? 'あなたの分析が実行中です' : limitReached ? '今日の上限に達しました' : '分析を始める'}
                            </button>
                        </div>

                        <span className="cla_card_title mt-1">分析の一覧</span>
                        {jobs.length === 0 && <span className="cla_note">まだ分析がありません。</span>}
                        {jobs.map((job) => (
                            <div key={job.id}>
                                <button type="button"
                                    className={`cla_item${selected?.kind === 'job' && selected.id === job.id ? ' is_on' : ''}`}
                                    onClick={() => setSelected({ kind: 'job', id: job.id })}>
                                    <span className="cla_item_title d-block">
                                        {isActive(job.status) && <span className="cla_state is_running"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />実行中</span>}
                                        {job.status === 'error' && <span className="cla_state is_error">失敗</span>}
                                        {job.status === 'done' && <span className="cla_state is_done">完了</span>}
                                        {job.title !== '' ? job.title : job.prompt.slice(0, 60)}
                                    </span>
                                    <span className="cla_item_meta">
                                        <span className="cla_tag">{scopeText(job)}</span>
                                        <span className="cla_tag">{job.from}〜{job.to}</span>
                                        <span className="cla_tag">{shortTime(job.createdAt)}</span>
                                        <span className="cla_tag">{job.staffName || '－'}</span>
                                    </span>
                                </button>
                                {!isActive(job.status) && (isMaster || job.staffId === myStaffId) && (
                                    <button type="button" className="cla_del" onClick={() => { void remove(job); }}>削除</button>
                                )}
                            </div>
                        ))}

                        {legacy.length > 0 && (
                            <>
                                <button type="button" className="cla_toggle mt-2" onClick={() => setLegacyOpen((v) => !v)}>
                                    <i className={`fa-solid fa-chevron-${legacyOpen ? 'down' : 'right'}`} aria-hidden="true" />
                                    過去の定型分析（{legacy.length}件）
                                </button>
                                {legacyOpen && legacy.map((item) => (
                                    <button key={item.id} type="button"
                                        className={`cla_item${selected?.kind === 'legacy' && selected.item.id === item.id ? ' is_on' : ''}`}
                                        onClick={() => { void openLegacy(item); }}>
                                        <span className="cla_item_title d-block">{item.title}</span>
                                        <span className="cla_item_meta">
                                            <span className="cla_tag">{item.created_at.slice(0, 10)}</span>
                                            <span className="cla_tag">{item.staff_name ?? '－'}</span>
                                        </span>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>

                    {/* ───────── 右: 結果 ───────── */}
                    <div className="cla_view">
                        {selected === null && (
                            <div className="cla_empty">
                                <h3>Claude に分析を頼む</h3>
                                左の「新しい分析」で、事業部・課・店舗・期間を選び、知りたいことを書いて「分析を始める」を押してください。
                                <br />Claude がダッシュボードの数字を自分で何度も集計しながら、推移・内訳・比較・ファネルの順に掘り下げ、
                                最後に「次の打ち手」まで書いたレポートを出します。
                                <br /><br />
                                <b>分析には5〜15分ほどかかります。</b>待っているあいだにほかの画面を使っても、この画面を閉じても大丈夫です。
                                <br />終わった分析は、左の一覧からいつでも開けます（開くだけなら費用はかかりません）。
                            </div>
                        )}

                        {selected?.kind === 'job' && selectedJob !== null && (
                            <>
                                <div className="cla_view_head">
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>
                                        {selectedJob.title !== '' ? selectedJob.title : '分析中'}
                                    </span>
                                    <span className="cla_tag">{scopeText(selectedJob)}</span>
                                    <span className="cla_tag">{selectedJob.from}〜{selectedJob.to}</span>
                                    <span className="cla_note ms-auto">
                                        {selectedJob.staffName}・{shortTime(selectedJob.createdAt)}
                                        {selectedJob.status === 'done' && selectedJob.costUsd !== null && `・約 $${selectedJob.costUsd.toFixed(2)}`}
                                    </span>
                                </div>

                                {isActive(selectedJob.status) && (
                                    <div className="cla_running">
                                        <div className="spinner-border" style={{ color: CLAUDE_ORANGE }} role="status">
                                            <span className="visually-hidden">分析中</span>
                                        </div>
                                        <span className="cla_progress">{selectedJob.progress}</span>
                                        <span className="cla_note">
                                            {elapsedText(selectedJob.elapsedSec, fetchedAt, now)} 経過・データを集めた回数 {selectedJob.toolCalls} 回
                                        </span>
                                        <span className="cla_note">
                                            5〜15分ほどかかります。画面を閉じても分析は続きます。終わると左の一覧に「完了」と出ます。
                                        </span>
                                        <div className="cla_prompt">{selectedJob.prompt}</div>
                                    </div>
                                )}

                                {selectedJob.status === 'error' && (
                                    <div className="cla_empty">
                                        <div className="cla_error mb-3">
                                            <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                                            <span>{selectedJob.errorMessage || '分析に失敗しました。'}</span>
                                        </div>
                                        <div className="cla_prompt">{selectedJob.prompt}</div>
                                        <button type="button" className="cla_example mt-2"
                                            onClick={() => setPrompt(selectedJob.prompt)}>
                                            この依頼文を左の欄に入れる
                                        </button>
                                    </div>
                                )}

                                {selectedJob.status === 'done' && (
                                    html?.id === selectedJob.id ? (
                                        // ⚠️ sandbox は allow-scripts だけ（グラフのスクリプトは動かす。ログイン情報は読ませない）
                                        <iframe className="cla_frame" title={selectedJob.title} sandbox="allow-scripts" srcDoc={html.html} />
                                    ) : (
                                        <div className="cla_running"><span className="cla_note">レポートを開いています…</span></div>
                                    )
                                )}
                            </>
                        )}

                        {selected?.kind === 'legacy' && (
                            <>
                                <div className="cla_view_head">
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>{selected.item.title}</span>
                                    <span className="cla_tag">過去の定型分析</span>
                                </div>
                                <div className="cla_view_scroll">
                                    {legacyBody === null
                                        ? <span className="cla_note">開いています…</span>
                                        : <ClaudeAnalysisResult type={selected.item.analysis_type} snapshot={legacyBody.kpi} analysis={legacyBody.analysis} />}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClaudeAnalysis;

```

## backend/scripts/sql/2026-10-26_ai_analysis_job.sql
```sql
-- =====================================================================
-- v2.2.217 「Claudeによる分析」（Dashboard からの自由分析）の実行記録と結果
--
-- 1行が分析1回。② が受け付けた時点で queued、Claude が動いている間は running、
-- レポートが届いたら done、失敗したら error になる。
-- 画面は status を数秒ごとに読みに来る（ai_analysis_status）。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。② も同じ DB を使う。
-- ⚠️ html は Claude が書いた HTML。画面では iframe（sandbox）の中でしか表示しない。
-- =====================================================================
CREATE TABLE IF NOT EXISTS ai_analysis_job (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_id        INT          NOT NULL COMMENT '実行した人（staff.id）',
  staff_name      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '実行した人の名前（staff.name の写し）',
  status          ENUM('queued','running','done','error') NOT NULL DEFAULT 'queued',
  prompt          TEXT         NOT NULL COMMENT '利用者が書いた依頼文',
  division        VARCHAR(16)  NOT NULL COMMENT 'order（注文）/ kaeru（建売）',
  section         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '課。空は事業部全体',
  shop            VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '店舗。空は課（または事業部）全体',
  period_from     CHAR(7)      NOT NULL COMMENT 'YYYY-MM',
  period_to       CHAR(7)      NOT NULL COMMENT 'YYYY-MM',
  progress        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '画面に出す途中経過（例: 店舗別の実績を集計中）',
  tool_calls      INT          NOT NULL DEFAULT 0 COMMENT 'Claude がデータを取りに行った回数',
  title           VARCHAR(255) NOT NULL DEFAULT '',
  summary         TEXT         NULL COMMENT '一覧に出す要約（1〜3文）',
  html            LONGTEXT     NULL COMMENT 'レポート本文',
  model           VARCHAR(64)  NOT NULL DEFAULT '',
  input_tokens    INT          NULL,
  output_tokens   INT          NULL,
  cost_usd        DECIMAL(10,5) NULL,
  error_message   VARCHAR(500) NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at      DATETIME     NULL,
  finished_at     DATETIME     NULL,
  deleted_at      DATETIME     NULL COMMENT '削除した日時。⚠️ 行は消さない（消すと1日の実行回数が減り、上限をすり抜けられる）',
  PRIMARY KEY (id),
  KEY idx_staff_created (staff_id, created_at),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Claudeによる分析（v2.2.217）';

```

---
# 変更したファイル（差分）
```diff
diff --git a/backend-express/package.json b/backend-express/package.json
index 997b2d08..cea4c687 100644
--- a/backend-express/package.json
+++ b/backend-express/package.json
@@ -13,6 +13,7 @@
     "compare": "tsx src/cli/compareBackends.ts"
   },
   "dependencies": {
+    "@anthropic-ai/sdk": "0.133.0",
     "@types/qrcode": "^1.5.6",
     "bcryptjs": "^3.0.3",
     "compression": "^1.8.1",
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index bc07c176..22b4d2d5 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -187,6 +187,15 @@ export const env = {
    */
   memberEntryKey: (process.env.MEMBER_ENTRY_KEY ?? '').trim(),
 
+  /**
+   * 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー。
+   *
+   * ⚠️ **未設定なら分析を受け付けない**（他の機能は止めないため requireEnv にはしない）。
+   * ⚠️ **リポジトリに書かないこと。** 設定先は ② VPS の .env.prod のみ。
+   *   差し替えの手順は docs/deploy-v2.2.217.md。
+   */
+  anthropicApiKey: (process.env.ANTHROPIC_API_KEY ?? '').trim(),
+
   /** アンバサダー反響の社内通知先。カンマ区切りで複数可 */
   ambassadorNotifyTo: (process.env.AMBASSADOR_NOTIFY_TO ?? '')
     .split(',')
diff --git a/backend-express/src/features/staffAdmin.ts b/backend-express/src/features/staffAdmin.ts
index 069203af..80d12bf3 100644
--- a/backend-express/src/features/staffAdmin.ts
+++ b/backend-express/src/features/staffAdmin.ts
@@ -47,7 +47,11 @@ import { logger } from '../utils/logger';
  * ⚠️ `insideSales` は Menu.tsx の「ISカレンダー」の判定に使われている。
  *   ⚠️ 選択肢に無いので**この画面からは付与できない**（2026-10-05 時点の指示どおり）。
  */
-export const AUTH_BRANDS = ['Master', 'BrandAdmin', 'ordinary', 'Consulting'] as const;
+/*
+ * ⚠️ `Manager`（マネージャー）は v2.2.217 で追加。⚠️ いまは「Claudeによる分析」を使えることだけが違う。
+ *   ⚠️ 一般（ordinary）でないため、`!== 'ordinary'` で判定している画面では一般より広く見える。
+ */
+export const AUTH_BRANDS = ['Master', 'BrandAdmin', 'Manager', 'ordinary', 'Consulting'] as const;
 
 /**
  * 事業区分（`staff.shop`）として保存してよい値。⚠️ 画面の選択肢もこの順。
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 6a0c4e86..fcf79359 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -150,6 +150,13 @@ import { runMyhomesEntry } from '../features/myhomes/entry';
 import { importOwnersHouseApplication, listOwnersHouseApplications } from '../features/ownersHouse/application';
 import { runOwnersHouseReservation } from '../features/ownersHouse/reservation';
 import { runEstimateEntry } from '../features/estimate/entry';
+import {
+  AI_ANALYSIS_AUTHORITY,
+  deleteAiAnalysis,
+  getAiAnalysis,
+  listAiAnalysis,
+  startAiAnalysis,
+} from '../features/aiAnalysis';
 import type { GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
@@ -1095,29 +1102,38 @@ register({
 // ---------------------------------------------------------------------------
 // KPI分析（ClaudeAnalysis.tsx）— 参照系のみ
 //
-// ⚠️ auth: 'master' にしている。移植元がいずれも requireMaster() を呼んでおり、
-//   経営数値と分析結果を返すため。'none' にすると認証なしで取得できてしまう。
+// ⚠️ v2.2.217 から Master・BrandAdmin・Manager が見られる（AI_ANALYSIS_AUTHORITY）。
+//   auth: 'staff' で本人を特定したうえで、権限を手で確かめる（① は requireAuthority）。
+//   ⚠️ 'none' にすると認証なしで経営数値を取得できてしまう。
 //
 // ⚠️ kpi_analyze（Claude API呼び出し＋INSERT）と kpi_analysis_delete（DELETE）は
 //   移植していない。自動フォールバックがあるため、② で完了した直後に応答が
 //   失われると ① でも実行され、**二重課金・履歴の二重INSERT**になる。
-//   これらを移すには「フォールバック禁止」の仕組みが先に必要。
+//   v2.2.217 で画面から定型分析の実行を外したため、これらはもう呼ばれない。
 // ---------------------------------------------------------------------------
 
+const aiAnalysisForbidden = (ctx: { staff: { brand: string } | null; res: { status: (code: number) => unknown } }) => {
+  if (AI_ANALYSIS_AUTHORITY.includes(ctx.staff?.brand ?? '')) return null;
+  ctx.res.status(403);
+  return { status: 'error', message: 'この操作を行う権限がありません。' };
+};
+
 register({
   request: 'kpi_filter_master',
   summary: 'KPI分析の絞り込みマスタ（部門→課→店舗→スタッフ）',
   phpSource: 'backend/src/handlers/kpi_filter_master.php',
-  auth: 'master',
-  handler: async () => runKpiFilterMaster(),
+  auth: 'staff',
+  handler: async (ctx) => aiAnalysisForbidden(ctx) ?? runKpiFilterMaster(),
 });
 
 register({
   request: 'kpi_analysis_list',
   summary: '保存済みKPI分析の一覧（本体JSONは含まない）',
   phpSource: 'backend/src/handlers/kpi_analysis_list.php',
-  auth: 'master',
+  auth: 'staff',
   handler: async (ctx) => {
+    const denied = aiAnalysisForbidden(ctx);
+    if (denied !== null) return denied;
     const result = await runKpiAnalysisList({
       limit: ctx.body.limit,
       offset: ctx.body.offset,
@@ -1134,8 +1150,10 @@ register({
   request: 'kpi_analysis_get',
   summary: '保存済みKPI分析の1件取得（結果画面の復元用。課金は発生しない）',
   phpSource: 'backend/src/handlers/kpi_analysis_get.php',
-  auth: 'master',
+  auth: 'staff',
   handler: async (ctx) => {
+    const denied = aiAnalysisForbidden(ctx);
+    if (denied !== null) return denied;
     const result = await runKpiAnalysisGet(ctx.body.id);
     // ⚠️ PHP は 400 / 404 / 422 を出し分けている。同じコードを返す
     if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
@@ -1143,6 +1161,61 @@ register({
   },
 });
 
+// ---------------------------------------------------------------------------
+// Claudeによる分析（v2.2.217。Dashboard からの自由分析）— ② のみ（① に PHP 版は無い）
+//
+// ⚠️ ai_analysis_start は受け付けて番号を返すだけ。分析は ② の中で数分〜十数分かけて続き、
+//   画面は ai_analysis_list を数秒ごとに呼んで進み具合を見る（実行中の分析があるあいだだけ）。
+// ⚠️ 実行のたびに課金される。1人1日5回・同時3件まで（features/aiAnalysis/index.ts）。
+// ⚠️ express_proxy.php の expressProxyRequests() と expressProxyExclusive() の両方に入れてある。
+// ---------------------------------------------------------------------------
+
+/** 結果の型を問わず、HTTP ステータスを付けて本文を返す */
+const withStatus = <T>(ctx: { res: { status: (code: number) => unknown } }, result: { httpStatus: number; body: T }): T => {
+  if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+  return result.body;
+};
+
+register({
+  request: 'ai_analysis_start',
+  summary: 'Claudeによる分析を始める（受付番号を返す。分析は裏で続く）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const denied = aiAnalysisForbidden(ctx);
+    if (denied !== null || ctx.staff === null) return denied;
+    return withStatus(ctx, await startAiAnalysis({ id: ctx.staff.id, name: ctx.staff.name }, ctx.body));
+  },
+});
+
+register({
+  request: 'ai_analysis_list',
+  summary: 'Claudeによる分析の一覧（全員分。本文は含まない）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => aiAnalysisForbidden(ctx) ?? listAiAnalysis(ctx.staff?.id ?? 0, ctx.body),
+});
+
+register({
+  request: 'ai_analysis_get',
+  summary: 'Claudeによる分析の結果（HTML 本文つき）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => aiAnalysisForbidden(ctx) ?? withStatus(ctx, await getAiAnalysis(ctx.body)),
+});
+
+register({
+  request: 'ai_analysis_delete',
+  summary: 'Claudeによる分析の削除（実行した本人か Master のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const denied = aiAnalysisForbidden(ctx);
+    if (denied !== null || ctx.staff === null) return denied;
+    return withStatus(ctx, await deleteAiAnalysis({ id: ctx.staff.id, brand: ctx.staff.brand }, ctx.body));
+  },
+});
+
 // ---------------------------------------------------------------------------
 // 顧客詳細モーダルの初期データ（InformationEdit / Kaeru / Resale）— 参照系のみ
 //
diff --git a/backend-express/src/server.ts b/backend-express/src/server.ts
index 5296c4d8..0c88c898 100644
--- a/backend-express/src/server.ts
+++ b/backend-express/src/server.ts
@@ -1,6 +1,7 @@
 import { createApp } from './app';
 import { env } from './config/env';
 import { closePool, pingDatabase } from './db/pool';
+import { failInterruptedJobs } from './features/aiAnalysis/job';
 import { startMetaAdsScheduler } from './features/metaAds/scheduler';
 import { startCvMatch } from './features/tracking/cvMatch';
 import { startTrackingMaintenance } from './features/tracking/maintenance';
@@ -37,6 +38,10 @@ const bootstrap = async (): Promise<void> => {
     startTrackingMaintenance();
     // 自社のフォームでないサイトの CV と反響の突き合わせ（v2.2.205。5分ごと）
     startCvMatch();
+    // Claudeによる分析（v2.2.217）。再起動で消えた実行中の分析を失敗にする（画面が待ち続けないように）
+    failInterruptedJobs()
+      .then((count) => { if (count > 0) logger.warn(`ai_analysis: 再起動で中断された分析 ${count} 件を失敗にしました`); })
+      .catch((error: unknown) => logger.error('ai_analysis: 中断された分析の整理に失敗しました', error));
   });
 
   // 重い集計SQLの途中で切断されないよう、既定より長めに設定する
diff --git a/backend/scripts/guide/articles/common/screen-130.md b/backend/scripts/guide/articles/common/screen-130.md
index df952ec8..62715fe9 100644
--- a/backend/scripts/guide/articles/common/screen-130.md
+++ b/backend/scripts/guide/articles/common/screen-130.md
@@ -4,7 +4,7 @@ section: 画面の使い方
 sort: 130
 summary: 営業ごとの商談顧客数・次アポ・契約と、担当変更理由。
 ---
-ヘッダーの「活動サマリー → 営業別契約率」（マネージャー・管理者のみ）。営業ごとに、商談したお客様のうち何人が次アポ・契約まで進んだかを見ます。
+ヘッダーの「活動サマリー → 営業別契約率」（ブランド管理者・管理者のみ）。営業ごとに、商談したお客様のうち何人が次アポ・契約まで進んだかを見ます。
 
 [[画面:営業別契約率]]
 
diff --git a/backend/scripts/guide/articles/common/screen-190.md b/backend/scripts/guide/articles/common/screen-190.md
index 00a6beca..2c2f80a9 100644
--- a/backend/scripts/guide/articles/common/screen-190.md
+++ b/backend/scripts/guide/articles/common/screen-190.md
@@ -4,7 +4,7 @@ section: 画面の使い方
 sort: 190
 summary: 記事を作る・直すときの手順と書き方。
 ---
-記事を作ったり直したりできるのは、**マネージャーと管理者**です。
+記事を作ったり直したりできるのは、**ブランド管理者と管理者**です。
 
 ## 直す
 1. 記事を開き、右上の「直す」を押す
diff --git a/backend/src/core/authz.php b/backend/src/core/authz.php
index 350d4bd2..da11e3a5 100644
--- a/backend/src/core/authz.php
+++ b/backend/src/core/authz.php
@@ -83,3 +83,16 @@ function requireMaster(PDO $pdo, array $headers): array
     requireAuthority($staff, [AUTHZ_MASTER]);
     return $staff;
 }
+
+/**
+ * 「Claudeによる分析」を使える権限（v2.2.217）。② の AI_ANALYSIS_AUTHORITY と同じ値にすること。
+ */
+const AUTHZ_KPI_ANALYSIS = ['Master', 'BrandAdmin', 'Manager'];
+
+/** 認証と「Claudeによる分析を使える権限であること」の確認（保存済みの定型分析の閲覧で使う） */
+function requireKpiAnalyst(PDO $pdo, array $headers): array
+{
+    $staff = requireStaff($pdo, $headers);
+    requireAuthority($staff, AUTHZ_KPI_ANALYSIS);
+    return $staff;
+}
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 49a53fe9..0ea2afaa 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -132,6 +132,11 @@ function expressProxyRequests(): array
         //     （① の campaign_form.php が「② が10分以内に保存した同じ人」を飛ばすので、見積もりは防げる）
         'estimate_entry',
         'owners_house_reservation',
+        // ⚠️ v2.2.217。Claudeによる分析（Dashboard からの自由分析）。⚠️ ② のみ（① に PHP 版は無い）
+        'ai_analysis_start',
+        'ai_analysis_list',
+        'ai_analysis_get',
+        'ai_analysis_delete',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -771,6 +776,12 @@ function expressProxyExclusive(): array
         'analysis_report_upload',
         'analysis_report_delete',
 
+        // v2.2.217 新規。Claudeによる分析。⚠️ 分析は ② の中で数分かけて続くため、① では代われない
+        'ai_analysis_start',
+        'ai_analysis_list',
+        'ai_analysis_get',
+        'ai_analysis_delete',
+
         // -----------------------------------------------------------------
         // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
         //
diff --git a/backend/src/handlers/header_auth_insert.php b/backend/src/handlers/header_auth_insert.php
index e293dd64..b7113120 100644
--- a/backend/src/handlers/header_auth_insert.php
+++ b/backend/src/handlers/header_auth_insert.php
@@ -10,7 +10,7 @@ $brand = $data['brand'] ?? 'ordinary';
 
 // 権限は許可リストで検証する。リクエストの値がそのまま入ると
 // 想定外の権限文字列が保存され、画面上どの選択肢にも一致しなくなる。
-$allowedBrands = ['Master', 'BrandAdmin', 'ordinary'];
+$allowedBrands = ['Master', 'BrandAdmin', 'Manager', 'ordinary'];
 
 if ($name === '') {
     echo json_encode(["status" => "error", "message" => "氏名を入力してください。"], JSON_UNESCAPED_UNICODE);
diff --git a/backend/src/handlers/kpi_analysis_get.php b/backend/src/handlers/kpi_analysis_get.php
index 129821cf..fecfb2bd 100644
--- a/backend/src/handlers/kpi_analysis_get.php
+++ b/backend/src/handlers/kpi_analysis_get.php
@@ -15,7 +15,7 @@
 require_once __DIR__ . '/../core/authz.php';
 
 try {
-    requireMaster($pdo, $headers);
+    requireKpiAnalyst($pdo, $headers);
 
     $id = (int)($data['id'] ?? 0);
     if ($id <= 0) {
diff --git a/backend/src/handlers/kpi_analysis_list.php b/backend/src/handlers/kpi_analysis_list.php
index bdf1fb0d..172c81f5 100644
--- a/backend/src/handlers/kpi_analysis_list.php
+++ b/backend/src/handlers/kpi_analysis_list.php
@@ -12,7 +12,7 @@
  *   1件あたり数十KBあり、一覧で全部返すと無駄に重くなる。
  *   本体は kpi_analysis_get で1件ずつ取る。
  *
- * Master権限者だけが使う機能のため、一覧は実行者を問わず全件を返し、
+ * Master・BrandAdmin・Manager（v2.2.217〜）だけが使う機能のため、一覧は実行者を問わず全件を返し、
  * 誰が実行したかを staff_name で示す。
  */
 
@@ -20,7 +20,7 @@ require_once __DIR__ . '/../core/authz.php';
 require_once __DIR__ . '/../core/kpi.php';
 
 try {
-    requireMaster($pdo, $headers);
+    requireKpiAnalyst($pdo, $headers);
 
     // 上限を設けないと、履歴が増えたときに一覧だけで重くなる
     $limit  = (int)($data['limit']  ?? 20);
diff --git a/backend/src/handlers/kpi_filter_master.php b/backend/src/handlers/kpi_filter_master.php
index a150dfdb..fd330edf 100644
--- a/backend/src/handlers/kpi_filter_master.php
+++ b/backend/src/handlers/kpi_filter_master.php
@@ -21,7 +21,7 @@ require_once __DIR__ . '/../core/kpi.php';
 try {
     // 分析本体と同じ権限にそろえる。ここだけ緩いと、
     // 誰がどの店舗に所属しているかの一覧が漏れる。
-    requireMaster($pdo, $headers);
+    requireKpiAnalyst($pdo, $headers);
 
     // -----------------------------------------------------------------
     // 対象店舗
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index 81b47409..0293f1ff 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -125,6 +125,12 @@ services:
       # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
       - MEMBER_ENTRY_KEY=${MEMBER_ENTRY_KEY:-}
 
+      # 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー（Claude Console で発行したもの）。
+      #
+      # ⚠️ 未設定だと分析の開始が 503 になる（他の機能は動く）。
+      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。** 差し替え手順は docs/deploy-v2.2.217.md
+      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
+
       # K-SNAP の owner を公開ギャラリー向けに暗号化する鍵。
       #
       # ⚠️ ① の .htaccess（SetEnv）と**同じ値**にすること。
diff --git a/frontend/src/components/DailyAction.tsx b/frontend/src/components/DailyAction.tsx
index 198e7a7e..25ff4c26 100644
--- a/frontend/src/components/DailyAction.tsx
+++ b/frontend/src/components/DailyAction.tsx
@@ -429,7 +429,7 @@ const DailyAction = () => {
         >
             <Modal.Header className='border-bottom-0 pb-0 fw-bold text-secondary d-flex align-items-center gap-3 justify-content-start'
                 style={{ fontSize: '15px' }}>
-                <span>Claudeによる競合分析</span>
+                <span>競合分析</span>
                 <button
                     type='button'
                     onClick={() => setShowReports(false)}
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index f715e51e..69f728eb 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -63,7 +63,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     '予算詳細': { route: '/budget', divisions: ['order', 'spec', 'used'], authority: ADMIN, pcOnly: true },
     'マーケット情報': { route: '/market' },
     // ── ヘッダーのメニュー（Header.tsx の menuMapping と同じ条件）
-    'Claudeによる分析': { claude: true },
+    // ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけ（Header.tsx の AI_ANALYSIS_AUTHORITY と同じ）
+    'Claudeによる分析': { claude: true, authority: ['Master', 'BrandAdmin', 'Manager'] },
     '重複反響サマリー': { menu: '反響管理/重複反響サマリー' },
     'ブラックリスト設定': { menu: '反響管理/ブラックリスト設定' },
     '事後アンケート': { menu: '反響管理/事後アンケート' },
@@ -81,7 +82,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     '他社広告ライブラリ': { menu: '他社動向/他社広告ライブラリ' },
     '他社資料': { menu: '他社動向/他社資料' },
     '競合サマリー': { menu: '他社動向/競合サマリー' },
-    'Claudeによる競合分析': { menu: '他社動向/Claudeによる競合分析' },
+    // ⚠️ v2.2.217 で「Claudeによる競合分析」から改名（Header.tsx の CLAUDE_COMPETITOR_ITEM と同じ）
+    '競合分析': { menu: '他社動向/競合分析' },
     '架電状況（注文営業）': { menu: '架電状況/注文営業' },
     '架電状況（建売営業）': { menu: '架電状況/建売営業' },
     '架電状況（中古営業）': { menu: '架電状況/中古営業' },
@@ -156,7 +158,8 @@ export const screenBlockedReason = (name: string, authority: string): string | n
     const screen = GUIDE_SCREENS[name];
     if (screen === undefined) return 'この画面はまだ登録されていません';
     if (screen.authority && !screen.authority.includes(authority)) {
-        return screen.authority.length === 1 ? '管理者だけが開ける画面です' : 'マネージャー・管理者だけが開ける画面です';
+        // ⚠️ v2.2.217 で BrandAdmin の表示名が「ブランド管理者」に、Manager が「マネージャー」になったため、権限名を並べない
+        return screen.authority.length === 1 ? '管理者だけが開ける画面です' : '権限のある人だけが開ける画面です';
     }
     if (isPcOnly(screen) && isPhoneScreen()) return 'PC で開いてください';
     return null;
diff --git a/frontend/src/components/header/CompetitorAnalysisReports.tsx b/frontend/src/components/header/CompetitorAnalysisReports.tsx
index d7199762..749d60d4 100644
--- a/frontend/src/components/header/CompetitorAnalysisReports.tsx
+++ b/frontend/src/components/header/CompetitorAnalysisReports.tsx
@@ -1,11 +1,11 @@
 import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
 import apiClient from '../../utils/apiClient';
 import AuthContext from '../../context/AuthContext';
-import ClaudeIcon, { CLAUDE_ORANGE } from './ClaudeIcon';
+import { CLAUDE_ORANGE } from './ClaudeIcon';
 import { toLocalDate } from '../../utils/toLocalDate';
 
 /**
- * Claudeによる競合分析（ヘッダー → 他社動向 → Claudeによる競合分析）。
+ * 競合分析（ヘッダー → 他社動向 → 競合分析）。
  *
  * ─────────────────────────────────────────────
  * ⚠️⚠️ **この画面は Claude を呼ばない。課金は一切発生しない。**
@@ -126,7 +126,7 @@ type Props = {
     /**
      * Claudeによる分析（ClaudeAnalysis.tsx）の上部に埋め込むとき true（v2.2.191）。
      *
-     * ⚠️⚠️ **既定（false）は全画面モーダル用**（他社動向 →「Claudeによる競合分析」）。
+     * ⚠️⚠️ **既定（false）は全画面モーダル用**（他社動向 →「競合分析」）。
      *   ⚠️ 全画面では高さを画面いっぱいに使うが、⚠️ **xl のモーダルの中では親に高さが無い。**
      *   ⚠️ ⚠️ **埋め込み時は一覧と本文の高さを 60vh に固定し、外側の余白を外す**（`car_embedded`）。
      */
@@ -400,10 +400,8 @@ const CompetitorAnalysisReports = ({ embedded = false }: Props) => {
 
             <div className="car_inner">
                 <div className="car_head">
-                    <span className="car_title">
-                        <ClaudeIcon height={16} />
-                        による競合分析
-                    </span>
+                    {/* ⚠️ v2.2.217 で Claude のロゴを外し「競合分析」にした（指示書） */}
+                    <span className="car_title">競合分析</span>
                     <span className="car_note">
                         Claude Desktop で作成した分析レポートを保存して閲覧します。
                         {/* ⚠️ 課金が発生しないことを明記する。以前は画面から実行していた */}
diff --git a/frontend/src/components/header/EditAuth.tsx b/frontend/src/components/header/EditAuth.tsx
index 85905e27..3c748b88 100644
--- a/frontend/src/components/header/EditAuth.tsx
+++ b/frontend/src/components/header/EditAuth.tsx
@@ -41,9 +41,14 @@ import AuthContext from '../../context/AuthContext';
  * ⚠️⚠️ **② の AUTH_BRANDS（features/staffAdmin.ts）と同じ並び・同じ値にすること。**
  *   ⚠️ ここだけ増やしても ② が「許可されていない権限です」で弾く。
  */
+/*
+ * ⚠️ v2.2.217: Manager を追加し、BrandAdmin の表示名を「マネージャー」から「ブランド管理者」に変えた
+ *   （同じ表示名が2つにならないように。2026-10-26 の決定）。保存値は変えていない。
+ */
 const BRAND_OPTIONS = [
     { value: 'Master', label: '開発者権限' },
-    { value: 'BrandAdmin', label: 'マネージャー' },
+    { value: 'BrandAdmin', label: 'ブランド管理者' },
+    { value: 'Manager', label: 'マネージャー' },
     { value: 'ordinary', label: '一般' },
     { value: 'Consulting', label: 'コンサル' },
 ] as const;
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 64b202f2..371fe9a6 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -46,15 +46,21 @@ type MenuKey = 'システム管理' | '反響管理' | '土地・物件管理' |
 /**
  * 他社動向メニューの最後に出す項目。
  *
- * ⚠️ 画面にはロゴ＋「による競合分析」で出す（ヘッダーの「による分析」と同じ形）。
- *   ⚠️ **この文字列そのものは画面に出さない。** 中で見分けるための鍵である。
+ * ⚠️ v2.2.217 で「（Claudeのロゴ）による競合分析」から文字だけの「競合分析」に変えた（指示書）。
+ *   ⚠️ guideScreens.ts の GUIDE_SCREENS（'競合分析'）と同じ名前にすること。
  *
  * ⚠️⚠️ **開いても Claude は呼ばれない。課金は発生しない。**
  *   ⚠️ 保存済みのレポート（HTML）を見るだけの画面である。
  *   ⚠️ ⚠️ **2026-09-21 まで、ここは画面から Claude を実行していた。**
  *     ⚠️ 1回あたり数百円かかったため、⚠️ **推論は各自の Claude アカウント（MCP）へ移した。**
  */
-const CLAUDE_COMPETITOR_ITEM = 'Claudeによる競合分析';
+const CLAUDE_COMPETITOR_ITEM = '競合分析';
+
+/**
+ * 「Claudeによる分析」を使える権限（v2.2.217）。⚠️ ② の AI_ANALYSIS_AUTHORITY と同じ値にすること。
+ *   ⚠️ ボタンを隠すだけでは閉じない。② の ai_analysis_* / kpi_* も同じ3つを確かめている。
+ */
+const AI_ANALYSIS_AUTHORITY = ['Master', 'BrandAdmin', 'Manager'];
 
 const Header = ({ }) => {
     const { authority, category } = useContext(AuthContext);
@@ -104,11 +110,10 @@ const Header = ({ }) => {
     const [claudeModal, setClaudeModal] = useState<boolean>(false);
     const [claudeHover, setClaudeHover] = useState<boolean>(false);
     /**
-     * ⚠️⚠️ **v2.2.191 から全員が開ける**（以前は Master 以外「権限がありません」）。
-     *   ⚠️ 全員に見せるのは上部の競合分析レポート（閲覧のみ・課金なし）だけ。
-     *   ⚠️ ⚠️ **分析の実行と保存済みの分析は ClaudeAnalysis.tsx 側で Master だけに出している**
-     *     （⚠️ ② の `kpi_*` も auth: 'master'）。
+     * ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけにボタンを出す（Dashboard からの自由分析）。
+     *   ⚠️ 競合分析のレポートはこの画面から外し、他社動向 →「競合分析」だけで読む（全員）。
      */
+    const canUseClaude = AI_ANALYSIS_AUTHORITY.includes(authority);
     const openClaude = (): void => {
         setClaudeModal(true);
     };
@@ -432,28 +437,30 @@ const Header = ({ }) => {
                     userSelect: 'none',
                 }}
             >
-                {/* Claudeによる分析：menuMapping とは別の独立したボタン */}
-                <button
-                    type="button"
-                    onClick={() => openClaude()}
-                    onMouseEnter={() => setClaudeHover(true)}
-                    onMouseLeave={() => setClaudeHover(false)}
-                    className="border-0 d-flex align-items-center px-2 py-1 me-2"
-                    style={{
-                        fontSize: '13px',
-                        fontWeight: 500,
-                        // ロゴ画像内の文字が黒のため、続く「による分析」も黒で揃える
-                        color: '#000',
-                        backgroundColor: claudeHover ? '#fdf8f6' : 'transparent',
-                        borderRadius: '4px',
-                        lineHeight: 1,
-                        gap: '2px',
-                    }}
-                    title="Claudeによる分析"
-                >
-                    <ClaudeIcon height={15} />
-                    による分析
-                </button>
+                {/* Claudeによる分析：menuMapping とは別の独立したボタン（⚠️ v2.2.217 から3つの権限だけ） */}
+                {canUseClaude && (
+                    <button
+                        type="button"
+                        onClick={() => openClaude()}
+                        onMouseEnter={() => setClaudeHover(true)}
+                        onMouseLeave={() => setClaudeHover(false)}
+                        className="border-0 d-flex align-items-center px-2 py-1 me-2"
+                        style={{
+                            fontSize: '13px',
+                            fontWeight: 500,
+                            // ロゴ画像内の文字が黒のため、続く「による分析」も黒で揃える
+                            color: '#000',
+                            backgroundColor: claudeHover ? '#fdf8f6' : 'transparent',
+                            borderRadius: '4px',
+                            lineHeight: 1,
+                            gap: '2px',
+                        }}
+                        title="Claudeによる分析"
+                    >
+                        <ClaudeIcon height={15} />
+                        による分析
+                    </button>
+                )}
 
                 <div className='bg-primary rounded-pill text-white me-1 shadow-sm'
                     style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer' }}
@@ -499,13 +506,7 @@ const Header = ({ }) => {
                                     className="py-2 px-3 text-dark position-relative"
                                     onClick={() => openMenuItem(menu, item)}
                                 >
-                                    {/* ⚠️ 競合分析はロゴ＋文言で出す（ヘッダーの「による分析」と同じ形） */}
-                                    {item === CLAUDE_COMPETITOR_ITEM
-                                        ? <span className="d-flex align-items-center" style={{ gap: '2px' }}>
-                                            <ClaudeIcon height={14} />
-                                            による競合分析
-                                        </span>
-                                        : item}
+                                    {item}
                                     {isEstate(item) && <div className="position-absolute menu_sync" style={{ top: '12px', right: '10px' }}>新着 {newEstate}件</div>}
                                 </Dropdown.Item>
                             ))}
@@ -516,16 +517,17 @@ const Header = ({ }) => {
 
             </div>}
 
-            {/* Claudeによる分析 */}
-            <Modal show={claudeModal} onHide={() => setClaudeModal(false)} size="xl" centered scrollable>
+            {/* Claudeによる分析（⚠️ v2.2.217 から全画面。左に条件と一覧、右に結果） */}
+            <Modal show={claudeModal} onHide={() => setClaudeModal(false)}
+                dialogClassName="modal-fullscreen" contentClassName="h-100 d-flex flex-column">
                 <Modal.Header closeButton className="border-bottom-0 pb-0" style={{ fontSize: '15px' }}>
                     <span className="fw-bold d-flex align-items-center" style={{ color: '#000', gap: '2px' }}>
                         <ClaudeIcon height={17} />
                         による分析
                     </span>
                 </Modal.Header>
-                <Modal.Body className="pt-2" style={{ maxHeight: '80vh' }}>
-                    <ClaudeAnalysis />
+                <Modal.Body className="p-0" style={{ overflow: 'hidden', flex: '1 1 auto', minHeight: 0 }}>
+                    {claudeModal && <ClaudeAnalysis />}
                 </Modal.Body>
             </Modal>
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 877e73ea..477afe74 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.216';
+export const newVersion = '2.2.217';
```

## backend/scripts/guide/articles/common/screen-150.md（書き直し・全文）
```markdown
---
title: Claudeによる分析
section: 画面の使い方
sort: 150
summary: 知りたいことを文章で頼むと、Claude がダッシュボードの数字を集めて深掘りし、次の打ち手まで書いたレポートを出す。
---
ヘッダーの左上「Claudeによる分析」。管理者・ブランド管理者・マネージャーだけが開けます（ほかの人にはボタンが出ません）。

[[画面:Claudeによる分析]]

知りたいことを文章で書くと、Claude がダッシュボードの数字を自分で何度も集計しながら分析し、レポートを書きます。レポートには、必ず「次の打ち手」が入ります。

> 注意：1回の分析に **5〜15分ほど**かかります。待っているあいだにほかの画面を使っても、この画面を閉じても、分析は止まりません。

## 画面の形
左に条件と一覧、右に結果が出ます。

## 分析を頼む（左の「新しい分析」）
1. **事業部**を選ぶ（注文事業／建売分譲事業）
2. 必要なら**課**と**店舗**を選ぶ（選ばなければ事業部全体）
3. **期間**（開始月・終了月）を選ぶ。最初は、締まった直近6ヶ月が入っています
4. **分析したいこと**を書く。下の例を押すと、その文が入ります
5. 「分析を始める」を押す

書き方に慣れていなくても大丈夫です。「もっと詳しく」「なんで下がったの」くらいの書き方でも、最初から深掘りして、次の打ち手まで出します。

書き方の例：
- 直近半年で契約が伸びた店舗と落ちた店舗を比べて、差がどこで生まれているか教えて
- 広告費に対して契約が取れている媒体と取れていない媒体を知りたい。来期の配分の見直し案も
- 次アポ率が低い原因を、担当者別・媒体別に深掘りして

## 数字の数え方
レポートの数字は、ダッシュボードの画面と同じ数え方です。
- **広告費に関わる歩留まり**（媒体ごとの反響・来場・契約、反響単価・契約単価など）は**反響日起算**です。「販促媒体別広告費」と同じ数字になります。
- **部署・店舗・担当者の歩留まり**（反響・来場・次アポ・契約）は**実績日起算**です。「店舗・担当別反響」と同じ数字になります。

> 注意：今月はまだ途中なので、前の月と比べる材料にはしていません。

## 結果を見る（左の「分析の一覧」）
- 実行中の分析には「実行中」、終わったものには「完了」、失敗したものには「失敗」の印が付きます
- 押すと右に出ます。実行中なら進み具合（何をしているか、何分たったか）が出ます
- 一覧には、この画面を使える人全員の分析が並びます。ほかの人の分析も開けます（開くだけなら費用はかかりません）
- 削除できるのは、実行した本人と管理者だけです
- 失敗したときは理由が出ます。「この依頼文を左の欄に入れる」を押すと、同じ依頼文でやり直せます

「過去の定型分析」を開くと、以前のメニュー（反響推移・店舗別・媒体別）で保存した結果を読めます。

## 回数の上限
- 1人1日 **5回**まで（失敗も数えます。実行のたびに費用がかかるため）
- 自分の分析が実行中のあいだは、次の分析を始められません
- ほかの人の分析が混み合っているときは、少し待ってから実行してください

## 競合分析はどこへ行ったか
競合分析のレポートは、この画面から外しました。ヘッダーの「他社動向 → 競合分析」で読めます（だれでも開けます）。

[[画面:競合分析]]

> 要確認：分析の結果は、会議資料に使う前に、もとの画面の数字と見比べてください。母数が少ない店舗・担当者の率は、たまたまの差であることがあります。
```
