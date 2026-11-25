import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { safeAddressList } from '../campaignForm/mail';
import { FIELD_DEFS, normalizeSettings, type FieldSettings } from './fields';

/**
 * 集客イベント → フォーム作成（v2.2.298）の社内の画面から使う処理（request event_form）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 使えるのは反響一覧を開けるスタッフ全員（auth staff。⚠️ 権限で絞らない＝2026-11-25 の指示）。
 * ⚠️ 作ったフォームは消さない（URL を配った後に消すと、開いた人が何も分からなくなる）。止めるときは active を 0 にする。
 * ⚠️ 通知先は safeAddressList を通した形で保存する（形の悪いアドレスは落とす）。
 * ─────────────────────────────────────────────
 */

/** 公開フォームの URL（番号を付けて使う）。⚠️ 置き場所は ① の public_html/form/ */
export const EVENT_FORM_URL_BASE = 'https://khg-marketing.info/form/';

interface FormRow extends RowDataPacket {
  id: number;
  title: string;
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

interface TitleRow extends RowDataPacket {
  title: string;
}

export interface EventFormItem {
  id: number;
  url: string;
  title: string;
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

const toItem = (r: FormRow): EventFormItem => ({
  id: r.id,
  url: `${EVENT_FORM_URL_BASE}${r.id}/`,
  title: r.title,
  mail_to: r.mail_to,
  mail_cc: r.mail_cc,
  fields: normalizeSettings(r.fields),
  active: r.active === 1,
  created_by: r.created_by,
  created_at: stamp(r.created_at),
  updated_by: r.updated_by,
  updated_at: stamp(r.updated_at),
});

/**
 * 一覧（roll list）。作ったフォーム・入力欄の定義・選べるイベント名を返す。
 * ⚠️ イベント名は反響一覧と同じく event_db.title から（⚠️ フォームだけで作ったまだ予約の無いイベント名も足す）。
 */
export const runEventFormList = async (): Promise<AdminResult> => {
  const [forms, titles] = await Promise.all([
    query<FormRow>('SELECT * FROM event_form ORDER BY id DESC'),
    query<TitleRow>(
      `SELECT title FROM event_db WHERE title IS NOT NULL AND title <> ''
       UNION SELECT title FROM event_form`
    ),
  ]);
  return {
    httpStatus: 200,
    body: {
      status: 'success',
      forms: forms.map(toItem),
      // ⚠️ 開催日の付いた名前（2026-12-06_○○）が新しい順に並ぶよう、文字の降順
      titles: [...new Set(titles.map((t) => t.title))].sort((a, b) => b.localeCompare(a, 'ja')),
      // ⚠️ defaultRequired は新しいフォームの「必須」の初期値（画面はこれで初期化する。写さない）
      fields: FIELD_DEFS.map(({ key, label, kind, options, fixed, defaultRequired }) => ({
        key, label, kind, options: options ?? [], fixed: fixed === true, defaultRequired: fixed === true || defaultRequired === true,
      })),
    },
  };
};

/**
 * 作成・更新（roll save）。⚠️ id があれば更新、無ければ作成（番号は AUTO_INCREMENT）。
 * ⚠️ fields は JSON の文字列で受ける（① を通ると空の {} が [] に変わるため。normalizeSettings はどちらも受ける）。
 */
export const runEventFormSave = async (body: Record<string, unknown>, staff: AuthenticatedStaff | null): Promise<AdminResult> => {
  const title = text(body.title, 255);
  if (title === '') return fail('イベント名を選ぶか入力してください。');

  // ⚠️ 宛先は text() を通さない（改行を消すと「a@x.jp」「b@y.jp」の2行がつながって両方落ちる）。改行は safeAddressList が区切りにする
  const raw = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 1000) : '');
  const to = safeAddressList(raw(body.mail_to));
  if (to.length === 0) return fail('反響の通知先のメールアドレスを入力してください。');
  const cc = safeAddressList(raw(body.mail_cc));

  const fields = JSON.stringify(normalizeSettings(body.fields));
  const active = body.active === false || body.active === 0 || body.active === '0' ? 0 : 1;
  const who = staff?.name ?? '';
  const id = Number(body.id);

  if (Number.isInteger(id) && id > 0) {
    const result = await execute(
      `UPDATE event_form SET title = ?, mail_to = ?, mail_cc = ?, fields = ?, active = ?, updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, to.join(', '), cc.join(', '), fields, active, who, id]
    );
    if (result.affectedRows === 0) return fail('このフォームは見つかりませんでした。一覧を読み直してください。', 404);
    return { httpStatus: 200, body: { status: 'success', id } };
  }

  const result = await execute(
    `INSERT INTO event_form (title, mail_to, mail_cc, fields, active, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW())`,
    [title, to.join(', '), cc.join(', '), fields, active, who, who]
  );
  return { httpStatus: 200, body: { status: 'success', id: result.insertId } };
};
