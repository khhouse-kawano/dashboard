import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { defineFeature } from '../core/feature';
import { route } from '../core/route';
import { paginationQuery } from '../core/schema';
import { query } from '../db/pool';
import { AppError } from '../errors/AppError';

/**
 * 更新履歴（update_log テーブル）。
 * 移植元: backend/src/handlers/show_version.php
 *
 * 1つの機能ファイルは「上半分に SQL、下半分にルート定義」で書く。
 * SQL が増えて見通しが悪くなったら features/versions/ ディレクトリに分割する。
 */

// ---------------------------------------------------------------------------
// データ取得（SQL を書くのはこのセクションだけ）
// ---------------------------------------------------------------------------

interface UpdateLogRow extends RowDataPacket {
  no: number;
  version: string;
  date: string;
  note: string;
}

const COLUMNS = '`no`, `version`, `date`, `note`';

const findAll = async (limit: number, offset: number): Promise<UpdateLogRow[]> =>
  // LIMIT / OFFSET はプレースホルダが使えない環境があるため、
  // zod で整数化済みの値のみを埋め込む（文字列は絶対に通さない）
  query<UpdateLogRow>(
    `SELECT ${COLUMNS} FROM update_log ORDER BY \`no\` DESC LIMIT ${limit} OFFSET ${offset}`
  );

const countAll = async (): Promise<number> => {
  const rows = await query<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM update_log'
  );
  return rows[0]?.total ?? 0;
};

const findLatest = async (): Promise<UpdateLogRow | undefined> => {
  const rows = await query<UpdateLogRow>(
    `SELECT ${COLUMNS} FROM update_log ORDER BY \`no\` DESC LIMIT 1`
  );
  return rows[0];
};

const findByNo = async (no: number): Promise<UpdateLogRow | undefined> => {
  const rows = await query<UpdateLogRow>(
    `SELECT ${COLUMNS} FROM update_log WHERE \`no\` = ? LIMIT 1`,
    [no]
  );
  return rows[0];
};

// ---------------------------------------------------------------------------
// ルート定義
// ---------------------------------------------------------------------------

export const versions = defineFeature({
  name: '更新履歴',
  basePath: '/versions',
  routes: {
    'GET /': route({
      summary: '更新履歴を新しい順に一覧取得',
      query: paginationQuery,
      handler: async ({ query: q }) => {
        const [items, total] = await Promise.all([findAll(q.limit, q.offset), countAll()]);
        return { items, total, limit: q.limit, offset: q.offset };
      },
    }),

    'GET /latest': route({
      summary: '最新バージョンを取得（show_version.php の移植）',
      handler: async () => {
        const latest = await findLatest();
        if (latest === undefined) {
          throw AppError.notFound('update_log にレコードが1件もありません');
        }
        return latest;
      },
    }),

    'GET /:no': route({
      summary: '指定した番号の更新履歴を取得',
      params: z.object({ no: z.coerce.number().int().positive() }),
      handler: async ({ params }) => {
        const found = await findByNo(params.no);
        if (found === undefined) {
          throw AppError.notFound(`更新履歴 no=${params.no} が見つかりません`);
        }
        return found;
      },
    }),
  },
});
