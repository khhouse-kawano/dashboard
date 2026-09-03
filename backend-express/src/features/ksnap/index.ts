import { execute, query } from '../../db/pool';
import type { RowDataPacket } from 'mysql2/promise';
import type { SqlParam } from '../../db/pool';
import { encryptOwnerColumn } from './owner';

/**
 * K-SNAP（スナップ写真）。
 *
 * 移植元: backend/src/handlers/k-snap*.php
 *   （もともと ① の /k-snap/api/ にあった別アプリ。2026-09-03 に dashboard へ集約）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 顧客向け（公開）とスタッフ向けが混在している
 *
 *   顧客向け（認証を要求してはいけない）
 *     k-snap_login / k-snap / k-snap_customer / k-snap_customer_update
 *   スタッフ向け（認証を要求すべき）
 *     k-snap_edit / k-snap_load / k-snap_show
 *
 *   ⚠️ 認証を一括で強化するとき、顧客向けを除外しないと
 *     **公開ギャラリーが止まる**（顧客はスタッフのトークンを持たない）。
 * ─────────────────────────────────────────────
 *
 * ⚠️ k-snap_update（画像アップロード）は移植していない。
 *   画像の保存先が ① のファイルシステムであり、② から書き込めないため。
 *   SSHトンネルは MySQL の TCP だけを通している。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** PHP の (string) と同じ寄せ方。数値や null で落ちないようにする */
const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

// ---------------------------------------------------------------------------
// 顧客向け（公開）
// ---------------------------------------------------------------------------

/**
 * 公開ギャラリーのログイン。パスワードから顧客IDを引く。
 *
 * 移植元: k-snap_login.php
 *
 * ⚠️ SELECT のみ。名前に login を含むが書き込みはしない。
 *   差分比較には --read-only-verified が必要。
 *
 * ⚠️ 平文比較で試行回数の制限も無い。移植では挙動を変えていないが、
 *   総当たりで他人の顧客ページに入れる状態である。
 */
export const runKSnapLogin = async (
  rawPass: unknown
): Promise<{ status: 'success'; id: unknown } | { status: 'error' | 'not_found' }> => {
  const pass = asString(rawPass);

  // ⚠️ PHP は trim して空なら error を返す。ここも同じ判定にする
  if (pass.trim() === '') {
    return { status: 'error' };
  }

  const rows = await query<DynamicRow>(
    'SELECT `id` FROM `k-snap_customer` WHERE `pass` = ? LIMIT 1',
    [pass]
  );

  const row = rows[0];
  if (row === undefined) {
    return { status: 'not_found' };
  }

  return { status: 'success', id: row.id };
};

/**
 * 公開ギャラリー向けのスナップ一覧。
 *
 * 移植元: k-snap.php
 *
 * ⚠️ show_snap = 1 で絞り、owner を暗号化する。
 *   スタッフ向けの runKSnapEdit とは**両方の点で異なる**。混同しないこと。
 */
export const runKSnapPublic = async (): Promise<{ snaps: Record<string, unknown>[] }> => {
  const snaps = await query<DynamicRow>('SELECT * FROM `k-snap` WHERE show_snap = 1');
  return { snaps: encryptOwnerColumn(snaps) };
};

/**
 * 公開ギャラリー用の顧客1件。
 *
 * 移植元: k-snap_customer.php
 *
 * ⚠️ SELECT * のため pass（パスワード）も返る。移植では形を変えていないが、
 *   id を変えれば任意の顧客のパスワードが取得できる状態である。
 */
export const runKSnapCustomer = async (
  rawId: unknown
): Promise<{ status: 'success'; customer: Record<string, unknown> | false }> => {
  const rows = await query<DynamicRow>(
    'SELECT * FROM `k-snap_customer` WHERE id = ?',
    [asString(rawId)]
  );

  // ⚠️ `?? null` にしてはいけない。PHP の fetch() は行が無いと false を返す
  return { status: 'success', customer: rows[0] ?? false };
};

/**
 * 公開ギャラリーでの顧客操作の記録。
 *
 * 移植元: k-snap_customer_update.php
 *
 * ⚠️⚠️ **書き込み系。① の転送許可リストに入れてはいけない。**
 *   自動フォールバックで二重実行される。
 *
 * ⚠️ 移植元は成功しても何も出力しない。フロントがレスポンスを見ていないため、
 *   形を変えず空のレスポンスにする（PHPは空文字を返す）。
 *
 * ⚠️ id の持ち主であることを確認していない。任意の id を送れば
 *   他人の閲覧履歴を上書きできる。移植では挙動を変えていない。
 */
const CUSTOMER_UPDATE_KEYS = ['tag', 'bookmark', 'setting', 'path', 'log'] as const;

