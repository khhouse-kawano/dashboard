import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { safeAddressList } from '../campaignForm/mail';
import { eventTitleOf, findCalendarEvent, isDate, listCalendarEvents, type CalendarEvent } from './calendar';
import { FIELD_DEFS, normalizeSettings, type FieldSettings } from './fields';

/**
 * 集客イベント → フォーム作成（v2.2.298）の社内の画面から使う処理（request event_form）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 使えるのは反響一覧を開けるスタッフ全員（auth staff。⚠️ 権限で絞らない＝2026-11-25 の指示）。
 * ⚠️ 作ったフォームは消さない（URL を配った後に消すと、開いた人が何も分からなくなる）。止めるときは active を 0 にする。
 * ⚠️ 通知先は safeAddressList を通した形で保存する（形の悪いアドレスは落とす）。
 * ⚠️ v2.2.299 イベントはイベントカレンダー（全社・表示中）から選ぶ。新しいイベントはカレンダーに1行入れてから使う（calendar.ts）。
 *   ⚠️ event_form.title は「開始日_イベント名」の写し（反響一覧の名前）。⚠️ あとでカレンダー側の名前・日付を直しても、ここは変わらない。
 *   ⚠️ カレンダーの url が空なら、フォームの URL を入れる（2026-11-25 の指示）。
 * ─────────────────────────────────────────────
 */

/** 公開フォームの URL（番号を付けて使う）。⚠️ 置き場所は ① の public_html/form/ */
export const EVENT_FORM_URL_BASE = 'https://khg-marketing.info/form/';

interface FormRow extends RowDataPacket {
  id: number;
  title: string;
  calendar_id: number | null;
  mail_to: string;
  mail_cc: string;
  fields: string | null;
  active: number;
  created_by: string;
  /** ⚠️ mysql2 は DATETIME を Date で返す（stamp で文字にする） */
  created_at: Date | string;
  updated_by: string;
  updated_at: Date | string;
}

export interface EventFormItem {
  id: number;
  url: string;
  title: string;
  /** ⚠️ v2.2.298 で作ったフォームは null（編集でイベントを選び直す） */
  calendar_id: number | null;
  mail_to: string;
  mail_cc: string;
  fields: FieldSettings;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface AdminResult {
  httpStatus: number;
  body: unknown;
}

const fail = (message: string, httpStatus = 400): AdminResult => ({ httpStatus, body: { status: 'error', message } });

const text = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : '');

/** DATETIME を画面向けの 'YYYY-MM-DD HH:MM' にする（⚠️ mysql2 は Date で返す） */
const stamp = (v: unknown): string => {
  if (!(v instanceof Date)) return typeof v === 'string' ? v.slice(0, 16) : '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}`;
};

const urlOf = (id: number): string => `${EVENT_FORM_URL_BASE}${id}/`;

const toItem = (r: FormRow): EventFormItem => ({
  id: r.id,
  url: urlOf(r.id),
  title: r.title,
  calendar_id: r.calendar_id,
  mail_to: r.mail_to,
  mail_cc: r.mail_cc,
  fields: normalizeSettings(r.fields),
  active: r.active === 1,
  created_by: r.created_by,
  created_at: stamp(r.created_at),
  updated_by: r.updated_by,
  updated_at: stamp(r.updated_at),
});

/** 一覧（roll list）。作ったフォーム・入力欄の定義・選べるイベント（カレンダーの全社・表示中）を返す */
export const runEventFormList = async (): Promise<AdminResult> => {
  const [forms, events] = await Promise.all([
    query<FormRow>('SELECT * FROM event_form ORDER BY id DESC'),
    listCalendarEvents(),
  ]);
  return {
    httpStatus: 200,
    body: {
      status: 'success',
      forms: forms.map(toItem),
      events,
      // ⚠️ defaultRequired は新しいフォームの「必須」の初期値（画面はこれで初期化する。写さない）
      fields: FIELD_DEFS.map(({ key, label, kind, options, fixed, defaultRequired }) => ({
        key, label, kind, options: options ?? [], fixed: fixed === true, defaultRequired: fixed === true || defaultRequired === true,
      })),
    },
  };
};

