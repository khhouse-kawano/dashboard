import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * インサイドセールスの架電一覧（insideSales/InsideSales.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/inside.php → insideAction/inside_list.php
 *
 * ⚠️ 参照のみ。① に PHP ハンドラが実在するので、転送に失敗したら
 *   ① にフォールバックしてよい（フォールバック禁止には登録しない）。
 *
 * ⚠️ roll は 'list' だけ。① の inside.php も 'list' しか許可していない。
 *   ⚠️ 書き込み（架電結果の保存）はこの request には無い。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface InsideResult {
  httpStatus: number;
  body: unknown;
}

/**
 * 架電対象の店舗。
 *
 * ⚠️⚠️ **フロントに直書きせず、ここ1箇所で持つ。**
 *   ⚠️ 店舗が増えたらこの配列に足すこと。
 *     ① の insideAction/inside_list.php にも**同じ内容がある**ので、
 *     片方だけ直すと転送失敗時に対象店舗が食い違う。
 *
 * ⚠️⚠️ **'PG HOUSE霧島店' は表記ゆれである。消さないこと。**
 *   2026-09-11 に 'PGH霧島店' を追加する際、実データを数えたところ
 *
 *     PGH霧島店       … 222件
 *     PG HOUSE霧島店  … **1件**
 *
 *   の2通りが `call_sheet.shop` に入っていた。
 *   'PGH霧島店' だけにすると**この1件が架電一覧から漏れる**（エラーは出ない）。
 *
 *   ⚠️ 本来は**データを直すのが筋**である。`call_sheet` の
 *     'PG HOUSE霧島店' を 'PGH霧島店' に UPDATE したら、
 *     ここと ① の inside_list.php から**この行を消してよい**。
 *   ⚠️ 直すまでは残すこと。消すと静かに1件減る。
 *
 * ⚠️ 将来的には shop_list に列を足して DB 管理にするのが望ましい
 *   （フロント直書きの設定をDB化する長期課題と同じ話）。
 */
const TARGET_SHOPS = [
  'KH熊本店',
  'KH八代店',
  'JH熊本店',
  'JH八代店',
  'PGH霧島店',
  // ⚠️ 表記ゆれ（実データ1件）。データを直したらこの行を消す
  'PG HOUSE霧島店',
];

/**
 * 架電情報。
 * ⚠️ `SELECT *` は PHP のまま。列は運用で増える前提で、画面側が必要な分だけ読む。
 */
const CALL_SQL = `SELECT * FROM call_sheet WHERE shop IN (${TARGET_SHOPS.map(() => '?').join(', ')})`;

/**
 * インサイドセールス担当。
 *
 * ⚠️⚠️ **`staff.brand = 'insideSales'` では引かないこと。**
 *   あれはログインの権限区分であって担当者の登録簿ではない。
 *   以前それで引いており、実際の担当3名のうち**1名しか返っていなかった**。
 *   正しくは `staff_list.inside = 1`。
 *
 * ⚠️ staff_list は配属年度（period）ごとに行が増え、同じ人が複数行に現れる。
 *   GROUP BY で1人1行に畳まないと、年度が変わったときに
 *   セレクトボックスへ同じ名前が並ぶ。
 */
const STAFF_SQL = `
  SELECT name
    FROM staff_list
   WHERE inside = 1 AND name <> ''
   GROUP BY name
   ORDER BY MIN(sort), MIN(id)
`;

export const runInside = async (rawRoll: unknown): Promise<InsideResult> => {
  /**
   * ⚠️ PHP は `$data['roll'] ?? 'list'`。**キーが無いときだけ 'list'**。
   *   `|| 'list'` と書くと空文字も 'list' になり挙動が変わる。
   */
  const roll =
    rawRoll === undefined || rawRoll === null
      ? 'list'
      : typeof rawRoll === 'string'
        ? rawRoll
        : '';

  if (roll !== 'list') {
    // ⚠️ メッセージは PHP のまま（「無効なカテゴリです」）。roll の話だが揃えてある
    return {
      httpStatus: 400,
      body: { status: 'error', message: '無効なカテゴリです' },
    };
  }

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じ
  const [call, staff] = await Promise.all([
    query<DynamicRow>(CALL_SQL, TARGET_SHOPS),
    query<DynamicRow>(STAFF_SQL),
  ]);

  // ⚠️ キー名と順序は PHP と同じにする
  return {
    httpStatus: 200,
    body: { call, staff },
  };
};
