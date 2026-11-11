import type { RowDataPacket } from 'mysql2/promise';
import { withTransaction } from '../db/pool';
import type { Tx } from '../db/pool';
import { logger } from '../utils/logger';
import { syncKeyMatches } from './syncLog';

/**
 * SUUMO（建売。かえるホーム）の反響を、反響ごとに取り込む（v2.2.263）。表は suumo_action_kaeru。
 *
 * ─────────────────────────────────────────────
 *   以前 … sync が「お客様」画面の CSV（顧客ごと）を ① の suumo_db_kaeru.php へ送り、
 *          反響一覧（inquiry_customer_kaeru）に `suumo_<顧客ID>` で **1人1行（初回の反響）** だけ入れていた。
 *          → 同じ人の2回目以降の反響が出ない（2026-11-11 の CSV で 731件中 157件）
 *   今   … sync が「反響」画面の CSV（反響ごと）を、ここ（suumo_kaeru:actions）へ送る。
 *          反響一覧には `suumo_act_<予約ID か 反響ID>` で **1反響1行**。
 *          顧客ごとの CSV は今までどおり ① が suumo_db_kaeru に入れる（顧客ID・追客状況・成約はそちらにしか無い）。
 *          ⚠️ ① は反響一覧に足すのをやめた（portal/suumo_kaeru.php を呼ばない）。反響一覧の行はここだけが作る。
 *
 *   ⚠️⚠️ 二重にしない決まり（2026-11-11 の CSV 731件で確かめた）
 *     1. 同じ反響の送り直し … action_id（予約ID は英数8桁・反響ID は数字10桁。どちらか一方だけ）が一意。表も反響一覧も ID で1行
 *     2. 以前の行との二重 … `suumo_<顧客ID>` の行は、その顧客の「初回の反響」。suumo_db_kaeru の初回の予約ID・反響ID と
 *        action_id が同じで、`suumo_<顧客ID>` の行があれば、新しい行は足さない（ID の完全一致だけで決める）
 *     3. 同じ人の別の反響 … 別の行として足す（運用の決定）。備考の先頭に「同じお客様の反響あり」（初回の日付・件数・顧客DBに取込済みか）を付ける。
 *        ⚠️ 重複のフラグ（duplicate_flag）は立てない（立てると一覧で連携済みの側に入り、見落とす）
 *   ⚠️ どの顧客の反響か（customer_id）は、次の順で **候補が1人のときだけ** 結ぶ（2人以上なら結ばない）
 *     id（初回・最新の予約ID/反響ID）→ name（氏名＋電話 か 氏名＋メール）→ mail（メールだけ）→ phone（電話だけ）
 *   ⚠️ キャンセルの予約は反響一覧に足さない（運用の決定）。すでにある行は消さず、備考の先頭に「予約キャンセル」を付ける。
 *
 *   ⚠️ sync が ② へ直接送る（① を通さない。① の express_proxy.php にも入れない）。ログイン無し・合い言葉（SYNC_LOG_SECRET）。
 *     合い言葉の総当たりは publicFormRateLimit.ts の syncLogLimiter（失敗だけを数える）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface SuumoKaeruResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/** 1回に受ける行の上限（sync は 500件ずつ送る） */
const MAX_ROWS = 500;
const UPSERT_CHUNK = 100;
const DATETIME_RE = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/;
const CANCELED = 'キャンセル';
const SAME_CUSTOMER_MARK = '【同じお客様の反響あり】';
const CANCEL_MARK = '【予約キャンセル';

/** sync が送る項目（suumoKaeruCsv.ts の ACTION_HEADER_MAP と同じ並び）と、表の列・長さの上限 */
const COLUMNS: ReadonlyArray<readonly [string, number]> = [
  ['received_at', 32], ['reaction_type', 64], ['name', 128], ['name_kana', 128], ['address', 255], ['email', 128], ['phone', 32], ['fax', 32],
  ['staff', 128], ['reserve_status', 64], ['guide_at', 32], ['other_wish', 255], ['meeting_place', 255], ['message', 5000],
  ['canceled_at', 32], ['cancel_route', 64], ['cancel_reason', 255], ['property_type', 64], ['property_code', 64], ['project_code', 64],
  ['property_name', 255], ['property_price', 64], ['property_address', 255], ['listing_plan', 128], ['company_property_code', 64],
  ['transaction_type', 64], ['origin_company', 128], ['company_staff', 128], ['traffic', 255], ['layout', 64],
  ['exclusive_area', 32], ['building_area', 32], ['land_area', 32], ['remarks', 20000],
];