/**
 * 使うイベントを決める。⚠️ calendar_id があれば今あるイベント、無ければ new_title・new_start・new_end でカレンダーに1行入れる。
 * ⚠️ カレンダーへの登録は calendar_add.php と同じ形（category・note は空、実績の数は 0）。
 */
const resolveEvent = async (body: Record<string, unknown>): Promise<CalendarEvent | string> => {
  if (body.calendar_id !== undefined && body.calendar_id !== null && body.calendar_id !== '') {
    return (await findCalendarEvent(body.calendar_id)) ?? 'このイベントはイベントカレンダーに見つかりませんでした（全社・表示中のものだけ選べます）。';
  }
  const title = text(body.new_title, 200);
  const startDate = text(body.new_start, 10);
  const endDate = text(body.new_end, 10);
  if (title === '') return 'イベントを選ぶか、新しいイベントの名前を入力してください。';
  if (!isDate(startDate) || !isDate(endDate)) return '開始日と終了日を入力してください。';
  if (endDate < startDate) return '終了日は開始日より後の日にしてください。';
  const result = await execute(
    `INSERT INTO event_calendar (startDate, endDate, category, title, shop, flag, \`new\`, reserved, registered, \`next\`, note, url)
     VALUES (?, ?, '', ?, 'khg', 1, 0, 0, 0, 0, '', '')`,
    [startDate, endDate, title]
  );
  return { id: result.insertId, title, startDate, endDate, url: '' };
};

/**
 * 作成・更新（roll save）。⚠️ id があれば更新、無ければ作成（番号は AUTO_INCREMENT）。
 * ⚠️ fields は JSON の文字列で受ける（① を通ると空の {} が [] に変わるため。normalizeSettings はどちらも受ける）。
 * ⚠️ 入力の確認はカレンダーに書く前に済ませる（誤りでカレンダーにだけ行が残らないように）。
 */
export const runEventFormSave = async (body: Record<string, unknown>, staff: AuthenticatedStaff | null): Promise<AdminResult> => {
  // ⚠️ 宛先は text() を通さない（改行を消すと「a@x.jp」「b@y.jp」の2行がつながって両方落ちる）。改行は safeAddressList が区切りにする
  const raw = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 1000) : '');
  const to = safeAddressList(raw(body.mail_to));
  if (to.length === 0) return fail('反響の通知先のメールアドレスを入力してください。');
  const cc = safeAddressList(raw(body.mail_cc));

  const id = Number(body.id);
  const isUpdate = Number.isInteger(id) && id > 0;
  if (isUpdate && (await query<RowDataPacket>('SELECT id FROM event_form WHERE id = ?', [id])).length === 0) {
    return fail('このフォームは見つかりませんでした。一覧を読み直してください。', 404);
  }

  const event = await resolveEvent(body);
  if (typeof event === 'string') return fail(event);

  const fields = JSON.stringify(normalizeSettings(body.fields));
  const active = body.active === false || body.active === 0 || body.active === '0' ? 0 : 1;
  const who = staff?.name ?? '';
  const values = [eventTitleOf(event), event.id, to.join(', '), cc.join(', '), fields, active];

  let formId = id;
  if (isUpdate) {
    await execute(
      `UPDATE event_form SET title = ?, calendar_id = ?, mail_to = ?, mail_cc = ?, fields = ?, active = ?, updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [...values, who, id]
    );
  } else {
    const result = await execute(
      `INSERT INTO event_form (title, calendar_id, mail_to, mail_cc, fields, active, created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())`,
      [...values, who, who]
    );
    formId = result.insertId;
  }

  // ⚠️ カレンダーの url が空のときだけフォームの URL を入れる（⚠️ 既に入っている特設ページなどは上書きしない）
  if (event.url === '') {
    await execute(`UPDATE event_calendar SET url = ? WHERE id = ? AND (url IS NULL OR url = '')`, [urlOf(formId), event.id]);
  }
  return { httpStatus: 200, body: { status: 'success', id: formId } };
};
