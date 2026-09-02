import type { RowDataPacket } from 'mysql2/promise';
import { defineFeature } from '../core/feature';
import { route } from '../core/route';
import { idParam, paginationQuery } from '../core/schema';
import { query } from '../db/pool';
import { AppError } from '../errors/AppError';

/**
 * スタッフ（staff テーブル）。
 *
 * staff テーブルには password と api_token が入っているため、
 * SELECT する列は必ず明示する。`SELECT *` は使わない。
 */

// ---------------------------------------------------------------------------
// データ取得
// ---------------------------------------------------------------------------

interface StaffRow extends RowDataPacket {
  id: number;
  name: string;
  mail: string;
  brand: string;
  shop: string;
  flag: number;
}

/** 外部に返してよい列だけを列挙する（password / api_token は絶対に含めない） */
const PUBLIC_COLUMNS = 'id, name, mail, brand, shop, flag';

const findAll = async (limit: number, offset: number): Promise<StaffRow[]> =>
  query<StaffRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM staff WHERE flag = 1 ORDER BY id LIMIT ${limit} OFFSET ${offset}`
  );

const findById = async (id: number): Promise<StaffRow | undefined> => {
  const rows = await query<StaffRow>(
    `SELECT ${PUBLIC_COLUMNS} FROM staff WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0];
};

// ---------------------------------------------------------------------------
// ルート定義
// ---------------------------------------------------------------------------

export const staff = defineFeature({
  name: 'スタッフ',
  basePath: '/staff',
  routes: {
    'GET /': route({
      summary: '在籍スタッフを一覧取得',
      auth: true,
      query: paginationQuery,
      handler: async ({ query: q }) => {
        const items = await findAll(q.limit, q.offset);
        return { items, limit: q.limit, offset: q.offset };
      },
    }),

    // '/me' は '/:id' より先に登録される（registry が自動で並べ替える）
    'GET /me': route({
      summary: 'トークンに紐づく自分自身の情報を取得',
      auth: true,
      handler: async ({ ctx }) => {
        // auth: true のルートでは ctx.staff は必ず存在する
        if (ctx.staff === undefined) {
          throw AppError.unauthorized();
        }
        return ctx.staff;
      },
    }),

    'GET /:id': route({
      summary: '指定したスタッフを取得',
      auth: true,
      params: idParam,
      handler: async ({ params }) => {
        const found = await findById(params.id);
        if (found === undefined) {
          throw AppError.notFound(`スタッフ id=${params.id} が見つかりません`);
        }
        return found;
      },
    }),
  },
});
