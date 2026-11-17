import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { listPeriodMonths } from './period';
import { listSql } from './queries';
import { refreshDupKeysSafely } from '../inquiryDup/refresh';
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

/** 画面から届く本文（⚠️ GET は ① が本文に直して POST で送ってくる） */
export interface ListParams {
  category?: unknown;
  startMonth?: unknown;
  endMonth?: unknown;
}

export const runList = async (params: ListParams): Promise<ListResult> => {
  const category = typeof params.category === 'string' ? params.category : '';

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

  /**
   * ⚠️ v2.2.274: 期間（startMonth / endMonth、'YYYYMM'）。⚠️ 無ければ今までどおり全件。
   *   ⚠️ 判定は ① の list.php の listPeriodMonths() と同じ（features/list/period.ts）。
   */
  const months = listPeriodMonths(params.startMonth, params.endMonth);
  if (months === 'invalid') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '期間の指定が正しくありません' },
    };
  }

  const sql = listSql(category, months);

  // ⚠️ v2.2.276: 反響の dup_count（事業をまたいだ重複の件数）を最新にしてから読む。⚠️ 失敗しても前の件数で返す
  await refreshDupKeysSafely();

  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
  //   反響一覧と master_data が数万行あるため待ち時間が縮む
  const [summary, shop, staff, medium, inquiry, survey, black] = await Promise.all([
    query<DynamicRow>(sql.summary.sql, sql.summary.params),
    query<DynamicRow>(sql.shop),
    query<DynamicRow>(sql.staff),
    query<DynamicRow>(sql.medium),
    query<DynamicRow>(sql.inquiry.sql, sql.inquiry.params),
    query<DynamicRow>(sql.survey.sql, sql.survey.params),
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