type MatchKind = 'id' | 'name' | 'mail' | 'phone';
interface Action {
  actionId: string;
  kind: 'reserve' | 'inquiry';
  values: Record<string, string>;
  customerId: string | null;
  match: MatchKind | null;
}
interface Customer {
  id: string;
  firstIds: string[];
  name: string;
  phone: string;
  mail: string;
}
/** 同じ顧客の、反響一覧にすでにある行のまとめ（備考の印に使う） */
interface Known {
  count: number;
  firstDate: string;
  synced: boolean;
}

const fail = (httpStatus: number, message: string): SuumoKaeruResult => ({ httpStatus, body: { status: 'error', message } });
const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const nfkc = (v: unknown): string => str(v).normalize('NFKC');
const normName = (v: unknown): string => nfkc(v).replace(/\s+/g, '');
const normPhone = (v: unknown): string => nfkc(v).replace(/\D/g, '');
const normMail = (v: unknown): string => nfkc(v).trim().toLowerCase();
const legacyId = (customerId: string): string => `suumo_${customerId}`;
const actionInquiryId = (actionId: string): string => `suumo_act_${actionId}`;

/** 1行を確かめる。⚠️ ID・氏名・受付日時が無い／形が違う行は null（その行だけ捨てる） */
const cleanAction = (raw: unknown): Action | null => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const reserveId = str(r.reserve_id).trim();
  const inquiryId = str(r.inquiry_id).trim();
  const actionId = reserveId || inquiryId;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(actionId)) return null;
  const values: Record<string, string> = {};
  for (const [col, max] of COLUMNS) values[col] = str(r[col]).trim().slice(0, max);
  if (values.name === '' || !DATETIME_RE.test(values.received_at)) return null;
  return { actionId, kind: reserveId ? 'reserve' : 'inquiry', values, customerId: null, match: null };
};

/** 候補が1人だけなら、その顧客ID */
const only = (set: Set<string> | undefined): string | null => (set && set.size === 1 ? [...set][0] : null);
const addTo = (map: Map<string, Set<string>>, key: string, id: string): void => {
  const set = map.get(key);
  if (set) set.add(id);
  else map.set(key, new Set([id]));
};

/** 顧客（suumo_db_kaeru）を読み、反響を顧客に結ぶ関数を返す */
const loadCustomers = async (tx: Tx): Promise<{ customers: Map<string, Customer>; resolve: (a: Action) => void }> => {
  // ⚠️ 全件を読む（顧客は年に数千件。反響の送信は1日に数回・500件ずつ）
  const rows = await tx.query<DynamicRow>(
    `SELECT customer_id, name, phone, email, first_reaction_id, first_reaction_reserve_id, latest_reaction_id, latest_reaction_reserve_id
     FROM suumo_db_kaeru WHERE customer_id IS NOT NULL AND customer_id <> ''`
  );
  const customers = new Map<string, Customer>();
  const byActionId = new Map<string, Set<string>>();
  const byNamePhone = new Map<string, Set<string>>();
  const byNameMail = new Map<string, Set<string>>();
  const byPhone = new Map<string, Set<string>>();
  const byMail = new Map<string, Set<string>>();
  for (const r of rows) {
    const id = str(r.customer_id);
    const firstIds = [str(r.first_reaction_id), str(r.first_reaction_reserve_id)].map((s) => s.trim()).filter((s) => s !== '');
    const c: Customer = { id, firstIds, name: normName(r.name), phone: normPhone(r.phone), mail: normMail(r.email) };
    customers.set(id, c);
    for (const a of [...firstIds, str(r.latest_reaction_id).trim(), str(r.latest_reaction_reserve_id).trim()]) if (a !== '') addTo(byActionId, a, id);
    if (c.phone !== '') {
      addTo(byPhone, c.phone, id);
      if (c.name !== '') addTo(byNamePhone, `${c.name}\t${c.phone}`, id);
    }
    if (c.mail !== '') {
      addTo(byMail, c.mail, id);
      if (c.name !== '') addTo(byNameMail, `${c.name}\t${c.mail}`, id);
    }
  }
  const resolve = (a: Action): void => {
    const name = normName(a.values.name);
    const phone = normPhone(a.values.phone);
    const mail = normMail(a.values.email);
    const named = new Set<string>([
      ...(phone !== '' ? byNamePhone.get(`${name}\t${phone}`) ?? [] : []),
      ...(mail !== '' ? byNameMail.get(`${name}\t${mail}`) ?? [] : []),
    ]);
    const steps: Array<[MatchKind, string | null]> = [
      ['id', only(byActionId.get(a.actionId))],
      ['name', only(named)],
      ['mail', mail !== '' ? only(byMail.get(mail)) : null],
      ['phone', phone !== '' ? only(byPhone.get(phone)) : null],
    ];
    const hit = steps.find(([, id]) => id !== null);
    a.customerId = hit ? hit[1] : null;
    a.match = hit ? hit[0] : null;
  };
  return { customers, resolve };
};

