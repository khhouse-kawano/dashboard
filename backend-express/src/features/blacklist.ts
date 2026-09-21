import type { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../db/pool';

/**
 * ブラックリスト名簿の編集（header/EditBlackList.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元:
 *     backend/src/handlers/header_blacklist_edit.php    （一覧）
 *     backend/src/handlers/header_blacklist_insert.php  （追加）
 *     backend/src/handlers/header_blacklist_update.php  （1列だけ更新）
 *
 * ⚠️⚠️ **`black_list` テーブル（名簿）と、反響の `black` タグはまったくの別物。**
 *   ⚠️ タグ側は `inquiry_customer*` のフラグ列で、features/list/ が扱う。
 *   ⚠️ ここは**名簿そのもの**で、反響一覧の突合に使われる元データである。
 *
 * ⚠️⚠️ **書き込みがある（insert / update）ので `expressProxyExclusive` には入れない。**
 *   ⚠️ ① に PHP ハンドラが3本とも実在するため、② が落ちても ① へ
 *     フォールバックして動く。⚠️ **二重に書かれることはない**
 *     （転送が成功した時点で ① 側は実行しない）。
 *
 * ⚠️⚠️ **主キーは `no`（AUTO_INCREMENT）。`id` ではない。**
 *   ⚠️ `id` は text 列で、移植元が `uniqid('bl_')` を入れているだけの飾りである。
 *   ⚠️ 画面も `no` で更新している。⚠️ **`id` を WHERE に使わないこと。**
 *
 * ⚠️ `note` は **NOT NULL で DEFAULT が無い。** ⚠️ 空文字を必ず入れること。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface BlacklistResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/**
 * 1列だけ更新できる列の許可リスト。
 *
 * ⚠️⚠️ **移植元（header_blacklist_update.php）と1語も違えないこと。**
 *   ⚠️ 列名をそのまま SQL に埋めるため、⚠️ **ここが唯一の防御**である。
 * ⚠️ `no` と `id` と `date` は入れない（主キーと採番、登録日は変えない）。
 */
const ALLOWED_COLUMNS = [
  'name',
  'brand',
  'mail',
  'mobile',
  'zip',
  'full_address',
  'note',
  'show_key',
] as const;

type AllowedColumn = (typeof ALLOWED_COLUMNS)[number];

const isAllowedColumn = (value: string): value is AllowedColumn =>
  (ALLOWED_COLUMNS as readonly string[]).includes(value);

/** 文字列として受け取る。⚠️ null / undefined は空文字（列が NOT NULL のものがある） */
const toText = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

/**
 * `id` 列のダミー値。
 * ⚠️ 移植元の PHP `uniqid('bl_')` に合わせた形。⚠️ **一意性に依存していない。**
 *   ⚠️ 画面も検索もこの値を使わない。⚠️ 列が NULL 可なので本来は不要だが、
 *     ⚠️ ① の挙動と揃えるために入れている。
 */
const newDummyId = (): string =>
  `bl_${Date.now().toString(16)}${Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')}`;

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **`show_key = 0`（解除済み）も返す。**
 *   ⚠️ 画面に「有効/解除」のスイッチがあり、解除したものを戻せる必要がある。
 *   ⚠️ 反響一覧の突合（features/list/queries.ts の BLACK_SQL）は
 *     `show_key = 1` で絞っている。⚠️ **あちらと同じにしないこと。**
 */
export const runBlacklistEdit = async (): Promise<BlacklistResult> => {
  const blacklist = await query<DynamicRow>('SELECT * FROM `black_list`');
  return { httpStatus: 200, body: { blacklist } };
};

// ---------------------------------------------------------------------------
// 追加
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **採番された `no` を必ず返すこと。**
 *   ⚠️ 画面は返ってきた `no` をそのまま行のキーにして、
 *     ⚠️ **続けて編集した内容を同じ行へ送る。**
 *   ⚠️ 返さないと画面が `Date.now()` を仮のキーにするため、
 *     ⚠️ **その直後の編集が DB の別の行を更新しようとする。**
 */
export const runBlacklistInsert = async (
  body: Record<string, unknown>
): Promise<BlacklistResult> => {
  const name = toText(body.name).trim();
  if (name === '') {
    return { httpStatus: 400, body: { status: 'error', message: '顧客名を入力してください。' } };
  }

  // ⚠️ 画面が送ってくるが、無いときは今日（移植元と同じ `Y/m/d`）
  const today = new Date();
  const fallbackDate =
    `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

  const result = await execute(
    `INSERT INTO black_list (id, name, brand, date, mail, mobile, zip, full_address, note, show_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toText(body.id) === '' ? newDummyId() : toText(body.id),
      name,
      toText(body.brand) === '' ? '全社' : toText(body.brand),
      toText(body.date) === '' ? fallbackDate : toText(body.date),
      toText(body.mail),
      toText(body.mobile),
      toText(body.zip),
      toText(body.full_address),
      // ⚠️ `note` は NOT NULL で DEFAULT が無い
      toText(body.note),
      body.show_key === undefined ? 1 : Number(body.show_key) === 1 ? 1 : 0,
    ]
  );

  return { httpStatus: 200, body: { status: 'success', no: String(result.insertId) } };
};

// ---------------------------------------------------------------------------
// 更新（1列だけ）
// ---------------------------------------------------------------------------

/**
 * ⚠️⚠️ **画面は「変えた1列だけ」を送ってくる**（`onBlur` ごとに1回）。
 *   ⚠️ `no` と `request` 以外のキーが**ちょうど1つ**入っている前提である。
 *   ⚠️ 移植元は `array_key_first()` で先頭を取っていた。ここでも同じく
 *     **許可リストに載っている最初のキー**を採用する。
 *
 * ⚠️ 該当が無ければ `invalid_request` を返す（移植元と同じ文字列）。
 *   ⚠️ 画面はこの値をコンソールに出すだけなので、⚠️ **黙って失敗して見える。**
 */
export const runBlacklistUpdate = async (
  body: Record<string, unknown>
): Promise<BlacklistResult> => {
  const no = Number(toText(body.no));
  if (!Number.isInteger(no) || no <= 0) {
    return { httpStatus: 200, body: { status: 'invalid_request' } };
  }

  const column = Object.keys(body).find(key => isAllowedColumn(key));
  if (column === undefined) {
    return { httpStatus: 200, body: { status: 'invalid_request' } };
  }

  /**
   * ⚠️ `show_key` だけは数値。⚠️ 文字列 `"0"` を入れると tinyint に 0 が入るので
   *   実害は無いが、⚠️ **型を揃えておく**（画面は `"0"` / `"1"` を送ってくる）。
   */
  const value =
    column === 'show_key' ? (Number(toText(body[column])) === 1 ? 1 : 0) : toText(body[column]);

  // ⚠️ 列名は許可リストを通ったものだけ。⚠️ **値は必ずプレースホルダで渡す。**
  const result = await execute(`UPDATE black_list SET \`${column}\` = ? WHERE \`no\` = ?`, [value, no]);

  return { httpStatus: 200, body: { status: result.affectedRows >= 0 ? 'success' : 'error' } };
};
