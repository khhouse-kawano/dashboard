import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../../db/pool';
import { logger } from '../../utils/logger';
import { verifySurveyLink } from './link';
import type { SurveyKind, SurveyLink } from './link';
import { cleanLine, cleanList, cleanObject, cleanText, jstStamp } from './clean';

/**
 * 面談アンケート（survey）のお客様の画面（v2.2.257。`interview_survey_public:<roll>`。⚠️ auth: 'none'）。
 *
 * ─────────────────────────────────────────────
 * お客様は、スタッフが出した QR から自分のスマホで開く。Dashboard にはログインしていない。
 * 代わりに、QR の URL の `t`（interview_survey:link が作る署名。7日間有効。link.ts）で、そのお客様1人分だけを読み書きできる。
 *
 * ⚠️⚠️ **お客様がアンケートを開けない・送れない事態を避ける**（利用者の指示）。
 *   - 署名が無い・合わない・期限切れでも、アンケートは開け、回答は保存する。
 *   - ただしその場合は「お客様情報の読み込み」と「お客様の記録（master_data・customers）の上書き」をしない。
 *     回答の行（before_interview・after_interview）だけを、URL の id で残す（スタッフが Dashboard で見られる）。
 * ⚠️ 書き込みの中身は旧 `/survey/api/`（サーバーに残っている index.php）の before_interview・after_interview と同じ。
 *   ⚠️ `/survey/api/` は projects/sync（before_interview_register）が使うので、サーバーに残したまま。
 * ⚠️ 流量の上限は middlewares/publicFormRateLimit.ts（保存だけ。店舗の Wi-Fi で同じ IP になるので、フォームより緩い）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** お客様の画面が使う master_data の列（旧 API は全列を返していた）。⚠️ 列名を SQL に埋め込むので、ここ以外の値を入れない */
const MASTER_COLUMNS = [
  'customer_contacts_name', 'customer_contacts_name_kana', 'customer_contacts_phone_number',
  'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'customer_contacts_birth_date',
  'customer_contacts_employment_type', 'customer_contacts_employer_name', 'customer_contacts_employer_address',
  'customer_contacts_years_of_service', 'customer_contacts_annual_income',
  'postal_code', 'full_address', 'current_contract_type', 'current_rent', 'budget',
  'house_hunting_motivation', 'inquiry_reason', 'planned_construction_site',
  'customer_desired_floor', 'customer_desired_period', 'customer_desired_estate', 'customer_desired_order',
] as const;

const FAMILY_KEYS = ['name', 'kana', 'attribute', 'birth'] as const;
const EMPLOYMENT_KEYS = ['name', 'type', 'address', 'years', 'income'] as const;

/** 署名が使えなかった理由（ログ用。⚠️ お客様の名前などはログに出さない） */
const linkFailure = (t: unknown): string => {
  const v = verifySurveyLink(t);
  return v.ok ? `kind:${v.link.k}` : v.reason;
};

/** そのアンケートの署名として正しいか。⚠️ 種類が違う署名（面談後の QR で面談前を送る など）は使わない */
const trustedLink = (t: unknown, kind: SurveyKind): SurveyLink | null => {
  const v = verifySurveyLink(t);
  return v.ok && v.link.k === kind ? v.link : null;
};

/**
 * お客様情報の読み込み（面談前アンケート・情報確認の初期値）。
 * 応答: { status: 'ok', name, master } ／ 新規のお客様は master: null ／
 *   署名が使えないときは { status: 'missing' | 'invalid' | 'expired' }（⚠️ 画面は止めずに空欄で進む）
 */
export const runSurveyPublicMaster = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const v = verifySurveyLink(body.t);
  if (!v.ok) return { status: v.reason };
  if (v.link.k !== 'before') return { status: 'invalid' };
  if (v.link.id === 'new') return { status: 'ok', name: '', master: null };
  const [customer] = await query<DynamicRow>('SELECT name FROM customers WHERE id = ? LIMIT 1', [v.link.id]);
  const [master] = await query<DynamicRow>(`SELECT ${MASTER_COLUMNS.join(', ')} FROM master_data WHERE id = ? LIMIT 1`, [v.link.id]);
  return { status: 'ok', name: customer ? String(customer.name ?? '') : '', master: master ?? null };
};

/**
 * 担当の一覧（面談前の新規の担当の pg_id・面談後の担当の選択肢）。⚠️ その店舗の名前だけ（署名は要らない）
 */
export const runSurveyPublicStaff = async (body: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
  const shop = cleanLine(body.shop, 100);
  if (shop === '') return [];
  return query<DynamicRow>('SELECT name, pg_id, shop, category, period FROM staff_list WHERE shop = ?', [shop]);
};

/**
 * 面談前アンケートの保存（旧 `/survey/api/` の before_interview）。
 *   1. before_interview に1行（⚠️ いつも残す）
 *   2. 署名が正しく、新規でなければ: customers の before_interview = 1、master_data の連絡先・希望を上書き（旧と同じ25列）
 */
