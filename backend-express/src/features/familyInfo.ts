import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../db/pool';

/**
 * 家族情報（FamilyInfo.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元は**旧API**（`/dashboard/api/` の `demand` 形式）である。
 *
 *   demand: 'show_family_info'   → runFamilyInfoShow
 *   demand: 'update_family_info' → runFamilyInfoUpdate
 *
 * ⚠️⚠️ 旧APIのソースは現行の `backend/` に**存在しない**。
 *   `backup/back/20260625/api/actions/{show,update}_family_info.php` に
 *   バックアップだけが残っている。① の稼働中のファイルはリポジトリ管理外。
 *   そのため差分比較ツールで ① と突き合わせることができない。
 *   挙動はバックアップのSQLをそのまま写している。
 *
 * ⚠️⚠️ **`backend/src/handlers/family_info.php` を作ってはいけない。**
 *   作った瞬間に「② への転送が失敗 → ① で自動フォールバック」の経路が
 *   生まれ、update が二重実行される。アンバサダー／紹介キャンペーンと
 *   同じ扱いで、PHPハンドラを持たない前提で許可リストに入れている。
 *
 * ⚠️ 引き換えに、② が落ちると家族情報モーダルだけが動かなくなる。
 *   顧客詳細の他の項目には影響しない。
 * ─────────────────────────────────────────────
 *
 * テーブル: family_info（id / shop / name / family_info）
 * ⚠️ 列名とテーブル名が同じ（`family_info.family_info`）。読み違えに注意。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const SHOW_SQL = 'SELECT * FROM family_info WHERE id = ?';

/**
 * ⚠️ `ON DUPLICATE KEY UPDATE` は family_info.id に
 *   PRIMARY KEY または UNIQUE キーがあることを前提にしている
 *   （旧APIから引き継いだ前提）。キーが無いと毎回 INSERT され、
 *   同じ顧客の行が増え続ける。
 *
 * ⚠️ `id` は更新句に入れない。WHERE 相当のキーであり、
 *   VALUES(id) を代入しても意味が無い。
 */
const UPSERT_SQL = `
  INSERT INTO family_info (id, shop, name, family_info) VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    shop = VALUES(shop),
    name = VALUES(name),
    family_info = VALUES(family_info)
`;

/** ハンドラの戻り値。ステータスコードを出し分けるため本文と一緒に持つ */
export interface FamilyInfoResult {
  httpStatus: number;
  body: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

// ---------------------------------------------------------------------------
// 参照
// ---------------------------------------------------------------------------

/**
 * 1件取得。
 *
 * ⚠️ 該当なしのとき **`false`** を返す。`{}` や `null` ではない。
 *   旧APIは `$stmt->fetch()` の結果をそのまま json_encode しており、
 *   PDO は該当なしで `false` を返す。
 *   FamilyInfo.tsx は `if (!family || !family.family_info) return;` で
 *   受けているため false でも壊れないが、`{}` に変えると
 *   `setFamily()` の後の判定が通る／通らないが入れ替わる。
 *
 * ⚠️ `family_info` 列は**文字列のまま**返る（pool.ts の jsonStrings: true）。
 *   FamilyInfo.tsx が `JSON.parse(family.family_info)` しているため、
 *   オブジェクトで返すと即座に例外になる。
 */
export const runFamilyInfoShow = async (id: unknown): Promise<FamilyInfoResult> => {
  const targetId = asString(id).trim();

  // ⚠️⚠️ **空文字では検索しない。** family_info には id が空の行が実在する
  //   （ローカルDBで1件確認。取り込み時の不良データ）。
  //   `WHERE id = ''` で検索すると **その行＝他人の家族情報**が返ってしまう。
  //
  //   旧APIは `$data['id']` が未指定のとき null になり
  //   `WHERE id = NULL` は何にも一致しないため、結果は false だった。
  //   ここで false を返すのは、その挙動に合わせるためでもある。
  //
  // ⚠️ 400 にはしない。旧APIはエラーを返しておらず、
  //   FamilyInfo.tsx は `if (!family || !family.family_info) return;` で
  //   false を正常に受けられる。
  if (targetId === '') {
    return { httpStatus: 200, body: false };
  }

  const rows = await query<DynamicRow>(SHOW_SQL, [targetId]);

  return { httpStatus: 200, body: rows[0] ?? false };
};

// ---------------------------------------------------------------------------
// 更新
// ---------------------------------------------------------------------------

/**
 * 家族情報の登録・更新（upsert）。
 *
 * ⚠️ `family_info` は配列で送られてくる（FamilyInfo.tsx の familyMember）。
 *   旧APIと同じく、ここで JSON 文字列に変換して保存する。
 *   フロントが JSON 文字列を送ってくると二重エンコードになるため、
 *   文字列で来た場合はそのまま保存する（旧APIは二重エンコードしていたが、
 *   実際にはフロントが常に配列を送るため差は出ない）。
 *
 * ⚠️ 保存後に SELECT し直して返すのも旧APIの挙動。
 *   FamilyInfo.tsx が `setFamily(response.data)` で受けているため、
 *   返さないと画面の状態が更新されない。
 */
export const runFamilyInfoUpdate = async (body: unknown): Promise<FamilyInfoResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = asString(data.id).trim();

  if (id === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: 'IDが指定されていません。' },
    };
  }

  const shop = asString(data.shop);
  const name = asString(data.name);

  // ⚠️ 空配列を保存する経路も残す。FamilyInfo.tsx 側で
  //   `if (familyMember.length === 0) return;` と防いでいるが、
  //   API としては受け付けて '[]' を保存する（旧APIと同じ）。
  const familyInfo =
    typeof data.family_info === 'string'
      ? data.family_info
      : JSON.stringify(data.family_info ?? []);

  await execute(UPSERT_SQL, [id, shop, name, familyInfo]);

  const rows = await query<DynamicRow>(SHOW_SQL, [id]);

  return { httpStatus: 200, body: rows[0] ?? false };
};
