import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';

/**
 * SatBaseサマリー（header/SatBaseDatabase.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 取り込み元は SatBase の物件台帳（中間加工）。
 *   ⚠️ テーブルは `backend/scripts/sql/2026-09-22_satbase_property.sql` で作る。
 *
 * ⚠️⚠️ **2026-09-29（v2.2.152）から表が2つに分かれている。**
 *   ⚠️ `satbase_property`      … ⚠️⚠️ **SatBaseの写し。CSVで丸ごと入れ替えてよい**
 *   ⚠️ `satbase_property_flag` … ⚠️⚠️ **画面から入れた値。取り込みで触らない**
 *   ⚠️ ⚠️ **分けた理由**: 同居していた頃は、⚠️ **CSVを入れ直すたびに
 *     ⚠️ トグルがゼロに戻っていた。**
 *   ⚠️ 作る SQL: `backend/scripts/sql/2026-09-29_satbase_property_flag.sql`
 *   ⚠️ 入れ替え手順: `backend/scripts/sql/2026-09-29_satbase_property_reload.sql`
 *
 * ⚠️⚠️ **画面から更新できるのは `ad_posted` と `instagram_posted` の2列だけ。**
 *   ⚠️ ⚠️ **他の列は SatBase 側が正である。** ⚠️ 画面から書き換えてはならない。
 *   ⚠️ 列名を受け取って UPDATE する作りにしないこと（どの列でも書けてしまう）。
 *   ⚠️ ⚠️ **いまは書き込み先が flag 表しかないので、そもそも台帳側へは届かない。**
 *     ⚠️ ただし許可リストは残す（⚠️ **flag 表の中でも列は選ばせない**）。
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
 *
 * ⚠️⚠️ **LEFT JOIN であること。**
 *   ⚠️ ⚠️ **flag 表には「一度でも触られた物件」しか行が無い。**
 *     ⚠️ 内部結合にすると ⚠️ **未操作の物件が一覧から消える。**
 *
 * ⚠️⚠️ **`COALESCE` で 0 に落とすこと。**
 *   ⚠️ 画面は `Number(p.ad_posted ?? 0)` で見ているので NULL でも動くが、
 *     ⚠️ ⚠️ **絞り込み（未出稿）が NULL と 0 で割れる**ため揃えておく。
 *
 * ⚠️ ⚠️ **返す形は分割前と同じ。** ⚠️ 画面側（SatBaseDatabase.tsx）は変えていない。
 */
export const runSatbaseList = async (): Promise<unknown> => {
  const rows = await query<DynamicRow>(
    `SELECT p.*,
            COALESCE(f.ad_posted, 0)        AS ad_posted,
            COALESCE(f.instagram_posted, 0) AS instagram_posted,
            f.updated                       AS updated,
            f.updated_by                    AS updated_by
       FROM satbase_property p
       LEFT JOIN satbase_property_flag f ON f.property_id = p.property_id
      ORDER BY p.property_id DESC`
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
 *
 * ⚠️⚠️ **書き込み先は `satbase_property_flag`。**
 *   ⚠️ ⚠️ **初回は行が無いので UPDATE では入らない。** ⚠️ 追加と更新を兼ねる形にする。
 *   ⚠️ ⚠️ **触っていない方の列は 0 で入る**（⚠️ 既定値と同じなので問題ない）。
 *
 * ⚠️⚠️ **物件の存在は台帳側で確かめる。**
 *   ⚠️ ⚠️ **追加と更新を兼ねる書き方では、存在しない物件IDでも黙って1行増える。**
 *     ⚠️ 台帳に無い物件の行が溜まるのを防ぐため、先に見に行く。
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

  const exists = await query<DynamicRow>(
    'SELECT property_id FROM satbase_property WHERE property_id = ? LIMIT 1',
    [input.propertyId]
  );

  if (exists.length === 0) {
    return { status: 'error', message: '物件が見つかりませんでした。' };
  }

  const value = input.value === 1 ? 1 : 0;
  const adPosted = input.column === 'ad_posted' ? value : 0;
  const instagramPosted = input.column === 'instagram_posted' ? value : 0;

  // ⚠️ 列名は許可リストを通っているので、ここで埋め込んでよい
  await execute(
    `INSERT INTO satbase_property_flag
       (property_id, ad_posted, instagram_posted, updated, updated_by)
     VALUES (?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       ${input.column} = VALUES(${input.column}),
       updated         = NOW(),
       updated_by      = VALUES(updated_by)`,
    [input.propertyId, adPosted, instagramPosted, input.staff.slice(0, 128)]
  );

  return { status: 'ok' };
};
