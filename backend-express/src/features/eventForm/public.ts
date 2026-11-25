import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, type SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { findCalendarEvent, formatEventDate } from './calendar';
import { FIELD_DEFS, normalizeSettings, type FieldDef, type FieldKey } from './fields';
import { sendEntryNotice, sendEntryThanks } from './mail';

/**
 * イベントの予約フォーム（v2.2.298）の公開側。⚠️ 認証なし（社外の誰でも叩ける）。
 *
 *   event_form_public … フォームの設定（イベント名・表示する欄）。⚠️ 通知先は返さない
 *   event_form_entry  … 申し込みを受けて event_db に1行入れ、メールを2通送る
 *
 * ─────────────────────────────────────────────
 * ⚠️ 公開フォーム（https://khg-marketing.info/form/<番号>/）は api.khg-marketing.info の ② へ直接送る（① は通らない）。
 * ⚠️ 防御：IP ごとの回数制限（publicFormRateLimit の GUARDED_REQUESTS）・全項目の長さ制限・ロボットよけの隠れた欄（website）。
 * ⚠️⚠️ イベント名と通知先は必ず event_form から取る（送られてきた値を使うと、他のイベントの一覧に行を入れられる）。
 * ⚠️ 表示していない欄の値は受けない（作った人が聞かないと決めた欄に値が入らないように）。
 * ⚠️ 申し込みの id は ② が作る（ef<フォーム番号>_<16桁>。event_db.id は UNIQUE）。
 * ─────────────────────────────────────────────
 */

interface FormRow extends RowDataPacket {
  id: number;
  title: string;
  calendar_id: number | null;
  mail_to: string;
  mail_cc: string;
  fields: string | null;
  active: number;
}

export interface PublicResult {
  httpStatus: number;
  body: unknown;
}

const NOT_FOUND: PublicResult = { httpStatus: 404, body: { status: 'error', message: 'このフォームは見つかりませんでした。URL をご確認ください。' } };
const CLOSED: PublicResult = { httpStatus: 410, body: { status: 'closed', message: 'このイベントの受付は終了しました。' } };

/**
 * 画面とメールに出すイベント名と開催日。
 * ⚠️ 名前は event_db.title の先頭の開催日（2026-12-06_）を外したもの。
 * ⚠️ v2.2.299 開催日はイベントカレンダーの開始日〜終了日（2026-11-25 の指示）。
 *   ⚠️ カレンダーに無い（v2.2.298 のフォーム・非表示にした）ときは名前の先頭の日付だけ。
 */
const headingOf = async (form: FormRow): Promise<{ name: string; date: string }> => {
  const m = /^(\d{4}-\d{2}-\d{2})_(.+)$/.exec(form.title);
  const name = m ? m[2] : form.title;
  const event = form.calendar_id === null ? null : await findCalendarEvent(form.calendar_id);
  return { name, date: event ? formatEventDate(event.startDate, event.endDate) : formatEventDate(m ? m[1] : '') };
};

const loadForm = async (value: unknown): Promise<FormRow | null> => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await query<FormRow>('SELECT id, title, calendar_id, mail_to, mail_cc, fields, active FROM event_form WHERE id = ?', [id]);
  return rows[0] ?? null;
};

/** 表示する欄（定義の順） */
const shownFields = (form: FormRow): Array<FieldDef & { required: boolean }> => {
  const settings = normalizeSettings(form.fields);
  return FIELD_DEFS.filter((d) => settings[d.key].show).map((d) => ({ ...d, required: settings[d.key].required }));
};

/** フォームの設定（event_form_public）。⚠️ mail_to / mail_cc は返さない */
export const runEventFormPublic = async (body: Record<string, unknown>): Promise<PublicResult> => {
  const form = await loadForm(body.id);
  if (!form) return NOT_FOUND;
  if (form.active !== 1) return CLOSED;
  const { name, date } = await headingOf(form);
  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      form: {
        id: form.id,
        name,
        date,
        fields: shownFields(form).map(({ key, label, kind, options, required, placeholder, autocomplete }) => ({
          key, label, kind, options: options ?? [], required, placeholder: placeholder ?? '', autocomplete: autocomplete ?? '',
        })),
      },
    },
  };
};

// ---------------------------------------------------------------------------
// 申し込み
// ---------------------------------------------------------------------------

/** 全角の数字・ハイフン・空白を半角に（電話・郵便番号・人数） */
const toHalfWidth = (s: string): string =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[－ー−‐]/g, '-').replace(/　/g, ' ');

