import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../../db/pool';
import type { SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';
import { MASTER_DATA_COLUMNS } from '../information/masterDataColumns';
import type { ListResult } from './index';

/**
 * 反響一覧の書き込み（list/ListOrder.tsx / ListKaeru.tsx / ListResale.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/list.php → listAction/list_{roll}.php
 *
 *   roll = 'shop_change'  → 担当店舗（中古はカテゴリー）の変更
 *   roll = 'staff_change' → 担当営業の変更
 *   roll = 'tag'          → 顧客タグ（重複/ギフト/業者/ブラック）の ON・OFF
 *   roll = 'black'        → ブラックリストの登録・解除（トグル）
 *   roll = 'insert'       → 顧客台帳への取り込み（upsert）＋反響の同期済み化
 *
 * ⚠️⚠️ **① の PHP ハンドラは実在する。** いずれも書き込みなので、
 *   転送に失敗したまま ① で再実行されると二重に反映される。
 *   backend/src/core/express_proxy.php の expressProxyExclusive() に
 *   **必ず登録すること**（登録済み。外すと二重実行の経路が戻る）。
 *
 * ⚠️ roll = 'event' は移植していない。EventList.tsx 専用で、
 *   この3画面からは呼ばれない。未登録の roll は ① へ転送される。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * 事業区分 → 反響テーブル。
 * ⚠️⚠️ リクエストの値をテーブル名に使わないための許可リスト。
 *   テーブル名はプレースホルダにできないので、必ずこの表を経由する。
 */
const INQUIRY_TABLE: Record<string, string> = {
  order: 'inquiry_customer',
  spec: 'inquiry_customer_kaeru',
  used: 'inquiry_customer_resale',
};

/** 事業区分 → 顧客台帳テーブル */
const MASTER_TABLE: Record<string, string> = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
};

// ---------------------------------------------------------------------------
// shop_change（担当店舗／カテゴリーの変更）
// ---------------------------------------------------------------------------

/**
 * 店舗名からブランドを判定する。
 *
 * ⚠️⚠️ **判定の順序を変えないこと。** 移植元 list_shop_change.php のまま。
 *   ・'JH' は **先頭2文字が JH** のときだけ（`substr($list, 0, 2) === 'JH'`）。
 *     部分一致にすると 'DJH宮崎店' が JH と判定される
 *     （`'DJH宮崎店'.includes('JH')` は true）。
 *   ・以降は部分一致で DJH → KH → 2L → なごみ → PG の順。
 *     ⚠️ DJH を KH より先に見ること。'DJH' は 'KH' を含まないが、
 *       将来ブランドが増えたときに順序が効いてくる。
 *   ・'ブランド・店舗未設定' は KHG。
 *
 * ⚠️ どれにも当たらなければ空文字（PHP と同じ）。空でも UPDATE する。
 */
const brandOf = (shop: string): string => {
  if (shop.slice(0, 2) === 'JH') return 'JH';
  if (shop.includes('DJH')) return 'DJH';
  if (shop.includes('KH')) return 'KH';
  if (shop.includes('2L')) return '2L';
  if (shop.includes('なごみ')) return 'Nagomi';
  if (shop.includes('PG')) return 'PGH';
  if (shop.includes('ブランド・店舗未設定')) return 'KHG';
  return '';
};

/**
 * ⚠️⚠️ **事業区分で更新する列が違う。**
 *   order … shop と brand の**2列**
 *   spec  … shop だけ（brand は更新しない）
 *   used  … **category**（店舗ではなく取引区分。画面のラベルは「担当店舗」だが
 *            実体は 買い:中古リノベ などのカテゴリー）
 *   揃えると別の列を書き換えることになる。
 */
export const runListShopChange = async (body: unknown): Promise<ListResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const category = asString(data.category);
  const table = INQUIRY_TABLE[category];
  if (table === undefined) {
    return { httpStatus: 400, body: { status: 'error', message: '対象が不正です。' } };
  }

  const value = asString(data.list);
  const inquiryId = asString(data.inquiry_id);

  // ⚠️ PHP は inquiry_id が空でも実行していた（0件更新）。
  //   空だと全件を書き換える危険はないが、誤呼び出しを見つけられないので弾く
  if (inquiryId === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '対象の反響が指定されていません。' },
    };
  }

  try {
    if (category === 'order') {
      await execute(`UPDATE ${table} SET shop = ?, brand = ? WHERE inquiry_id = ?`, [
        value,
        brandOf(value),
        inquiryId,
      ]);
    } else if (category === 'spec') {
      await execute(`UPDATE ${table} SET shop = ? WHERE inquiry_id = ?`, [value, inquiryId]);
    } else {
      // ⚠️ used は category 列（上のコメント参照）
      await execute(`UPDATE ${table} SET category = ? WHERE inquiry_id = ?`, [value, inquiryId]);
    }

    return {
      httpStatus: 200,
      // ⚠️ message の文言は PHP と同じにする（画面が出しているため）
      body: { status: 'success', message: `${inquiryId}の担当店舗を変更しました。` },
    };
  } catch (error) {
    // ⚠️ PHP は例外メッセージをそのまま返していた（SQLや列名が漏れる）
    logger.error(`list:shop_change 失敗 inquiry_id=${inquiryId}: ${(error as Error).message}`);
    return {
      httpStatus: 200,
      body: { status: 'error', message: '担当店舗の変更に失敗しました。' },
    };
  }
};

