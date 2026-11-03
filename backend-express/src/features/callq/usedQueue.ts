import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { logger } from '../../utils/logger';

/**
 * 中古リノベの今日の架電キュー（v2.2.239。② だけ）。画面は frontend/src/components/callq/UsedCallQueue.tsx。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 対象は call_sheet の shop = '買い:中古リノベ' の顧客（⚠️ 顧客台帳の店舗ではなく架電記録の店舗。2026-11-03 の指示）。
 * ⚠️ 架電記録は call_sheet.call_log（{day, time, action, note, staff, status} の JSON 配列）。顧客画面（TableCall.tsx）と同じ形で書く。
 *   callq_used:list … キューとサマリー
 *   callq_used:mark … カードの記録（1件を末尾に足す。⚠️ 配列ごと書き換えない＝同時に記録しても消し合わない）
 * ⚠️ キュー＝最後の「次回架電日」が今日以前で、その日以降にまだ架電（通電・未通電・SMS送信）していない顧客（2026-11-03 の決定）。
 *   ⚠️ 今日その予定に架電した顧客も「記録済」としてキューに残す（不動産の画面と同じく、作業中に行が消えないように）。
 * ⚠️ サマリーの架電は 通電・未通電・SMS送信（指示書の「SMS」は記録上「SMS送信」）。週は月曜〜日曜。
 * ⚠️ 日付は日本時間。⚠️ 記録の day は 'YYYY-MM-DD' と 'YYYY/MM/DD' が混ざるので、そろえてから比べる。
 * ─────────────────────────────────────────────
 */

interface Result {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });

const USED_CALL_SHOP = '買い:中古リノベ';
const NEXT_CALL = '次回架電日';
/** サマリーに数える架電・キューを「架電済み」にする架電 */
const CALL_ACTIONS = ['通電', '未通電', 'SMS送信'];
/** カードで選べるアクション（⚠️ 顧客画面 TableCall.tsx の actions から「次回架電日」を除いたもの。次回架電日は日付の欄で入れる） */
const MARK_ACTIONS = ['通電', '未通電', 'SMS送信', 'メール送信', '資料郵送'];
/** 顧客台帳の架電回数（master_data_resale.call_log）に数えるアクション（⚠️ 顧客画面の保存と同じ数え方） */
const COUNT_ACTIONS = ['通電', '未通電'];
/** キューに出さない顧客 */
const OFF_CALL_STATUS = ['架電停止'];
const OFF_STATUS = ['契約済み', '失注', '重複'];
/** カードに出す直近の記録の数 */
const RECENT = 3;
const NOTE_MAX = 1000;

interface SheetRow extends RowDataPacket {
  id: string;
  status: string | null;
  call_log: string | null;
}

interface MasterRow extends RowDataPacket {
  id: string;
  name: string | null;
  mobile: string | null;
  phone: string | null;
  staff: string | null;
  medium: string | null;
  inquiry: string | null;
  status: string | null;
}

