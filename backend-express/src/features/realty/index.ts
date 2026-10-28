import type { RowDataPacket } from 'mysql2/promise';
import { executeLarge, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';

/**
 * 不動産企画係（category = realty）のデータ（v2.2.221 で ① から移植）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/planner.php・broker.php・activity.php と、その *Action/*.php
 *   planner:lead / planner:summary            … 案件一覧・チームサマリー（読み出し）
 *   broker:list / broker:report / broker:customer … 媒介台帳など（読み出し）
 *   broker:update                              … 1件の保存（UPSERT）
 *   activity:history / activity:notice / activity:read … 変更履歴・通知・既読
 *
 * ⚠️⚠️ v2.2.220 までは ① で**ログインしていなくても読み書きできた**。移植と同時に確かめるようにした。
 *   ・不動産企画係の画面のもの … 担当事業（staff.shop）が realty / all の人だけ
 *   ・broker:*                  … さらに used（中古リノベ）も可（中古の顧客DB・顧客詳細が broker:update で台帳を書く）
 * ⚠️ 通知（activity:notice / read）は**ログインしている本人の分だけ**。
 *   v2.2.220 までは画面が送る `to`（名前）を信じていたため、他人の通知を読めた。
 *
 * ⚠️ 応答の形は ① と同じ（画面を変えずに済むように）。値の型も ① と同じ
 *   （① は PDO::ATTR_EMULATE_PREPARES=false で数値を数値のまま返す。gateway/phpCompat.ts の注記）。
 * ─────────────────────────────────────────────
 */

/** 不動産企画係の画面を使える担当事業 */
export const REALTY_SHOPS = ['realty', 'all'];
/** 媒介台帳（broker:*）を使える担当事業。⚠️ 中古の顧客DB・顧客詳細も台帳を読み書きする */
export const BROKER_SHOPS = ['realty', 'all', 'used'];

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface Result {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });

/** 名前の突き合わせ用。⚠️ 空白（全角を含む）を落とす（staff と staff_list で表記が揺れる） */
const norm = (value: unknown): string => String(value ?? '').replace(/[\s　]/g, '');

/** SQL の中で `to` の空白を落とす式（norm と同じ） */
const TO_NORM = "REPLACE(REPLACE(`to`, ' ', ''), '　', '')";

// ---------------------------------------------------------------------------
// planner（不動産企画係の案件・サマリー）
// ---------------------------------------------------------------------------

const realtyStaffList = (): Promise<DynamicRow[]> =>
  query<DynamicRow>("SELECT * FROM staff_list WHERE shop = '不動産企画係'");

