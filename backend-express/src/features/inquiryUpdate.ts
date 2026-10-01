import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../db/pool';

/**
 * 反響の付帯情報の更新（同期サービス sync から呼ばれる）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: backend/src/handlers/inquiry_update.php
 *   ⚠️ さらにその元は旧API `dashboard/api/changeShop.php`（2026-09-30 / v2.2.155）。
 *
 * ⚠️⚠️ **呼び出し元は画面ではなくサーバー（projects/sync）である。**
 *   ⚠️ そのため登録は `auth: 'none'`。⚠️ **トークンを持てない。**
 *
 * ⚠️⚠️ **返す形は `{status, message}` だけ。**
 *   ⚠️ 旧APIは毎回 `inquiry_customer` の全件を返していたが、
 *     ⚠️ ⚠️ **呼び出し元は応答を捨てている。**
 *
 * ⚠️⚠️ **`shop` / `staff` / `tag` はここに無い。**
 *   ⚠️ すでに features/list/save.ts にある。**二重に持たせない。**
 * ─────────────────────────────────────────────
 */

export interface InquiryUpdateResult {
  httpStatus: number;
  body: { status: 'success' | 'error'; message: string };
}

interface ExistsRow extends RowDataPacket {
  found: number;
}

interface ShopRow extends RowDataPacket {
  shop: string | null;
}

/**
 * `customers` に入れる列と、指定が無いときの値。
 *
 * ⚠️⚠️ **`customers` の列はすべて NOT NULL で、既定値を持たない**（`trash` を除く）。
 *   ⚠️ ⚠️ **旧APIは8列しか指定しておらず、STRICT_TRANS_TABLES 下では
 *     必ず `Field 'date' doesn't have a default value` で落ちる。**
 *
 * ⚠️⚠️ **backend/src/handlers/inquiry_update.php の CUSTOMERS_COLUMNS と同じ内容にすること。**
 *   ⚠️ 片方だけ列を足すと、① と ② で入る行が変わる。
 *
 * ⚠️ `no`（AUTO_INCREMENT）と `trash`（既定値あり）は入れない。
 */
const CUSTOMERS_COLUMNS: Record<string, string> = {
  id: '',
  name: '',
  date: '',
  status: '',
  rank: '',
  rank_period: '',
  register: '',
  reserve: '',
  shop: '',
  staff: '',
  medium: '',
  estate: '',
  place: '',
  budget: '',
  loan: '',
  repayment: '',
  contract: '',
  meeting: '',
  rank_history: '',
  section: '',
  appointment: '',
  second_reserve: '',
  line_group: '',
  screening: '',
  rival: '',
  period: '',
  survey: '',
  importance: '',
  note: '',
  sales_meeting: '',
  // ⚠️ ここから3つは tinyint。⚠️ **空文字を入れると厳密モードで落ちる**
  before_survey: '0',
  before_interview: '0',
  after_interview: '0',
  call_status: '',
  reserved_status: '',
  phone_number: '',
  full_address: '',
  zip: '',
  lat_lng: '',
  response_status: '',
  campaign: '',
  cancel_status: '',
  ice_world: '',
  gift: '',
};

const ok = (message: string): InquiryUpdateResult => ({
  httpStatus: 200,
  body: { status: 'success', message },
});

const fail = (httpStatus: number, message: string): InquiryUpdateResult => ({
  httpStatus,
  body: { status: 'error', message },
});

/** 文字列として受け取る。⚠️ 対象の列はいずれも NOT NULL なので null を入れない */
const toText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const toTrimmed = (value: unknown): string => toText(value).trim();

/** 反響が実在するか */
const inquiryExists = async (inquiryId: string): Promise<boolean> => {
  const rows = await query<ExistsRow>(
    'SELECT 1 AS found FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1',
    [inquiryId]
  );
  return rows.length > 0;
};

/**
 * `inquiry_customer` を1行だけ更新する。
 *
 * ⚠️ `setClause` は呼び出し側が定数で渡す。⚠️ **リクエストの値を列名にしないこと。**
 * ⚠️⚠️ **`affectedRows` で成否を判断しない。**
 *   ⚠️ MySQL は値が変わらなかった UPDATE を 0 行と数えるため、
 *     ⚠️ **同じ値を送り直しただけで「失敗」になってしまう。**
 */
const updateInquiry = async (
  setClause: string,
  params: unknown[],
  inquiryId: string
): Promise<InquiryUpdateResult | null> => {
  if (!(await inquiryExists(inquiryId))) {
    return fail(404, `${inquiryId} が見つかりません。`);
  }

  await execute(`UPDATE inquiry_customer SET ${setClause} WHERE inquiry_id = ?`, [
    ...(params as never[]),
    inquiryId,
  ]);

  return null;
};

/** マイホームロボのID・URL */
export const runInquiryUpdateRobo = async (
  body: Record<string, unknown>
): Promise<InquiryUpdateResult> => {
  const inquiryId = toTrimmed(body.inquiry_id);
  if (inquiryId === '') return fail(400, 'inquiry_id がありません。');

  const failed = await updateInquiry(
    'mhl_id = ?, mhl_url = ?',
    [toText(body.mhl_id), toText(body.mhl_url)],
    inquiryId
  );
  if (failed !== null) return failed;

  return ok(`${inquiryId} にマイホームロボの情報を登録しました。`);
};

/**
 * 事前アンケートを同期済みにする。
 *
 * ⚠️⚠️ **対象は `before_survey` テーブルで、反響ではない。**
 *   ⚠️ 主キーは `id`（数値）。⚠️ 呼び出し元は `sbid` という名前で送ってくる。
 */
