import type { RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';
import { logger } from '../utils/logger';

/**
 * 個人情報削除（v2.2.227。② だけ）。
 *
 * ─────────────────────────────────────────────
 * 2026-10-29 の指示:
 *   ・顧客DB（InformationEdit / InformationEditKaeru / InformationEditResale のヘッダー）… 氏名・電話番号・メールアドレス・住所を
 *     アスタリスク8個にして show_dashboard = 0（privacy_erase:master）
 *   ・反響一覧（ListOrder / ListKaeru / ListResale の各行）… 同じ列をアスタリスクにして sync = 1（privacy_erase:inquiry）
 *   ・対象の列は「同じ種類の列も含める」（ふりがな・2人目の氏名・固定電話・郵便番号も）。押せるのはその画面を使える全員
 *   ・2026-10-29 追加: 注文の顧客DB（InformationEdit・master_data）にも
 *   ・v2.2.229: 顧客DB は show_dashboard = 0 をやめ、delete_dashboard = 1（削除済み）にする。
 *     顧客DB・顧客詳細には返さず、集計（歩留まり）には数える。集計の一覧では「削除済み顧客」と出す（画面の utils/deletedCustomer.ts）
 *
 * ⚠️⚠️ **元に戻せない。** 画面は「元に戻せません」の確認を出してから送る。
 * ⚠️ 値が入っている列だけ伏せる（空の列に入れると、2人目の氏名などが居るように見えるため）。
 * ⚠️ 誰がいつ消したかを残す: 顧客DB は master_data_log（顧客の変更履歴）、反響は ② のログ（反響には履歴の表が無い）。
 *   ⚠️ 履歴にも消した人の名前と日時だけを書き、消した値は書かない。
 * ⚠️ 表の名前は下の許可リストからだけ選ぶ（リクエストの値を SQL に入れない）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface PrivacyResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const MASK = '********';

/** 顧客DB（事業区分 → 表） */
const MASTER_TABLES: Record<string, string> = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
};
const MASTER_COLUMNS = [
  'customer_contacts_name', 'customer_contacts_name_2', 'customer_contacts_name_kana', 'customer_contacts_name_kana_2',
  'customer_contacts_phone_number', 'customer_contacts_mobile_phone_number',
  'customer_contacts_email',
  'full_address',
];

/** 反響（事業区分 → 表） */
const INQUIRY_TABLES: Record<string, string> = {
  order: 'inquiry_customer',
  spec: 'inquiry_customer_kaeru',
  used: 'inquiry_customer_resale',
};
const INQUIRY_COLUMNS = [
  'first_name', 'last_name', 'first_name_kana', 'last_name_kana',
  'mobile', 'landline',
  'mail',
  'zip', 'pref', 'city', 'town', 'street', 'building',
];

export const MASTER_CATEGORIES = Object.keys(MASTER_TABLES);
export const INQUIRY_CATEGORIES = Object.keys(INQUIRY_TABLES);

const fail = (httpStatus: number, message: string): PrivacyResult => ({ httpStatus, body: { status: 'error', message } });

/** 値が入っている列だけ伏せる SET 句 */
const maskSets = (columns: string[]): string =>
  columns.map((c) => `\`${c}\` = IF(\`${c}\` IS NULL OR \`${c}\` = '', \`${c}\`, '${MASK}')`).join(', ');

const idOf = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');

/** 'YYYY/MM/DD HH:mm'（日本時間。master_data_log の updated_at と同じ形） */
const nowForLog = (): string => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
};

/** 顧客DB: body = { id }（master_data_* の id） */
export const runPrivacyEraseMaster = async (staff: AuthenticatedStaff, category: string, body: Record<string, unknown>): Promise<PrivacyResult> => {
  const table = MASTER_TABLES[category];
  const id = idOf(body.id);
  if (!table) return fail(400, '事業区分が正しくありません');
  if (id === '' || id === 'new') return fail(400, '顧客IDがありません');

  const done = await withTransaction(async (tx) => {
    const rows = await tx.query<DynamicRow>(`SELECT id FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
    if (rows.length === 0) return false;
    // ⚠️ v2.2.229: show_dashboard は変えない（集計の歩留まりに数え続ける）。delete_dashboard = 1 で顧客DB・顧客詳細から外す
    await tx.execute(`UPDATE ${table} SET ${maskSets(MASTER_COLUMNS)}, delete_dashboard = 1 WHERE id = ?`, [id]);
    // ⚠️ log は JSON でないと入らない（CHECK json_valid）。資金計画書の書き戻しと同じく source と columns の形。⚠️ 値は書かない
    // ⚠️ source = 'privacy_erase' は 2026-10-29_master_delete_dashboard.sql が v2.2.227〜228 の削除分を探すのに使う。変えないこと
    await tx.execute(
      'INSERT INTO master_data_log (id, customer, staff, updated_at, log) VALUES (?, ?, ?, ?, ?)',
      [id, MASK, staff.name, nowForLog(), JSON.stringify({ source: 'privacy_erase', columns: [...MASTER_COLUMNS, 'delete_dashboard'], note: `個人情報削除（${MASK} にして削除済み）` })]
    );
    return true;
  });
  if (!done) return fail(404, '顧客が見つかりません');
  logger.info(`privacy_erase:master ${category} id=${id} by=${staff.name}`);
  return { httpStatus: 200, body: { status: 'success', mask: MASK } };
};

/** 反響: body = { inquiry_id }。応答の columns は伏せた列（画面がその行を書き換えるため） */
export const runPrivacyEraseInquiry = async (staff: AuthenticatedStaff, category: string, body: Record<string, unknown>): Promise<PrivacyResult> => {
  const table = INQUIRY_TABLES[category];
  const inquiryId = idOf(body.inquiry_id);
  if (!table) return fail(400, '事業区分が正しくありません');
  if (inquiryId === '') return fail(400, '反響IDがありません');

  const row = await withTransaction(async (tx) => {
    const rows = await tx.query<DynamicRow>(`SELECT inquiry_id FROM ${table} WHERE inquiry_id = ? FOR UPDATE`, [inquiryId]);
    if (rows.length === 0) return null;
    await tx.execute(`UPDATE ${table} SET ${maskSets(INQUIRY_COLUMNS)}, sync = 1 WHERE inquiry_id = ?`, [inquiryId]);
    const after = await tx.query<DynamicRow>(`SELECT ${INQUIRY_COLUMNS.map((c) => `\`${c}\``).join(', ')}, sync FROM ${table} WHERE inquiry_id = ?`, [inquiryId]);
    return after[0] ?? null;
  });
  if (!row) return fail(404, '反響が見つかりません');
  logger.info(`privacy_erase:inquiry ${category} inquiry_id=${inquiryId} by=${staff.name}`);
  return { httpStatus: 200, body: { status: 'success', row } };
};