/** app_state.settings（無ければ・読めなければ空のオブジェクト） */
const readSettings = async (): Promise<unknown> => {
  const state = await query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1");
  try {
    const raw = state[0]?.data;
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    // ⚠️ PHP の json_decode(…, true) は空のオブジェクトを [] にする。画面は Object として読むので {} で返す
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * 移植元: plannerAction/planner_lead.php。⚠️ kind で絞るのは画面側
 * ⚠️ v2.2.225: 売り反響・買い反響の画面の歩留まり（担当者・反響単価・期首月）のため settings も返す
 */
export const runPlannerLead = async (): Promise<Result> => {
  const [lead, staff, settings] = await Promise.all([
    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads', 'ledger', 'resales')"),
    realtyStaffList(),
    readSettings(),
  ]);
  return ok({ lead, staff, settings });
};

/**
 * 移植元: plannerAction/planner_summary.php。⚠️ settings が無くても空のオブジェクトを返す。
 * ⚠️ v2.2.222: チームサマリーの売上・媒介獲得・朝礼用アラートのため、商談案件（deals）と媒介台帳（ledger）も返す。
 */
export const runPlannerSummary = async (): Promise<Result> => {
  const [lead, deals, ledger, staff, settings] = await Promise.all([
    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads')"),
    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind = 'deals'"),
    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind = 'ledger'"),
    realtyStaffList(),
    readSettings(),
  ]);
  return ok({ lead, deals, ledger, staff, settings });
};

// ---------------------------------------------------------------------------
// broker（媒介台帳など）
// ---------------------------------------------------------------------------

/** 移植元: brokerAction/broker_list.php・broker_report.php（中身は同じ） */
export const runBrokerList = async (): Promise<Result> => {
  const [brokerage, staff] = await Promise.all([
    query<DynamicRow>('SELECT * FROM brokerage_listings'),
    query<DynamicRow>('SELECT * FROM staff_list WHERE rank = 1'),
  ]);
  return ok({ brokerage, staff });
};

/** 移植元: brokerAction/broker_customer.php */
export const runBrokerCustomer = async (): Promise<Result> => {
  const [customer, property] = await Promise.all([
    query<DynamicRow>('SELECT * FROM master_data_resale WHERE show_dashboard = 1'),
    query<DynamicRow>('SELECT * FROM property_db'),
  ]);
  return ok({ customer, property });
};

/**
 * 保存してよい列（移植元: broker_update.php の $allowedColumns と同じ）。
 * ⚠️ ここに無いキーは黙って捨てる。列を足したらここにも足す。
 * ⚠️ 列名を SQL に直接埋め込むので、**この配列にある値以外を入れないこと**。
 */
const ALLOWED_COLUMNS = [
  'kind', 'no', 'note', 'staff', 'category', 'phase', 'show_dashboard',
  'addr', 'addr1', 'addr2', 'property', 'targetProperty', 'propName',
  'price', 'budget', 'fee', 'feeManual',
  'seller', 'buyer', 'customer', 'name', 'source', 'portal', 'contact', 'phone', 'mail',
  'freq', 'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus',
  'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate',
  'type', 'priority', 'dealId', 'dealNo', 'ledgerId', 'ledgerNo', 'extId',
  'subStaff', 'subRatio', 'coBroker', 'delivery',
  // ⚠️ v2.2.222: 本番アプリ（V14.11〜）で増えた商談のリフォーム受注と、商談リストの登録日
  'reformPrice', 'reformGp', 'reformNote', 'createdAt',
  'reason', 'timing', 'endReason', 'callDates', 'nextDate', 'nextNote',
  'receivedDate', 'connectDate', 'visitDate', 'viewDate', 'baikaiDate',
  'contactDate', 'contractDate', 'settleDate', 'followDate',
  'inputDate', 'renewDate', 'applicationDate',
  'status', 'costs', 'targetGp',
  'buyPrice', 'buyBuilding', 'buySellerReg', 'buyStockAsset',
  'taxCheckDate', 'buyContractDate', 'buySettleDate',
  'listPrice', 'listDate',
  'sellPrice', 'sellBuilding', 'sellStaff', 'sellContractDate', 'sellSettleDate',
  'at', 'to', 'from', 'field', 'label', 'entity', 'entityId', 'entityNo',
  'title', 'body', 'read', 'by', 'data', 'updatedAt',
  'deleted_at', 'deleted_by',
  'docDraft', 'docDraftAt', 'docDraftBy',
  'master_data_id', 'property_db_id', 'property_db_name',
  'raw_data',
] as const;

type SqlValue = string | number | null;

/**
 * 画面から来た値を DB に書く形にする（移植元と同じ: 空文字は NULL、真偽値は 0/1）。
 * ⚠️ 配列・オブジェクトは JSON 文字列にする（callDates・costs・coBroker・data・raw_data・docDraft。移植元の $jsonColumns）。
 *   ⚠️ 移植元はそれ以外の列のオブジェクトで PDO が落ちていた。ここでは落とさずに文字列で保存する。
 */
const toSqlValue = (value: unknown): SqlValue => {
  if (value === '' || value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * 移植元: brokerAction/broker_update.php（UPSERT）。
 * ⚠️ 本文が 64KB を超えることがある（raw_data・docDraft）ため executeLarge で書く（db/pool.ts の注記）。
 */
export const runBrokerUpdate = async (body: Record<string, unknown>): Promise<Result> => {
  const id = typeof body.id === 'string' || typeof body.id === 'number' ? String(body.id).trim() : '';
  if (id === '') return fail(400, 'IDがありません');

  const data = body.data !== null && typeof body.data === 'object' && !Array.isArray(body.data)
    ? (body.data as Record<string, unknown>)
    : {};

  const columns = ['`id`'];
  const updates: string[] = [];
  const params: SqlValue[] = [id];
  for (const column of ALLOWED_COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(data, column)) continue;
    columns.push(`\`${column}\``);
    updates.push(`\`${column}\` = VALUES(\`${column}\`)`);
    params.push(toSqlValue(data[column]));
  }

  if (columns.length === 1) return ok({ status: 'success', message: '更新データなし' });

  await executeLarge(
    `INSERT INTO \`brokerage_listings\` (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
    params
  );

  const rows = await query<DynamicRow>('SELECT * FROM brokerage_listings WHERE `id` = ?', [id]);
  const row = rows[0] ?? null;

  // ⚠️ light = true のときは全件を返さない（1,200行 × 100列超。セル単位の編集で毎回返すと重い）
  if (body.light === true || body.light === 1 || body.light === '1' || body.light === 'true') {
    return ok({ status: 'success', row });
  }
  const brokerage = await query<DynamicRow>('SELECT * FROM brokerage_listings');
  return ok({ status: 'success', row, brokerage });
};

// ---------------------------------------------------------------------------
// activity（変更履歴・通知）
// ---------------------------------------------------------------------------

const clampInt = (value: unknown, fallback: number, max: number): number => {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || value === undefined || value === null || value === '') return fallback;
  return Math.max(1, Math.min(max, n));
};

/** 移植元: activityAction/activity_history.php */
export const runActivityHistory = async (body: Record<string, unknown>): Promise<Result> => {
  const entityId = typeof body.entityId === 'string' ? body.entityId : '';
  // ⚠️ LIMIT はプレースホルダにしない（mysql2 の execute は LIMIT ? を受け付けない）。数値に丸めて埋め込む
  const limit = clampInt(body.limit, 50, 500);
  const history = await query<DynamicRow>(
    `SELECT \`id\`, \`at\`, \`by\`, \`entity\`, \`entityId\`, \`entityNo\`, \`label\`,
            \`field\`, \`from\`, \`to\`, \`note\`
       FROM \`brokerage_listings\`
      WHERE kind = 'logs'${entityId === '' ? '' : ' AND `entityId` = ?'}
      ORDER BY \`at\` DESC, \`internal_id\` DESC
      LIMIT ${limit}`,
    entityId === '' ? [] : [entityId]
  );
  return ok({ status: 'success', history });
};

const countUnread = async (name: string): Promise<number> => {
  const rows = await query<RowDataPacket & { c: number }>(
    `SELECT COUNT(*) AS c FROM \`brokerage_listings\`
      WHERE kind = 'notices' AND ${TO_NORM} = ? AND (\`read\` IS NULL OR \`read\` = 0)`,
    [name]
  );
  return Number(rows[0]?.c ?? 0);
};

/**
 * 移植元: activityAction/activity_notice.php。
 * ⚠️ 宛先は**ログインしている本人**（画面が送る `to` は使わない）。
 */
export const runActivityNotice = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const name = norm(staff.name);
  if (name === '') return fail(400, '通知先が指定されていません');
  const unreadOnly = body.unreadOnly === true || body.unreadOnly === 1 || body.unreadOnly === '1';
  const limit = clampInt(body.limit, 50, 200);
  const notices = await query<DynamicRow>(
    `SELECT \`id\`, \`at\`, \`by\`, \`to\`, \`type\`, \`title\`, \`body\`, \`entity\`, \`entityId\`, \`read\`
       FROM \`brokerage_listings\`
      WHERE kind = 'notices' AND ${TO_NORM} = ?${unreadOnly ? ' AND (`read` IS NULL OR `read` = 0)' : ''}
      ORDER BY \`at\` DESC, \`internal_id\` DESC
      LIMIT ${limit}`,
    [name]
  );
  return ok({ status: 'success', notices, unread: await countUnread(name) });
};

/**
 * 移植元: activityAction/activity_read.php。
 * ⚠️ 既読にできるのは**ログインしている本人宛の通知だけ**（他人の通知の id を渡されても変えない）。
 */
export const runActivityRead = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const name = norm(staff.name);
  if (name === '') return fail(400, '通知先が指定されていません');

  let updated = 0;
  if (body.all === true || body.all === 1 || body.all === '1') {
    const result = await executeLarge(
      `UPDATE \`brokerage_listings\` SET \`read\` = 1
        WHERE kind = 'notices' AND ${TO_NORM} = ? AND (\`read\` IS NULL OR \`read\` = 0)`,
      [name]
    );
    updated = result.affectedRows;
  } else {
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((v): v is string => typeof v === 'string' && v !== '').slice(0, 500)
      : [];
    if (ids.length === 0) return ok({ status: 'success', updated: 0, message: '対象なし' });
    const result = await executeLarge(
      `UPDATE \`brokerage_listings\` SET \`read\` = 1
        WHERE kind = 'notices' AND ${TO_NORM} = ? AND \`id\` IN (${ids.map(() => '?').join(', ')})`,
      [name, ...ids]
    );
    updated = result.affectedRows;
  }
  return ok({ status: 'success', updated, unread: await countUnread(name) });
};

/** 担当事業で使えるか。⚠️ 使えなければ 403 の本文を返す */
export const shopForbidden = (
  staff: AuthenticatedStaff | null,
  allowed: string[]
): Result | null => {
  if (staff !== null && allowed.includes(staff.shop)) return null;
  return fail(403, 'この操作を行う権限がありません。');
};