// ---------------------------------------------------------------------------
// staff_change（担当営業の変更）
// ---------------------------------------------------------------------------

export const runListStaffChange = async (body: unknown): Promise<ListResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const category = asString(data.category);
  const table = INQUIRY_TABLE[category];
  if (table === undefined) {
    return { httpStatus: 400, body: { status: 'error', message: '対象が不正です。' } };
  }

  const value = asString(data.list);
  const inquiryId = asString(data.inquiry_id);
  if (inquiryId === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '対象の反響が指定されていません。' },
    };
  }

  try {
    // ⚠️ 3事業とも staff 列。shop_change と違い分岐は無い
    await execute(`UPDATE ${table} SET staff = ? WHERE inquiry_id = ?`, [value, inquiryId]);

    return {
      httpStatus: 200,
      body: { status: 'success', message: `${inquiryId}の担当営業を変更しました。` },
    };
  } catch (error) {
    logger.error(`list:staff_change 失敗 inquiry_id=${inquiryId}: ${(error as Error).message}`);
    return {
      httpStatus: 200,
      body: { status: 'error', message: '担当営業の変更に失敗しました。' },
    };
  }
};

// ---------------------------------------------------------------------------
// tag（顧客タグの ON・OFF）
// ---------------------------------------------------------------------------

/**
 * タグ名 → フラグ列。
 *
 * ⚠️⚠️ リクエストの値をそのままSQLに埋めないための許可リスト。
 *   列名はプレースホルダにできないため、必ずこの表を経由する。
 *
 * ⚠️ `black_list` 列には書き込まない。旧仕様は文字列を CONCAT で追記し
 *   出現回数の偶奇で ON/OFF を判定していたが、連打で表示と実体がずれた。
 *   移行SQL: backend/scripts/sql/2026-09-02_inquiry_tag_flags.sql
 */
const TAG_COLUMN: Record<string, string> = {
  duplicate: 'duplicate_flag',
  gift: 'gift_flag',
  support: 'support_flag',
  black: 'black_flag',
};

export const runListTag = async (body: unknown): Promise<ListResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const category = asString(data.category);
  const table = INQUIRY_TABLE[category];
  if (table === undefined) {
    return { httpStatus: 200, body: { status: 'error', message: '対象が不正です。' } };
  }

  const tag = asString(data.list);
  const column = TAG_COLUMN[tag];
  if (column === undefined) {
    return {
      httpStatus: 200,
      body: { status: 'error', message: `許可されていないタグです: ${tag}` },
    };
  }

  const inquiryId = asString(data.inquiry_id);
  if (inquiryId === '') {
    return {
      httpStatus: 200,
      body: { status: 'error', message: '対象の反響が指定されていません。' },
    };
  }

  /**
   * ⚠️ 0 / 1 を明示的に受け取る（PHP と同じ）。
   *   旧仕様は「押すたびに反転」だったため、同じリクエストを2回送ると
   *   状態が変わってしまった。値を明示する形にして冪等にしている。
   */
  const value = Number(data.value) === 1 ? 1 : 0;

  try {
    const result = await execute(
      `UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`inquiry_id\` = ?`,
      [value, inquiryId]
    );

    /**
     * ⚠️ 0件更新は「行が無い」と「既に同じ値だった」の両方で起きる。
     *   前者だけをエラーにするため存在確認する（PHP と同じ）。
     */
    if (result.affectedRows === 0) {
      const exists = await query<DynamicRow>(
        `SELECT 1 AS ok FROM \`${table}\` WHERE \`inquiry_id\` = ? LIMIT 1`,
        [inquiryId]
      );
      if (exists.length === 0) {
        return {
          httpStatus: 200,
          body: { status: 'error', message: `${inquiryId} が見つかりません。` },
        };
      }
    }

    return {
      httpStatus: 200,
      body: {
        status: 'success',
        message: `${inquiryId} のタグを更新しました。`,
        tag,
        value,
      },
    };
  } catch (error) {
    logger.error(`list:tag 失敗 inquiry_id=${inquiryId}: ${(error as Error).message}`);
    return {
      httpStatus: 200,
      body: { status: 'error', message: 'タグの更新に失敗しました。' },
    };
  }
};

