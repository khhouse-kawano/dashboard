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