export const runInquiryUpdateBeforeSurvey = async (
  body: Record<string, unknown>
): Promise<InquiryUpdateResult> => {
  const sbid = Number.parseInt(toTrimmed(body.sbid), 10);
  if (!Number.isInteger(sbid) || sbid <= 0) return fail(400, 'sbid がありません。');

  const rows = await query<ExistsRow>(
    'SELECT 1 AS found FROM before_survey WHERE id = ? LIMIT 1',
    [sbid]
  );
  if (rows.length === 0) return fail(404, `事前アンケート ${sbid} が見つかりません。`);

  await execute('UPDATE before_survey SET sync = 1 WHERE id = ?', [sbid]);

  return ok(`事前アンケート ${sbid} を同期済みにしました。`);
};

/** 同期済みにする */
export const runInquiryUpdateSync = async (
  body: Record<string, unknown>
): Promise<InquiryUpdateResult> => {
  const inquiryId = toTrimmed(body.inquiry_id);
  if (inquiryId === '') return fail(400, 'inquiry_id がありません。');

  const failed = await updateInquiry('sync = 1, pg_id = ?', [toText(body.pg_id)], inquiryId);
  if (failed !== null) return failed;

  return ok(`${inquiryId} を同期済みにしました。`);
};

/** 同期済みを取り消す */
export const runInquiryUpdateSyncError = async (
  body: Record<string, unknown>
): Promise<InquiryUpdateResult> => {
  const inquiryId = toTrimmed(body.inquiry_id);
  if (inquiryId === '') return fail(400, 'inquiry_id がありません。');

  const failed = await updateInquiry('sync = 0', [], inquiryId);
  if (failed !== null) return failed;

  return ok(`${inquiryId} の同期を取り消しました。`);
};

/** 備考 */
export const runInquiryUpdateNote = async (
  body: Record<string, unknown>
): Promise<InquiryUpdateResult> => {
  const inquiryId = toTrimmed(body.inquiry_id);
  if (inquiryId === '') return fail(400, 'inquiry_id がありません。');

  const failed = await updateInquiry('note = ?', [toText(body.note)], inquiryId);
  if (failed !== null) return failed;

  return ok(`${inquiryId} の備考を更新しました。`);
};

/**
 * 重複名簿として伏せる。
 *
 * ⚠️⚠️ **`shop` に追記する仕様のため、二度押すと `重複名簿重複名簿` になる。**
 *   ⚠️ 旧APIからの持ち越し。⚠️ **既に付いていれば何もしない。**
 */
export const runInquiryUpdateDuplicate = async (
  body: Record<string, unknown>
): Promise<InquiryUpdateResult> => {
  const inquiryId = toTrimmed(body.inquiry_id);
  if (inquiryId === '') return fail(400, 'inquiry_id がありません。');

  const rows = await query<ShopRow>(
    'SELECT shop FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1',
    [inquiryId]
  );

  const current = rows[0];
  if (current === undefined) return fail(404, `${inquiryId} が見つかりません。`);

  if ((current.shop ?? '').includes('重複名簿')) {
    return ok(`${inquiryId} は既に重複名簿です。`);
  }

  await execute(
    "UPDATE inquiry_customer SET shop = CONCAT(shop, '重複名簿'), sync = 1 WHERE inquiry_id = ?",
    [inquiryId]
  );

  return ok(`${inquiryId} を重複名簿にしました。`);
};

/**
 * 顧客を作る（無いときだけ）。
 *
 * ⚠️⚠️ **`customers` と `master_data` の両方に入れる。**
 *   ⚠️ 旧APIは片方ずつ判定して**それぞれ `echo` していた**ため、
 *     ⚠️ ⚠️ **JSONが2つ連結された壊れた応答**を返すことがあった。
 *   ⚠️ ⚠️ **まとめてトランザクションにしてある**（片方だけ作られる状態を作らない）。
 */
export const runInquiryUpdateNewCustomer = async (
  body: Record<string, unknown>
): Promise<InquiryUpdateResult> => {
  const id = toTrimmed(body.id);
  if (id === '') return fail(400, 'id がありません。');

  const created = await withTransaction(async (tx) => {
    const done: string[] = [];

    const customerRows = await tx.query<ExistsRow>(
      'SELECT 1 AS found FROM customers WHERE id = ? LIMIT 1',
      [id]
    );

    if (customerRows.length === 0) {
      const columns = Object.keys(CUSTOMERS_COLUMNS);
      const values = columns.map((column) =>
        column === 'id'
          ? id
          : column in body
            ? toText(body[column])
            : CUSTOMERS_COLUMNS[column]
      );

      await tx.execute(
        `INSERT INTO customers (${columns.join(', ')})
         VALUES (${columns.map(() => '?').join(', ')})`,
        values
      );
      done.push('customers');
    }

    const masterRows = await tx.query<ExistsRow>(
      'SELECT 1 AS found FROM master_data WHERE id = ? LIMIT 1',
      [id]
    );

    if (masterRows.length === 0) {
      await tx.execute(
        `INSERT INTO master_data
            (id, customer_contacts_name, customer_contacts_name_kana, full_address,
             customer_contacts_mobile_phone_number, customer_contacts_email, postal_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          toText(body.customer_contacts_name),
          toText(body.customer_contacts_name_kana),
          toText(body.full_address),
          toText(body.customer_contacts_mobile_phone_number),
          toText(body.customer_contacts_email),
          toText(body.postal_code),
        ]
      );
      done.push('master_data');
    }

    return done;
  });

  return ok(
    created.length === 0
      ? `${id} は既に登録済みです。`
      : `${id} を登録しました（${created.join(' / ')}）。`
  );
};