// ---------------------------------------------------------------------------
// black（ブラックリストの登録・解除）
// ---------------------------------------------------------------------------

/**
 * ブラックリストのトグル。
 *
 * ⚠️⚠️ **3通りに分岐する（PHP と同じ）。**
 *   1. show_key = 1 の行がある      → show_key = 0 にする（解除）
 *   2. show_key = 0 の行がある      → show_key = 1 に戻す（再登録）
 *   3. どちらも無い                  → 新規 INSERT
 *
 * ⚠️ 条件は `mobile = ? OR mail = ?`。**どちらか一方が一致すれば同一人物**と
 *   みなす。⚠️ mobile と mail が両方空だと `'' = '' OR '' = ''` で
 *   **無関係な行に当たる**ため、空のときは弾く（PHP には無いガード。
 *   PHP は空でも実行しており、mobile/mail が空のブラック行があると
 *   その行を解除してしまう）。
 *
 * ⚠️ 登録日は `date('Y/m/d')` と同じ 'YYYY/MM/DD'（スラッシュ区切り）。
 *   ハイフンにすると既存データと書式が混ざる。
 */
const BLACK_DATE = (): string => {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}/${get('month')}/${get('day')}`;
};

export const runListBlack = async (body: unknown): Promise<ListResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const mobile = asString(data.mobile);
  const mail = asString(data.mail);

  // ⚠️ 両方空だと無関係な行に当たる（上のコメント参照）
  if (mobile === '' && mail === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '電話番号かメールアドレスが必要です。' },
    };
  }

  try {
    const status = await withTransaction(async (tx) => {
      const active = await tx.query<DynamicRow>(
        'SELECT id FROM black_list WHERE (mobile = ? OR mail = ?) AND show_key = 1 LIMIT 1',
        [mobile, mail]
      );

      if (active.length > 0) {
        await tx.execute(
          'UPDATE black_list SET show_key = 0 WHERE (mobile = ? OR mail = ?) AND show_key = 1',
          [mobile, mail]
        );
        return 'update_success';
      }

      const any = await tx.query<DynamicRow>(
        'SELECT id FROM black_list WHERE mobile = ? OR mail = ? LIMIT 1',
        [mobile, mail]
      );

      if (any.length > 0) {
        await tx.execute('UPDATE black_list SET show_key = 1 WHERE mobile = ? OR mail = ?', [
          mobile,
          mail,
        ]);
        return 'reactivate_success';
      }

      /**
       * ⚠️⚠️ **`note` を必ず含めること。**
       *   black_list.note は `NOT NULL` で **DEFAULT が無い**。
       *   接続は ① ② とも STRICT_TRANS_TABLES なので、省略すると
       *     Field 'note' doesn't have a default value
       *   で INSERT が必ず失敗する。
       *
       * ⚠️ 2026-09-09 に判明: 移植元 list_black.php は note を省略しており、
       *   **ブラックリストの新規登録は ① でも Fatal error で動いていなかった**
       *   （既存行の解除・再登録＝UPDATE は動く）。
       *   ⚠️ handleBlack は status を console.log するだけなので、
       *     利用者には成功したように見えていた。
       *   ① 側も同時に直している（listAction/list_black.php）。
       *
       * ⚠️ 空文字を入れる。フロントに備考の入力欄が無く、
       *   NULL は列が許可していない。
       */
      await tx.execute(
        `INSERT INTO black_list (name, mobile, mail, brand, date, zip, full_address, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          asString(data.name),
          mobile,
          mail,
          asString(data.brand),
          BLACK_DATE(),
          asString(data.zip),
          // ⚠️ フロントは `address` で送るが、列名は full_address
          asString(data.address),
          asString(data.note),
        ]
      );
      return 'insert_success';
    });

    // ⚠️ 応答のキーは status だけ（PHP と同じ）。値も同じ文字列にする
    return { httpStatus: 200, body: { status } };
  } catch (error) {
    logger.error(`list:black 失敗: ${(error as Error).message}`);
    // ⚠️ PHP は execute() の失敗時に '*_error' を返していた。形をそろえる
    return { httpStatus: 200, body: { status: 'insert_error' } };
  }
};