export const runKSnapCustomerUpdate = async (
  body: Record<string, unknown>
): Promise<void> => {
  const columns: string[] = [];
  const values: SqlParam[] = [];

  for (const key of CUSTOMER_UPDATE_KEYS) {
    // ⚠️ PHP の isset() は null を「無い」と判定する。同じ扱いにする
    if (body[key] !== undefined && body[key] !== null) {
      columns.push(key);
      values.push(asString(body[key]));
    }
  }

  if (columns.length === 0) {
    return;
  }

  const id = asString(body.id);

  // ⚠️ PHP は !empty($data['id']) で判定している。'0' も空扱いになる点まで揃える
  const hasId = id !== '' && id !== '0';

  let isUpdate = false;
  if (hasId) {
    const existing = await query<DynamicRow>(
      'SELECT 1 AS ok FROM `k-snap_customer` WHERE `id` = ?',
      [id]
    );
    isUpdate = existing.length > 0;
  }

  if (isUpdate) {
    const setClause = columns.map((col) => `\`${col}\` = ?`).join(', ');
    await execute(
      `UPDATE \`k-snap_customer\` SET ${setClause} WHERE \`id\` = ?`,
      [...values, id]
    );
    return;
  }

  // 新規。id が指定されていればそれも列に含める（PHPと同じ）
  const insertColumns = hasId ? [...columns, 'id'] : columns;
  const insertValues = hasId ? [...values, id] : values;

  const columnsClause = insertColumns.map((col) => `\`${col}\``).join(', ');
  const placeholders = insertColumns.map(() => '?').join(', ');

  await execute(
    `INSERT INTO \`k-snap_customer\` (${columnsClause}) VALUES (${placeholders})`,
    insertValues
  );
};

// ---------------------------------------------------------------------------
// スタッフ向け
// ---------------------------------------------------------------------------

/**
 * ダッシュボードの顧客詳細（information/KSnap.tsx）。
 *
 * 移植元: backend/src/handlers/kSnap.php
 *
 * ⚠️ request 名は `kSnap`（キャメルケース）で、公開ギャラリー向けの
 *   `k-snap` とは別物である。**取り違えると返す内容がまったく違う。**
 *
 *     kSnap   … 顧客1件 ＋ スナップ全件。ダッシュボードで閲覧状況を見る
 *     k-snap  … show_snap = 1 のスナップのみ。owner は暗号化
 *
 * ⚠️ スナップを全件返している。顧客の閲覧ログ・お気に入り・拡大表示が
 *   スナップIDの羅列で保存されており、画面側で突き合わせているため。
 */
export const runKSnap = async (rawId: unknown): Promise<{
  customer: Record<string, unknown> | false;
  snap: Record<string, unknown>[];
}> => {
  const [customerRows, snap] = await Promise.all([
    query<DynamicRow>('SELECT * FROM `k-snap_customer` WHERE id = ?', [asString(rawId)]),
    query<DynamicRow>('SELECT * FROM `k-snap`'),
  ]);

  // ⚠️ `?? null` にしてはいけない。PHP の fetch() は行が無いと false を返す
  return { customer: customerRows[0] ?? false, snap };
};

/**
 * スタッフ向けのスナップ一覧（全件・owner は平文）。
 *
 * 移植元: k-snap_edit.php
 *
 * ⚠️ show_snap で絞らない。非公開の写真も管理するため。
 */
export const runKSnapEdit = async (): Promise<{ snaps: Record<string, unknown>[] }> => {
  const snaps = await query<DynamicRow>('SELECT * FROM `k-snap`');
  return { snaps };
};

/**
 * 編集画面の初期データ。
 *
 * 移植元: k-snap_load.php
 *
 * ⚠️ id が空でも動く（新規登録の初期表示）。その場合 snap は false になる。
 */
export const runKSnapLoad = async (
  rawId: unknown
): Promise<{ snap: Record<string, unknown> | false; owner: Record<string, unknown>[] }> => {
  const [snapRows, owner] = await Promise.all([
    query<DynamicRow>('SELECT * FROM `k-snap` WHERE id = ?', [asString(rawId)]),
    query<DynamicRow>('SELECT owner FROM `k-snap`'),
  ]);

  return { snap: snapRows[0] ?? false, owner };
};

/**
 * 公開/非公開、営業名表示の切り替え。
 *
 * 移植元: k-snap_show.php
 *
 * ⚠️⚠️ **書き込み系。① の転送許可リストに入れてはいけない。**
 *
 * ⚠️ key はホワイトリストで検証する。緩めると UPDATE で任意の列を書き換えられる。
 */
const SHOW_ALLOWED_COLUMNS = ['show_snap', 'staff_show'];

export const runKSnapShow = async (
  body: Record<string, unknown>
): Promise<{ status: 'success' | 'error' | 'invalid_column' }> => {
  const key = asString(body.key);

  if (!SHOW_ALLOWED_COLUMNS.includes(key)) {
    return { status: 'invalid_column' };
  }

  try {
    await execute(
      `UPDATE \`k-snap\` SET \`${key}\` = ? WHERE id = ?`,
      [asString(body.flag), asString(body.id)]
    );
    return { status: 'success' };
  } catch {
    // ⚠️ PHP は execute の戻り値で判定して 'error' を返す。同じ形にする
    return { status: 'error' };
  }
};
