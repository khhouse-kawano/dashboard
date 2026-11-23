import type { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../db/pool';

/**
 * 架電ステータス・架電アクションの選択肢（call_status）と、インサイドセールスの管理店舗（staff_list.managed_shops）。v2.2.293 新規。
 *
 * ─────────────────────────────────────────────
 *   call_status_options … 事業ごとの選択肢（全員。顧客DB の「架電状況」の絞り込み・顧客情報の架電ステータス／アクション）
 *   call_status_admin   … 管理画面の一覧（選択肢すべて・インサイドセールスの担当者・注文事業の店舗）
 *   call_status_save    … 選択肢の追加・編集（名前・種類・事業・表示・並び順）
 *   inside_staff_save   … インサイドセールスの担当者の在籍／退職と管理店舗
 *
 *   画面: frontend/src/components/header/system/CallStatusSettings.tsx（ヘッダーの「システム管理 → 架電ステータス」）
 *         frontend/src/components/database/callStatusOptions.ts（顧客DB・TableCall.tsx が選択肢を読む）
 *   表  : backend/scripts/sql/2026-11-23_update_log_2.2.293.sql
 *
 * ⚠️⚠️ 管理の3つは **Master と insideSales だけ**。registry.ts で `auth: 'staff'` のうえ CALL_STATUS_AUTHORITY を確かめる。
 * ⚠️ 列名は category ではなく kind（② のゲートウェイが本文の category を振り分けの鍵に使うため）。
 * ⚠️ 選択肢の名前は、顧客の call_status・架電記録の action にそのまま入る文字列。
 *   ⚠️ 名前を変えても、すでに入っている顧客の値は変わらない（画面はその値を「現在の値」として残して出す）。
 * ⚠️ 消す操作は作らない（表示しない＝flag 0 にする）。顧客に入っている値の意味が分からなくなるため。
 * ─────────────────────────────────────────────
 */

export const CALL_STATUS_AUTHORITY = ['Master', 'insideSales'];

const KINDS = ['status', 'action'] as const;
const DIVISIONS = ['order', 'spec', 'used', 'all'] as const;
const STAFF_STATUSES = ['在籍', '退職'];
/** staff_list.shop の値（インサイドセールスの担当者） */
const INSIDE_SALES_SHOP = 'インサイドセールス';
const NAME_MAX = 32;

interface OptionRow extends RowDataPacket { kind: string; name: string }
interface CallStatusRow extends RowDataPacket {
  no: number; kind: string; name: string; division: string; flag: number; sort: number; updated_at: string | null;
}
interface InsideStaffRow extends RowDataPacket { id: number; name: string; status: string; managed_shops: string | null }
interface ShopRow extends RowDataPacket { shop: string }

export interface CallStatusResult { httpStatus: number; body: Record<string, unknown> }

const ok = (body: Record<string, unknown>): CallStatusResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
const bad = (message: string, httpStatus = 400): CallStatusResult => ({ httpStatus, body: { status: 'error', message } });

/** 制御文字を落として前後の空白を除く */
const text = (value: unknown): string =>
  String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim();

/**
 * 今の年度（staff_list.period）。⚠️ 6月始まり（1〜5月はその年、6月以降は翌年）。
 * ⚠️ 画面の EditStaff.tsx の thisYear と同じ。⚠️ 本番の ② は Asia/Tokyo。
 */
export const currentPeriod = (now = new Date()): string =>
  String(now.getMonth() <= 4 ? now.getFullYear() : now.getFullYear() + 1);

/** managed_shops（JSON 配列の文字列）を読む。⚠️ 読めない・配列でないときは [] */
const parseShops = (v: string | null): string[] => {
  try {
    const parsed: unknown = v ? JSON.parse(v) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// 選択肢（全員）
// ---------------------------------------------------------------------------

/**
 * その事業と全事業（all）の、表示する選択肢を並び順で返す。
 * ⚠️ division が4つ以外（空など）のときは all の分だけ。
 */
export const listCallStatusOptions = async (body: Record<string, unknown>): Promise<CallStatusResult> => {
  const division = String(body.division ?? '');
  const divisions = (DIVISIONS as readonly string[]).includes(division) && division !== 'all' ? [division, 'all'] : ['all'];
  const rows = await query<OptionRow>(
    `SELECT kind, name FROM call_status WHERE flag = 1 AND division IN (${divisions.map(() => '?').join(',')}) ORDER BY sort, no`,
    divisions
  );
  // ⚠️ 同じ名前が事業別と all の両方にあっても1つにまとめる
  const namesOf = (kind: string): string[] => [...new Set(rows.filter((r) => r.kind === kind).map((r) => r.name))];
  return ok({ statuses: namesOf('status'), actions: namesOf('action') });
};

// ---------------------------------------------------------------------------
// 管理画面（Master / insideSales）
// ---------------------------------------------------------------------------

export const adminCallStatus = async (): Promise<CallStatusResult> => {
  const period = currentPeriod();
  const [items, staffRows, shopRows] = await Promise.all([
    query<CallStatusRow>(
      "SELECT no, kind, name, division, flag, sort, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at FROM call_status ORDER BY kind DESC, sort, no"
    ),
    query<InsideStaffRow>(
      'SELECT id, name, status, managed_shops FROM staff_list WHERE shop = ? AND period = ? AND inside = 1 ORDER BY sort, id',
      [INSIDE_SALES_SHOP, period]
    ),
    query<ShopRow>("SELECT shop FROM shop_list WHERE division = '注文事業' AND shop IS NOT NULL AND shop <> '' ORDER BY id"),
  ]);
  return ok({
    period,
    items,
    staff: staffRows.map((s) => ({ id: s.id, name: s.name, staffStatus: s.status, managedShops: parseShops(s.managed_shops) })),
    // ⚠️ 「店舗未設定」は選ばせない
    shops: [...new Set(shopRows.map((r) => r.shop))].filter((shop) => !shop.includes('店舗未設定')),
  });
};

/**
 * 選択肢の追加（no が無い）・編集（no がある）。
 * ⚠️ 同じ種類・名前・事業の組はひとつだけ（UNIQUE キー）。重なったら 409。
 */
export const saveCallStatus = async (body: Record<string, unknown>): Promise<CallStatusResult> => {
  const no = Number(body.no ?? 0);
  const kind = String(body.kind ?? '');
  const name = text(body.name);
  const division = String(body.division ?? '');
  const flag = Number(body.flag) === 0 ? 0 : 1;
  const sort = Number(body.sort ?? 0);
  if (!(KINDS as readonly string[]).includes(kind)) return bad('種類（ステータス／アクション）を選んでください。');
  if (!(DIVISIONS as readonly string[]).includes(division)) return bad('事業を選んでください。');
  if (name === '') return bad('名前を入れてください。');
  if ([...name].length > NAME_MAX) return bad(`名前は${NAME_MAX}文字までです。`);
  if (!Number.isInteger(sort) || sort < 0 || sort > 99999) return bad('並び順は 0〜99999 の整数で入れてください。');
  if (!Number.isInteger(no) || no < 0) return bad('対象が正しくありません。開き直してください。');

  try {
    if (no === 0) {
      await execute('INSERT INTO call_status (kind, name, division, flag, sort) VALUES (?, ?, ?, ?, ?)', [kind, name, division, flag, sort]);
    } else {
      const result = await execute('UPDATE call_status SET kind = ?, name = ?, division = ?, flag = ?, sort = ? WHERE no = ?', [kind, name, division, flag, sort, no]);
      if (result.affectedRows === 0) return bad('対象が見つかりません。開き直してください。', 404);
    }
  } catch (e) {
    if ((e as { code?: string }).code === 'ER_DUP_ENTRY') return bad('同じ種類・事業に、同じ名前がすでにあります。', 409);
    throw e;
  }
  return adminCallStatus();
};

/**
 * インサイドセールスの担当者の在籍／退職と管理店舗。
 * ⚠️ 直せるのは「インサイドセールス・今年度・inside = 1」の行だけ（ほかの行は WHERE で外す）。
 * ⚠️ 管理店舗は注文事業の店舗だけ（shop_list にない名前は受けない）。
 */
export const saveInsideStaff = async (body: Record<string, unknown>): Promise<CallStatusResult> => {
  const id = Number(body.id ?? 0);
  const staffStatus = String(body.staffStatus ?? '');
  const shops = Array.isArray(body.managedShops) ? body.managedShops.map(text).filter(Boolean) : null;
  if (!Number.isInteger(id) || id <= 0) return bad('担当者が正しくありません。開き直してください。');
  if (!STAFF_STATUSES.includes(staffStatus)) return bad('在籍か退職を選んでください。');
  if (shops === null) return bad('管理店舗が正しくありません。開き直してください。');

  const shopRows = await query<ShopRow>("SELECT shop FROM shop_list WHERE division = '注文事業'");
  const allowed = new Set(shopRows.map((r) => r.shop));
  const unknown = shops.filter((s) => !allowed.has(s));
  if (unknown.length > 0) return bad(`注文事業に無い店舗があります：${unknown.join('、')}`);

  const managed = [...new Set(shops)];
  const result = await execute(
    'UPDATE staff_list SET status = ?, managed_shops = ? WHERE id = ? AND shop = ? AND period = ? AND inside = 1',
    [staffStatus, managed.length > 0 ? JSON.stringify(managed) : null, id, INSIDE_SALES_SHOP, currentPeriod()]
  );
  if (result.affectedRows === 0) return bad('対象の担当者が見つかりません（インサイドセールス・今年度の担当者だけ直せます）。', 404);
  return adminCallStatus();
};