// ---------------------------------------------------------------------------
// insert（顧客台帳への取り込み）
// ---------------------------------------------------------------------------

/**
 * 反響を顧客台帳へ取り込む（upsert）＋反響側を同期済みにする。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **移植元にトランザクションのバグがあった。**
 *   list_insert.php は `$pdo->beginTransaction()` を**呼んでいない**のに
 *   `if ($pdo->inTransaction()) { $pdo->commit(); }` と書いており、
 *   commit も rollBack も**一度も実行されない**（`inTransaction()` が常に false）。
 *   そのため「顧客台帳は入ったが反響側の sync が立たない」状態が起こりえた。
 *   ⚠️ ここでは withTransaction で本当に囲んでいる。
 *
 * ⚠️ 更新する列は master_data の許可リスト（181列）に限る。
 *   リクエストのキーをそのまま列名に使うと SQL インジェクションになる。
 *   ⚠️ 許可リストは information の移植で作った masterDataColumns.ts を共用する。
 * ─────────────────────────────────────────────
 */
const TODAY_SLASH = (): string => BLACK_DATE();

export const runListInsert = async (body: unknown): Promise<ListResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = asString(data.id);
  if (id === '') {
    return { httpStatus: 200, body: { status: 'error', message: 'IDが指定されていません。' } };
  }

  const category = asString(data.category);
  const table = MASTER_TABLE[category];
  const inquiryTable = INQUIRY_TABLE[category];
  if (table === undefined || inquiryTable === undefined) {
    return {
      httpStatus: 200,
      body: { status: 'error', message: '不正なカテゴリーが指定されました。' },
    };
  }

  const inquiryId = asString(data.inquiry_id);

  // ⚠️ 許可リストにあり、かつリクエストに含まれる列だけを採用する
  const columns: string[] = [];
  const values: SqlParam[] = [];
  for (const column of MASTER_DATA_COLUMNS) {
    if (column === 'id') continue;
    if (!(column in data)) continue;
    const raw = data[column];
    columns.push(column);
    // ⚠️ 空文字は NULL にする（PHP と同じ）
    values.push(raw === '' ? null : (raw as SqlParam));
  }

  /**
   * ⚠️ 初回面談日が送られていなければ**当日**を入れる（PHP と同じ）。
   *   ⚠️ `first_interviewed_date` が許可リストに無いと列が増えないので、
   *     含まれているか確認してから足す。
   */
  if (!columns.includes('first_interviewed_date')) {
    columns.push('first_interviewed_date');
    values.push(TODAY_SLASH());
  }

  try {
    const pgId = await withTransaction(async (tx) => {
      const exists = await tx.query<DynamicRow>(`SELECT id FROM ${table} WHERE id = ?`, [id]);

      if (exists.length > 0) {
        // ⚠️ 更新する列が無ければ UPDATE しない（PHP と同じ）
        if (columns.length > 0) {
          const sets = columns.map((c) => `${c} = ?`).join(', ');
          await tx.execute(`UPDATE ${table} SET ${sets} WHERE id = ?`, [...values, id]);
        }
      } else {
        // ⚠️ id を先頭に足す
        const cols = ['id', ...columns];
        await tx.execute(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          [id, ...values]
        );
      }

      // ⚠️ inquiry_id が無いときは反響側を触らない（PHP と同じ）
      if (inquiryId !== '') {
        await tx.execute(
          `UPDATE ${inquiryTable} SET pg_id = ?, sync = 1 WHERE inquiry_id = ?`,
          [id, inquiryId]
        );
      }

      // ⚠️ PHP は取り込み後の pg_id を SELECT して返している。
      //   フロントがそれで表示を更新するため、同じ形（行オブジェクト）で返す
      if (inquiryId === '') return null;
      const rows = await tx.query<DynamicRow>(
        `SELECT pg_id FROM ${inquiryTable} WHERE inquiry_id = ?`,
        [inquiryId]
      );
      return rows[0] ?? null;
    });

    const customerName = asString(data.customer_contacts_name) || 'お客様';

    return {
      httpStatus: 200,
      body: {
        status: 'success',
        // ⚠️ PHP は fetch() の結果をそのまま入れる。該当なしは false
        pg_id: pgId ?? false,
        message: `${customerName}様の情報を保存し、連携データを更新しました。`,
      },
    };
  } catch (error) {
    // ⚠️ PHP は例外メッセージをそのまま返していた（列名やSQLが漏れる）
    logger.error(`list:insert 失敗 id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 200,
      body: { status: 'error', message: 'データベースエラーが発生しました。' },
    };
  }
};
