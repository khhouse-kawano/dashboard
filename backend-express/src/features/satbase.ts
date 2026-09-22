import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';

/**
 * SatBaseサマリー（header/SatBaseDatabase.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 取り込み元は SatBase の物件台帳（中間加工）。
 *   ⚠️ テーブルは `backend/scripts/sql/2026-09-22_satbase_property.sql` で作る。
 *
 * ⚠️⚠️ **画面から更新できるのは `ad_posted` と `instagram_posted` の2列だけ。**
 *   ⚠️ ⚠️ **他の列は SatBase 側が正である。** ⚠️ 画面から書き換えてはならない。
 *   ⚠️ 列名を受け取って UPDATE する作りにしないこと（どの列でも書けてしまう）。
 *
 * ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
 *   ⚠️ そのため `express_proxy.php` の
 *     ⚠️ **`expressProxyRequests()` と `expressProxyExclusive()` の両方**に入れる。
 *
 * ⚠️ 1,900行ほど。⚠️ **全件を1度に返し、絞り込みと並べ替えは画面で行う。**
 *   ⚠️ 列が40あるため、⚠️ **列を足すときは転送量を意識すること。**
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * ⚠️⚠️ **画面から書き換えてよい列。**
 *   ⚠️ ⚠️ **ここに無い列名は受け付けない。** ⚠️ 追加するときは指示を受けてからにすること。
 */
const EDITABLE_COLUMNS = ['ad_posted', 'instagram_posted'] as const;

type EditableColumn = (typeof EDITABLE_COLUMNS)[number];

const isEditableColumn = (value: string): value is EditableColumn =>
  (EDITABLE_COLUMNS as readonly string[]).includes(value);

/**
 * 一覧。
 *
 * ⚠️ 並べ替えは ⚠️ **`property_id` の降順**（新しい物件が上）。
 *   ⚠️ ⚠️ **文字列ではなく数値で並べる**。⚠️ 列が INT なので SQL 側で正しく並ぶ。
 */
export const runSatbaseList = async (): Promise<unknown> => {
  const rows = await query<DynamicRow>(
    'SELECT * FROM satbase_property ORDER BY property_id DESC'
  );

  return { properties: rows };
};

export interface SatbaseUpdateInput {
  propertyId: number;
  column: string;
  value: number;
  staff: string;
}

/**
 * トグルの更新。
 *
 * ⚠️⚠️ **列名は許可リストと突き合わせてから SQL に入れる。**
 *   ⚠️ ⚠️ **プレースホルダは列名には使えない**ので、ここを通さないと
 *     ⚠️ **任意の列を書き換えられる穴になる。**
 *
 * ⚠️ 値は 0 か 1 に丸める。⚠️ **画面がトグルなので、それ以外は来ない前提にしない。**
 */
export const runSatbaseUpdate = async (
  input: SatbaseUpdateInput
): Promise<{ status: string; message?: string }> => {
  if (!Number.isInteger(input.propertyId) || input.propertyId <= 0) {
    return { status: 'error', message: '物件が指定されていません。' };
  }

  if (!isEditableColumn(input.column)) {
    // ⚠️ 列名はそのまま返さない（何が書ける列かを外へ知らせない）
    return { status: 'error', message: 'この項目は画面から変更できません。' };
  }

  const value = input.value === 1 ? 1 : 0;

  const result = await execute(
    `UPDATE satbase_property
        SET ${input.column} = ?, updated = NOW(), updated_by = ?
      WHERE property_id = ?`,
    [value, input.staff.slice(0, 128), input.propertyId]
  );

  if (result.affectedRows === 0) {
    return { status: 'error', message: '物件が見つかりませんでした。' };
  }

  return { status: 'ok' };
};