const upsertActions = async (tx: Tx, actions: Action[]): Promise<void> => {
  const cols = ['action_id', 'action_kind', ...COLUMNS.map(([c]) => c), 'customer_id', 'customer_match'];
  // ⚠️ 顧客に結べなかったときは、以前に結んだ顧客ID を消さない
  const updates = cols
    .filter((c) => c !== 'action_id')
    .map((c) => (c === 'customer_id' || c === 'customer_match' ? `${c} = COALESCE(VALUES(${c}), ${c})` : `${c} = VALUES(${c})`));
  for (let i = 0; i < actions.length; i += UPSERT_CHUNK) {
    const chunk = actions.slice(i, i + UPSERT_CHUNK);
    await tx.execute(
      `INSERT INTO suumo_action_kaeru (${cols.join(', ')}) VALUES ${chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ')}
       ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
      chunk.flatMap((a) => [a.actionId, a.kind, ...COLUMNS.map(([c]) => (a.values[c] === '' ? null : a.values[c])), a.customerId, a.match])
    );
  }
};

/**
 * suumo_kaeru:actions。body = { key, rows: [{ reserve_id, inquiry_id, received_at, name, … }] }（sync の suumoKaeruCsv.ts が作る）
 * 応答: { status, received, saved, added, alreadyListed, legacyRow, canceled, cancelMarked, unmatched, invalid }
 *   added         … 反響一覧に新しく足した行
 *   alreadyListed … すでに `suumo_act_` の行がある（送り直し）
 *   legacyRow     … 以前の `suumo_<顧客ID>` の行（初回の反響）があるので足さなかった
 *   canceled      … キャンセルなので足さなかった（うち cancelMarked 件は、すでにある行の備考に印を付けた）
 *   unmatched     … 顧客に結べなかった（反響一覧には足す。「同じお客様」の印は付かない）
 */
export const importSuumoKaeruActions = async (body: Record<string, unknown>): Promise<SuumoKaeruResult> => {
  if (!syncKeyMatches(str(body.key))) return fail(401, '合い言葉が正しくありません');
  const list = Array.isArray(body.rows) ? body.rows : [];
  if (list.length > MAX_ROWS) return fail(400, `1回に送れるのは ${MAX_ROWS} 件までです`);
  // ⚠️ 同じ ID が1回の送信に2行あれば後の行を使う。古い反響から順に足す（「同じお客様」の印の初回を正しくするため）
  const byId = new Map<string, Action>();
  for (const raw of list) {
    const a = cleanAction(raw);
    if (a) byId.set(a.actionId, a);
  }
  const actions = [...byId.values()].sort((x, y) => x.values.received_at.localeCompare(y.values.received_at) || x.actionId.localeCompare(y.actionId));
  const result = { received: list.length, saved: actions.length, added: 0, alreadyListed: 0, legacyRow: 0, canceled: 0, cancelMarked: 0, unmatched: 0, invalid: list.length - actions.length };
  if (actions.length === 0) return { httpStatus: 200, body: { status: 'success', ...result } };

  await withTransaction(async (tx) => {
    const { customers, resolve } = await loadCustomers(tx);
    actions.forEach(resolve);
    result.unmatched = actions.filter((a) => a.customerId === null).length;
    await upsertActions(tx, actions);

    // 反響一覧にある SUUMO の行と、その行の顧客（以前の行は ID から、新しい行は suumo_action_kaeru から）
    const actionCustomer = new Map<string, string>();
    for (const r of await tx.query<DynamicRow>(`SELECT action_id, customer_id FROM suumo_action_kaeru WHERE customer_id IS NOT NULL`)) {
      actionCustomer.set(str(r.action_id), str(r.customer_id));
    }
    const listed = new Set<string>();
    const known = new Map<string, Known>();
    const remember = (customerId: string | null | undefined, date: string, synced: boolean): void => {
      if (!customerId) return;
      const k = known.get(customerId);
      if (!k) known.set(customerId, { count: 1, firstDate: date, synced });
      else {
        k.count += 1;
        k.synced = k.synced || synced;
        if (date !== '' && (k.firstDate === '' || date < k.firstDate)) k.firstDate = date;
      }
    };
    for (const r of await tx.query<DynamicRow>(`SELECT inquiry_id, inquiry_date, sync FROM inquiry_customer_kaeru WHERE inquiry_id LIKE 'suumo\\_%'`)) {
      const id = str(r.inquiry_id);
      listed.add(id);
      const customerId = id.startsWith('suumo_act_') ? actionCustomer.get(id.slice('suumo_act_'.length)) : id.slice('suumo_'.length);
      remember(customerId, str(r.inquiry_date), Number(r.sync) === 1);
    }

    for (const a of actions) {
      const v = a.values;
      const customer = a.customerId ? customers.get(a.customerId) : undefined;
      // ⚠️ 決まり 2：この反響が顧客の「初回の反響」で、以前の行（suumo_<顧客ID>）があれば、それがこの反響の行
      const legacy = customer && customer.firstIds.includes(a.actionId) && listed.has(legacyId(customer.id)) ? legacyId(customer.id) : null;
      const own = actionInquiryId(a.actionId);
      const existing = legacy ?? (listed.has(own) ? own : null);

      if (v.reserve_status === CANCELED) {
        result.canceled += 1;
        if (existing) {
          const mark = `${CANCEL_MARK} ${v.canceled_at || '日時不明'}】`;
          const done = await tx.execute(
            `UPDATE inquiry_customer_kaeru SET note = CONCAT(?, '\n', note) WHERE inquiry_id = ? AND INSTR(note, ?) = 0`,
            [mark, existing, CANCEL_MARK]
          );
          result.cancelMarked += done.affectedRows;
        }
        continue;
      }
      if (legacy) {
        result.legacyRow += 1;
        continue;
      }
      if (existing) {
        result.alreadyListed += 1;
        continue;
      }

      const date = v.received_at.slice(0, 10);
      const k = a.customerId ? known.get(a.customerId) : undefined;
      const mark = k
        ? `${SAME_CUSTOMER_MARK}初回 ${k.firstDate || '日付不明'}・これまで ${k.count}件・${k.synced ? '顧客DBに取込済み' : '顧客DBに未取込'}（この行が届いた時点）\n`
        : '';
      const [guideDate = '', guideTime = ''] = v.guide_at.split(' ');
      // ⚠️ INSERT IGNORE：NOT NULL で既定値の無い列（last_name など）を空で入れるため（① の portal/*_kaeru.php と同じ）
      const done = await tx.execute(
        `INSERT IGNORE INTO inquiry_customer_kaeru
           (inquiry_id, inquiry_date, first_name, first_name_kana, medium, response_medium, mobile, mail,
            property, area, reserved_date, reserved_time, building, brand, note)
         VALUES (?, ?, ?, ?, 'SUUMO', 'SUUMO', ?, ?, ?, ?, ?, ?, ?, 'かえる', ?)`,
        [own, date, v.name, v.name_kana, v.phone, v.email, v.property_name, v.property_address, guideDate, guideTime, v.address, mark + v.remarks]
      );
      if (done.affectedRows > 0) {
        result.added += 1;
        listed.add(own);
        remember(a.customerId, date, false);
      } else {
        result.alreadyListed += 1;
      }
    }
  });

  logger.info(`suumo_kaeru:actions ${JSON.stringify(result)}`);
  return { httpStatus: 200, body: { status: 'success', ...result } };
};