interface CallEntry {
  day: string;
  time: string;
  action: string;
  note: string;
  staff: string;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 空白を除いた名前（ログイン名と記録の名前で空白の入り方が違うことがある） */
const bare = (s: string): string => s.replace(/[\s　]/g, '');

const p2 = (n: number) => String(n).padStart(2, '0');

/** 日本時間の今日（'YYYY-MM-DD'）と時刻（'HH:MM'） */
const jstNow = (now = new Date()) => {
  const d = new Date(now.getTime() + 9 * 3600_000);
  return {
    date: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`,
    time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
  };
};

const addDays = (ds: string, n: number): string => {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 今週（月曜〜日曜） */
const weekRange = (today: string): [string, string] => {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const from = addDays(today, -((dow + 6) % 7));
  return [from, addDays(from, 6)];
};

/** 記録の日付をそろえる（'2026/10/08' → '2026-10-08'）。⚠️ 読めなければ '' */
const dayOf = (v: unknown): string => {
  const s = str(v).trim().replace(/\//g, '-').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

/** 実在する日付か（⚠️ '2026-13-40' のような形だけ合った値を弾く） */
const isRealDay = (s: string): boolean => {
  const t = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
};

/** call_log を読む。⚠️ 壊れた値・配列でない値は空 */
const parseLog = (raw: string | null): CallEntry[] => {
  let list: unknown;
  try {
    list = JSON.parse(str(raw) || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object')
    .map((e) => ({ day: dayOf(e.day), time: str(e.time), action: str(e.action).split(',')[0], note: str(e.note), staff: str(e.staff) }));
};

const telOf = (m: MasterRow | undefined): string => str(m?.mobile).trim() || str(m?.phone).trim();

/** 最後の「次回架電日」。⚠️ until を渡すとその日まで（今日以前の予定＝キューに並べる理由） */
const lastNextDay = (logs: CallEntry[], until = '9999-12-31'): string =>
  logs.filter((e) => e.action === NEXT_CALL && e.day !== '' && e.day <= until).reduce((max, e) => (e.day > max ? e.day : max), '');

const byTime = (a: CallEntry, b: CallEntry): number => (a.day + a.time).localeCompare(b.day + b.time);

/** 予定の日以降の最後の架電 */
const lastCallFrom = (logs: CallEntry[], from: string): CallEntry | undefined =>
  logs.filter((e) => CALL_ACTIONS.includes(e.action) && e.day >= from).sort(byTime).pop();

const diffDays = (a: string, b: string): number =>
  Math.round((new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000);

const loadSheets = (id?: string): Promise<SheetRow[]> =>
  query<SheetRow>(
    `SELECT id, status, call_log FROM call_sheet WHERE shop = ?${id === undefined ? '' : ' AND id = ?'}`,
    id === undefined ? [USED_CALL_SHOP] : [USED_CALL_SHOP, id]
  );

/**
 * 顧客台帳（中古）。⚠️ id は表どうしで照合順序が違い、索引も無いので、SQL で JOIN せず JS で突き合わせる。
 * ⚠️ 同じ id が複数ある顧客は最初の行（no の小さい方）。⚠️ 表示しない顧客・削除済みの顧客は除く。
 */
const loadMasters = async (id?: string): Promise<Map<string, MasterRow>> => {
  const rows = await query<MasterRow>(
    `SELECT id, customer_contacts_name AS name, customer_contacts_mobile_phone_number AS mobile, customer_contacts_phone_number AS phone,
            in_charge_user AS staff, sales_promotion_name AS medium, step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 AS inquiry, status
       FROM master_data_resale
      WHERE show_dashboard = 1 AND COALESCE(delete_dashboard, 0) <> 1${id === undefined ? '' : ' AND id = ?'}
      ORDER BY no`,
    id === undefined ? [] : [id]
  );
  const map = new Map<string, MasterRow>();
  for (const r of rows) if (!map.has(str(r.id))) map.set(str(r.id), r);
  return map;
};

interface QueueCard {
  id: string;
  name: string;
  tel: string;
  staff: string;
  medium: string;
  inquiryDay: string;
  status: string;
  callStatus: string;
  /** 最後の次回架電日（⚠️ 今日より先のこともある。記録したあとの次の予定） */
  nextDay: string;
  /** 今日以前の最後の次回架電日（キューに並べる理由の予定） */
  dueDay: string;
  /** dueDay を過ぎた日数（今日なら 0） */
  overdue: number;
  /** dueDay 以降の最後の架電（⚠️ あれば「記録済」） */
  done: CallEntry | null;
  calls: number;
  recent: CallEntry[];
}

const cardOf = (sheet: SheetRow, master: MasterRow, logs: CallEntry[], today: string): QueueCard => {
  const dueDay = lastNextDay(logs, today);
  return {
    id: str(sheet.id),
    name: str(master.name),
    tel: telOf(master),
    staff: str(master.staff),
    medium: str(master.medium),
    inquiryDay: dayOf(master.inquiry),
    status: str(master.status),
    callStatus: str(sheet.status),
    nextDay: lastNextDay(logs),
    dueDay,
    overdue: dueDay === '' ? 0 : diffDays(today, dueDay),
    done: dueDay === '' ? null : lastCallFrom(logs, dueDay) ?? null,
    calls: logs.filter((e) => COUNT_ACTIONS.includes(e.action)).length,
    recent: logs.filter((e) => e.action !== NEXT_CALL).sort(byTime).reverse().slice(0, RECENT),
  };
};

/**
 * キューに並べるか。
 *   未記録 … 最後の次回架電日が今日以前で、その日以降にまだ架電していない
 *   記録済 … 予定の日以降の架電が今日（⚠️ 先の次回架電日を入れ直していても、今日は「記録済」として残す）
 * ⚠️ 次回架電日だけを先へ入れ直した（架電していない）顧客は並べない。
 */
const inQueue = (card: QueueCard, today: string): boolean => {
  if (card.dueDay === '') return false;
  if (card.done === null) return card.nextDay <= today;
  return card.done.day === today;
};

const isOff = (sheet: SheetRow, master: MasterRow): boolean =>
  OFF_CALL_STATUS.includes(str(sheet.status)) || OFF_STATUS.includes(str(master.status));

interface Kpi { today: number; week: number; month: number }

/** callq_used:list */
export const runUsedQueueList = async (staff: AuthenticatedStaff): Promise<Result> => {
  try {
    const { date: today } = jstNow();
    const [weekFrom, weekTo] = weekRange(today);
    const monthFrom = `${today.slice(0, 7)}-01`;
    const monthTo = `${today.slice(0, 7)}-31`;
    const [sheets, masters] = await Promise.all([loadSheets(), loadMasters()]);

    const me = bare(staff.name);
    const kpi = { all: { today: 0, week: 0, month: 0 } as Kpi, mine: { today: 0, week: 0, month: 0 } as Kpi };
    const cards: QueueCard[] = [];
    for (const sheet of sheets) {
      const master = masters.get(str(sheet.id));
      if (master === undefined) continue;
      const logs = parseLog(sheet.call_log);
      const mineCustomer = bare(str(master.staff)) === me;
      for (const e of logs) {
        // 今日の架電＝次回架電日が今日の件数（⚠️ 担当は顧客の担当）
        if (e.action === NEXT_CALL && e.day === today) {
          kpi.all.today++;
          if (mineCustomer) kpi.mine.today++;
        }
        // 今週・今月の架電＝通電・未通電・SMS送信の件数（⚠️ 担当は架電した人。空なら顧客の担当）
        if (!CALL_ACTIONS.includes(e.action) || e.day === '') continue;
        const mineCall = bare(e.staff || str(master.staff)) === me;
        if (e.day >= weekFrom && e.day <= weekTo) {
          kpi.all.week++;
          if (mineCall) kpi.mine.week++;
        }
        if (e.day >= monthFrom && e.day <= monthTo) {
          kpi.all.month++;
          if (mineCall) kpi.mine.month++;
        }
      }
      if (isOff(sheet, master)) continue;
      const card = cardOf(sheet, master, logs, today);
      if (inQueue(card, today)) cards.push(card);
    }
    // 未記録が先。その中は期日を過ぎた日数の多い順
    cards.sort((a, b) => Number(a.done !== null) - Number(b.done !== null) || b.overdue - a.overdue || a.name.localeCompare(b.name, 'ja'));

    return ok({ status: 'ok', today, week: [weekFrom, weekTo], me: staff.name, kpi, cards, actions: MARK_ACTIONS });
  } catch (error) {
    logger.error(`callq_used:list に失敗しました: ${(error as Error).message}`);
    return fail(500, '架電キューを読み込めませんでした。');
  }
};

/**
 * callq_used:mark（【書き込み】）。
 * ⚠️ 本文: id・action（MARK_ACTIONS のどれか。空なら次回架電日だけ）・note・next_day（'YYYY-MM-DD'。今日以降。空なら入れない）。
 * ⚠️ 記録は JSON_ARRAY_APPEND で末尾に足す（⚠️ 読んでから配列ごと書き戻すと、同時に記録した分が消える）。
 * ⚠️ あわせて顧客台帳の架電回数（master_data_resale.call_log）を顧客画面の保存と同じ数え方で直す。
 */
export const runUsedQueueMark = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const id = str(body.id).trim();
  const action = str(body.action).trim();
  const note = str(body.note).trim().slice(0, NOTE_MAX);
  const nextDay = str(body.next_day).trim();
  const { date: today, time } = jstNow();

  if (id === '') return fail(400, '顧客が指定されていません。');
  if (action !== '' && !MARK_ACTIONS.includes(action)) return fail(400, 'アクションの値が正しくありません。');
  if (nextDay !== '' && (dayOf(nextDay) !== nextDay || !isRealDay(nextDay) || nextDay < today)) return fail(400, '次回架電日は今日以降の日付を入れてください。');
  if (action === '' && nextDay === '') return fail(400, 'アクションか次回架電日を入れてください。');

  try {
    const [sheet] = await loadSheets(id);
    const masters = await loadMasters(id);
    const master = masters.get(id);
    if (sheet === undefined || master === undefined) return fail(404, '対象の顧客が見つかりません（画面を再読み込みしてください）。');

    const entries: (CallEntry & { status: string })[] = [];
    const status = str(master.status);
    if (action !== '') entries.push({ day: today, time, action, note, staff: staff.name, status });
    // ⚠️ 次回架電日の記録の day は予定の日（顧客画面と同じ）
    if (nextDay !== '') entries.push({ day: nextDay, time: '', action: NEXT_CALL, note: action === '' ? note : '', staff: staff.name, status });

    // ⚠️ 1つの UPDATE で全部足す（片方だけ入るのを防ぐ）。⚠️ 空の記録は [] から始める。
    // ⚠️ JSON として読めない記録には書かない（[] に置き換えると今までの記録が消える）
    const result = await execute(
      `UPDATE call_sheet
          SET call_log = JSON_ARRAY_APPEND(IF(TRIM(COALESCE(call_log, '')) = '', '[]', call_log), ${entries.map(() => `'$', JSON_EXTRACT(?, '$')`).join(', ')})
        WHERE shop = ? AND id = ?
          AND (TRIM(COALESCE(call_log, '')) = '' OR (JSON_VALID(call_log) AND JSON_TYPE(call_log) = 'ARRAY'))`,
      [...entries.map((e) => JSON.stringify(e)), USED_CALL_SHOP, id]
    );
    if (result.affectedRows === 0) return fail(409, 'このお客様の架電記録が読めない形のため記録できません。お客様の詳細から記録してください。');

    const [after] = await loadSheets(id);
    const logs = parseLog(after?.call_log ?? null);
    await execute('UPDATE master_data_resale SET call_log = ? WHERE id = ?', [String(logs.filter((e) => COUNT_ACTIONS.includes(e.action)).length), id]);

    return ok({ status: 'ok', card: cardOf(after ?? sheet, master, logs, today) });
  } catch (error) {
    logger.error(`callq_used:mark に失敗しました id=${id}: ${(error as Error).message}`);
    return fail(500, '記録できませんでした。');
  }
};