export const runSurveyPublicBefore = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const link = trustedLink(body.t, 'before');
  const id = link ? link.id : cleanLine(body.id, 64) || 'new';
  const shop = link ? link.shop : cleanLine(body.shop, 100);
  const name = cleanLine(body.name, 100);
  const employment = cleanObject(body.employment, EMPLOYMENT_KEYS);
  const family = [1, 2, 3, 4].map((n) => JSON.stringify(cleanObject(body[`family_member_${n}`], FAMILY_KEYS)));
  const f = {
    medium: cleanList(body.medium, ', '), interest: cleanList(body.interest, ', '), opportunity: cleanList(body.opportunity, ', '),
    plan: cleanLine(body.plan, 200), period: cleanLine(body.period, 200), estate: cleanLine(body.estate, 200),
    area: cleanLine(body.area, 300), importance: cleanList(body.importance, ', '), budget: cleanLine(body.budget, 100),
    support: cleanList(body.support, ', '), demand: cleanText(body.demand, 2000), kana: cleanLine(body.kana, 100),
    phone: cleanLine(body.phone, 30), mail: cleanLine(body.mail, 200), mobile: cleanLine(body.mobile, 30),
    zip: cleanLine(body.zip, 10), address: cleanLine(body.address, 300), rent: cleanLine(body.rent, 50),
    birth: cleanLine(body.birth, 20), situation: cleanLine(body.situation, 100), staff: cleanLine(body.staff, 64),
  };

  const linked = await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO before_interview (id, name, shop, medium, interest, opportunity, plan, period, estate, area, importance, budget, support, demand,
         kana, phone, mail, mobile, zip, address, rent, birth, situation, family_member_1, family_member_2, family_member_3, family_member_4,
         employment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, shop, f.medium, f.interest, f.opportunity, f.plan, f.period, f.estate, f.area, f.importance, f.budget, f.support, f.demand,
        f.kana, f.phone, f.mail, f.mobile, f.zip, f.address, f.rent, f.birth, f.situation, ...family, JSON.stringify(employment), jstStamp()]
    );
    if (!link || id === 'new') return false;
    await tx.execute('UPDATE customers SET before_interview = 1 WHERE id = ?', [id]);
    // ⚠️ 旧と同じく、master_data は区切りに ','（before_interview は ', '）
    await tx.execute(
      `UPDATE master_data SET customer_contacts_name = ?, in_charge_user = ?, first_interviewed_date = ?, full_address = ?,
         customer_contacts_name_kana = ?, customer_contacts_phone_number = ?, customer_contacts_mobile_phone_number = ?,
         customer_contacts_email = ?, customer_contacts_birth_date = ?, customer_contacts_employment_type = ?,
         customer_contacts_employer_name = ?, customer_contacts_employer_address = ?, customer_contacts_years_of_service = ?,
         customer_contacts_annual_income = ?, postal_code = ?, current_contract_type = ?, current_rent = ?, budget = ?,
         house_hunting_motivation = ?, inquiry_reason = ?, planned_construction_site = ?, customer_desired_floor = ?,
         customer_desired_period = ?, customer_desired_estate = ?, customer_desired_order = ?
       WHERE id = ?`,
      [name, f.staff, jstStamp().slice(0, 10), f.address, f.kana, f.phone, f.mobile, f.mail, f.birth,
        employment.type, employment.name, employment.address, employment.years, employment.income,
        f.zip, f.situation, f.rent, f.budget,
        cleanList(body.opportunity, ','), cleanList(body.medium, ','), f.area, f.plan, f.period, f.estate, cleanList(body.interest, ','),
        id]
    );
    return true;
  });
  if (!linked && id !== 'new') logger.warn('[survey] 面談前アンケート: リンクの署名が使えないため、回答だけを保存しました', { id, shop, reason: linkFailure(body.t) });
  return { status: 'success', linked };
};

/**
 * 面談後アンケートの保存（旧 `/survey/api/` の after_interview）。
 *   1. after_interview に1行（⚠️ いつも残す）
 *   2. 署名が正しく、新規でなければ: customers の after_interview = 1
 */
export const runSurveyPublicAfter = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const link = trustedLink(body.t, 'after');
  const id = link ? link.id : cleanLine(body.id, 64) || 'new';
  const shop = link ? link.shop : cleanLine(body.shop, 100);
  const name = cleanLine(body.name, 100);

  const linked = await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO after_interview (id, dateStr, shop, name, phone, InterviewFeedback, confirmedAllItems, desireOwnership, priorityCondition,
         ourCompanyFirstChoice, otherCompaniesInterested, staffName, staffHospitality, proposalFeedback, moreInfoOrImprovements,
         nextConsultationRequests, changeStaffRequested)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, jstStamp(), shop, name, cleanList(body.toldInformation, ', '), cleanLine(body.desired, 200), cleanLine(body.condition, 200),
        cleanLine(body.importance, 200), cleanLine(body.priority, 200), cleanText(body.rival, 1000), cleanLine(body.staff, 100),
        cleanLine(body.staffSatisfied, 200), cleanLine(body.interviewSatisfied, 200), cleanText(body.improvement, 2000),
        cleanText(body.demand, 2000), cleanLine(body.staffChange, 200)]
    );
    if (!link || id === 'new') return false;
    await tx.execute('UPDATE customers SET after_interview = 1 WHERE id = ?', [id]);
    return true;
  });
  if (!linked && id !== 'new') logger.warn('[survey] 面談後アンケート: リンクの署名が使えないため、回答だけを保存しました', { id, shop, reason: linkFailure(body.t) });
  return { status: 'success', linked };
};
