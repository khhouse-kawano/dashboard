import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { listSql } from './queries';
import type { ListCategory } from './queries';

/**
 * 反響一覧の初期データ（list/ListOrder.tsx / ListKaeru.tsx / ListResale.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/list.php → listAction/list_{category}.php
 *
 * ⚠️⚠️ **① の PHP ハンドラは実在する。** 参照のみなので、転送に失敗したら
 *   ① にフォールバックしてよい（フォールバック禁止には登録しない）。
 *
 * ⚠️ list.php は roll でも分岐する（insert / black / tag / shop_change /
 *   staff_change / event）。**それらはまだ移植していない。**
 *   ゲートウェイは request + roll の完全一致で引くので、
 *   未登録の roll は自動で ① へ転送される。
 *   ⚠️ 移植するときは書き込み系なので expressProxyExclusive() が必要。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface ListResult {
  httpStatus: number;
  body: unknown;
}

const ALLOWED: ListCategory[] = ['order', 'spec', 'used'];

const isListCategory = (value: string): value is ListCategory =>
  (ALLOWED as string[]).includes(value);

export const runList = async (rawCategory: unknown): Promise<ListResult> => {
  const category = typeof rawCategory === 'string' ? rawCategory : '';

  /**
   * ⚠️ list.php の許可リストは ['order', 'spec', 'used', 'common'] で
   *   'common' も通していたが、`listAction/list_common.php` は**存在しない**
   *   （require で fatal error になる）。ここでは 400 を返す。
   *   ⚠️ 実際に 'common' を送っている画面は無い（2026-09-09 に確認）。
   */
  if (!isListCategory(category)) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '無効なカテゴリです' },
    };
  }

  const sql = listSql(category);

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
  //   反響一覧と master_data が数万行あるため待ち時間が縮む
  const [summary, shop, staff, medium, inquiry, survey, black] = await Promise.all([
    query<DynamicRow>(sql.summary),
    query<DynamicRow>(sql.shop),
    query<DynamicRow>(sql.staff),
    query<DynamicRow>(sql.medium),
    query<DynamicRow>(sql.inquiry),
    query<DynamicRow>(sql.survey),
    query<DynamicRow>(sql.black),
  ]);

  // ⚠️ キー名と順序は PHP と同じにする。フロントが response.data.summary 等で読む
  const body: Record<string, unknown> = {
    summary,
    shop,
    staff,
    medium,
    inquiry,
    survey,
    black,
  };

  /**
   * ⚠️⚠️ **order のときだけ `section` キーを足す。**
   *   spec / used の PHP 応答には**キー自体が無い**。
   *   空配列を入れると差分比較が合わなくなる。
   */
  if (sql.section !== null) {
    body.section = await query<DynamicRow>(sql.section);
  }

  return { httpStatus: 200, body };
};
