import { query } from '../../db/pool';
import { issueSurveyLink } from './link';
import type { SurveyKind } from './link';
import { cleanLine } from './clean';
import type { DynamicRow } from './clean';

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

/**
 * 反響日（master_data の step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99）を日付にする。
 * ⚠️ 文字の列で「2026/11/04」と「2026-11-04」が混ざっているため、両方を読む（文字のまま並べると新しい順にならない）
 */
const REGISTER_DATE = `COALESCE(
    STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'),
    STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'))`;

/**
 * 検索の一覧（旧 survey_list と同じ列名 name・id・shop・register・staff）。
 *
 * ⚠️⚠️ v2.2.270: `customers` 表ではなく `master_data`（注文の顧客DB）から読む。
 *   ⚠️ `customers` は 2026-07-22 を最後に更新されておらず、7月以降の反響が検索に出ていなかった（2026-11-16 の指示）。
 * ⚠️ 顧客DBに表示している顧客だけ（show_dashboard = 1）。個人情報を削除した顧客（delete_dashboard = 1）は出さない。
 * ⚠️ register は 'YYYY/MM/DD' にそろえて返す（survey の画面がそのまま表に出すため。旧 customers と同じ形）。新しい順。
 */
export const runSurveyCustomers = async (): Promise<Record<string, unknown>[]> =>
  query<DynamicRow>(
    `SELECT COALESCE(customer_contacts_name, '') AS name,
            id,
            COALESCE(in_charge_store, '') AS shop,
            COALESCE(DATE_FORMAT(${REGISTER_DATE}, '%Y/%m/%d'), '') AS register,
            COALESCE(in_charge_user, '') AS staff
       FROM master_data
      WHERE show_dashboard = 1 AND COALESCE(delete_dashboard, 0) = 0
      ORDER BY ${REGISTER_DATE} IS NULL, ${REGISTER_DATE} DESC, id DESC`
  );

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
  const { token, exp } = issueSurveyLink({ k: kind, id });
  return { status: 'success', token, exp };
};