const clean = (v: unknown, max: number): string =>
  (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '');

/** 改行を残す（備考だけ）。⚠️ 改行以外の制御文字は落とす */
const cleanMultiline = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim().slice(0, max) : '');

const MAIL_PATTERN = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/**
 * 1欄を検査して保存する値にする。⚠️ 誤りなら { error }。
 * ⚠️ 電話・郵便番号は数字だけにそろえる（反響一覧・顧客DB への取り込みと同じ形）。
 */
const valueOf = (d: FieldDef & { required: boolean }, raw: unknown): { value: string } | { error: string } => {
  let value = d.kind === 'textarea' ? cleanMultiline(raw, d.max) : clean(raw, d.max);
  if (d.kind === 'tel' || d.kind === 'zip' || d.kind === 'number') value = toHalfWidth(value).replace(/[-\s()（）]/g, '');

  if (value === '') return d.required ? { error: `${d.label}を${d.kind === 'radio' ? '選んで' : '入力して'}ください。` } : { value };

  switch (d.kind) {
    case 'tel':
      if (!/^\d{10,11}$/.test(value)) return { error: `${d.label}は10〜11桁の数字で入力してください。` };
      break;
    case 'email':
      if (!MAIL_PATTERN.test(value)) return { error: `${d.label}の形が正しくありません。` };
      break;
    case 'zip':
      if (!/^\d{7}$/.test(value)) return { error: `${d.label}は7桁の数字で入力してください。` };
      break;
    case 'number':
      if (!/^\d{1,2}$/.test(value)) return { error: `${d.label}は数字で入力してください。` };
      value = String(Number(value));
      break;
    case 'radio':
      if (!(d.options ?? []).includes(value)) return { error: `${d.label}を選んでください。` };
      break;
    default:
      break;
  }
  return { value };
};

/** 受付日時（YYYY-MM-DD HH:MM:SS）。⚠️ コンテナは TZ=Asia/Tokyo 前提（event/reservation.ts と同じ） */
const nowForDb = (): string => {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/**
 * 申し込み（event_form_entry）。
 * ⚠️ 保存できたあとのメールの失敗では 200 を返す（失敗を返すと本人が送り直して二重になる）。
 */
export const runEventFormEntry = async (body: Record<string, unknown>): Promise<PublicResult> => {
  // ⚠️ ロボットよけ：人には見えない欄。入っていたら保存せずに成功の形で返す（ロボットに気づかせない）
  if (clean(body.website, 200) !== '') return { httpStatus: 200, body: { status: 'ok' } };

  const form = await loadForm(body.id);
  if (!form) return NOT_FOUND;
  if (form.active !== 1) return CLOSED;

  const fields = shownFields(form);
  const record: Partial<Record<FieldKey, string>> = {};
  for (const d of fields) {
    const result = valueOf(d, body[d.key]);
    if ('error' in result) return { httpStatus: 400, body: { status: 'error', message: result.error, field: d.key } };
    record[d.key] = result.value;
  }

  const id = `ef${form.id}_${randomBytes(8).toString('hex')}`;
  const receivedAt = nowForDb();
  const columns = ['id', 'title', 'reserved_at', ...Object.keys(record)];
  const values: SqlParam[] = [id, form.title, receivedAt, ...Object.values(record).map((v) => (v === '' ? null : v))];

  try {
    await execute(
      `INSERT INTO event_db (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
  } catch (error) {
    // ⚠️ 例外の内容を応答に含めない（SQL や列名が漏れる）
    logger.error(`event_form_entry の保存に失敗しました form=${form.id}: ${(error as Error).message}`);
    return { httpStatus: 500, body: { status: 'error', message: 'お申し込みの登録に失敗しました。時間をおいて再度お試しください。' } };
  }

  const { name: eventName, date: eventDate } = await headingOf(form);
  const mailData = {
    formId: form.id,
    eventName,
    eventDate,
    name: record.name ?? '',
    mail: record.mail ?? '',
    // ⚠️ メールに出す内容（聞いた欄のうち入力のあるものだけ。人数は「2人」）
    lines: fields.filter((d) => (record[d.key] ?? '') !== '')
      .map((d) => ({ label: d.label, value: d.kind === 'number' ? `${record[d.key]}人` : record[d.key] ?? '' })),
    receivedAt,
  };
  const [mailSent] = await Promise.all([sendEntryThanks(mailData), sendEntryNotice(mailData, form.mail_to, form.mail_cc)]);
  return { httpStatus: 200, body: { status: 'ok', mailSent } };
};
