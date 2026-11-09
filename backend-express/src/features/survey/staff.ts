import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { issueSurveyLink } from './link';
import type { SurveyKind } from './link';
import { cleanLine } from './clean';

/**
 * 面談アンケート（survey。khg-marketing.info/survey/）のスタッフの画面（v2.2.257。`interview_survey:<roll>`。auth: 'staff'）。
 *
 * ─────────────────────────────────────────────
 * 移植元: 旧 API（`/dashboard/api/` の demand 形式。backup/back/20260625/api/actions/）
 *   survey_list → interview_survey:customers ／ staff_list → interview_survey:staff ／ shop_list → 今ある `shop_list` をそのまま使う
 * ⚠️ 旧 API は画面に書いた固定の合い言葉だけで通していた（実質、誰でも読めた）。
 *   ここは Dashboard のトークンで通す（survey は Dashboard と同じ khg-marketing.info にあり、ログイン中のトークンを読める）。
 * ⚠️ 返す項目は survey が使うものだけ（旧 API は staff_list の全列だった）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 検索の一覧（旧 survey_list と同じ列・同じ並び） */
export const runSurveyCustomers = async (): Promise<Record<string, unknown>[]> =>
  query<DynamicRow>('SELECT name, id, shop, register, staff FROM customers ORDER BY register DESC');

/** 担当の一覧（旧 staff_list の、survey が使う列だけ） */
export const runSurveyStaff = async (): Promise<Record<string, unknown>[]> =>
  query<DynamicRow>('SELECT id, name, pg_id, shop, category, period FROM staff_list');

/**
 * お客様用リンクの署名を作る（QR を出すとき）。
 * body: kind（before／after）・id（お客様の id。新規は 'new'）・shop
 */
export const runSurveyLink = (body: Record<string, unknown>): Record<string, unknown> => {
  const kind = body.kind === 'before' || body.kind === 'after' ? (body.kind as SurveyKind) : null;
  const id = cleanLine(body.id, 64);
  const shop = cleanLine(body.shop, 100);
  if (!kind || id === '' || shop === '') return { status: 'error', message: 'アンケートの種類・お客様・店舗を指定してください。' };
  const { token, exp } = issueSurveyLink({ k: kind, id, shop });
  return { status: 'success', token, exp };
};
