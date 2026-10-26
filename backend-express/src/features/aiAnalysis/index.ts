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

/** 1人1日の実行上限（v2.2.218 で 5 → 1。費用が大きかったため。2026-10-26 の指示）。⚠️ 失敗も数える */
export const DAILY_LIMIT = 1;
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
