import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';
import { logger } from '../utils/logger';
import type { GatewayAuth } from './types';

/**
 * ゲートウェイ用の認証・認可。
 *
 * ─────────────────────────────────────────────
 * なぜ middlewares/auth.ts を使わないのか
 *
 *   middlewares/auth.ts は REST API（/api/v1/*）用で、失敗時に AppError を投げる。
 *   AppError は errorHandler で { error: { code, message } } の形に整形される。
 *
 *   一方 PHP のゲートウェイは
 *
 *     401 { "status": "error", "message": "認証が必要です。" }
 *     403 { "status": "error", "message": "この操作を行う権限がありません。" }
 *
 *   を返す。フロントは response.data.message を画面に出すため、
 *   形が違うと「エラーメッセージが出ない」という分かりにくい不具合になる。
 *   ここでは PHP と1文字も違わない形を返す。
 * ─────────────────────────────────────────────
 */

/** 移植元: backend/src/core/authz.php の AUTHZ_MASTER */
const AUTHZ_MASTER = 'Master';

interface StaffRow extends RowDataPacket, AuthenticatedStaff {}

/** 認証結果。失敗時は返すべきステータスとJSONを持つ */
export type GatewayAuthResult =
  | { ok: true; staff: AuthenticatedStaff | null }
  | { ok: false; status: number; body: { status: 'error'; message: string } };

/**
 * トークンを取り出す。
 *
 * ⚠️ フロント（utils/apiClient.ts）は `Token` ヘッダを使う。
 *   `Authorization` には '4081Kokubu' という固定文字列が入っており、
 *   これは認証情報ではない（① でも検証されていない）。
 *   そのため Authorization は `Bearer xxx` の形のときだけ受け付ける。
 */
const extractToken = (req: Request): string => {
  const tokenHeader = req.header('Token');
  if (tokenHeader !== undefined && tokenHeader.trim() !== '') return tokenHeader.trim();

  const authorization = req.header('Authorization') ?? '';
  const matched = /^Bearer\s+(\S+)$/i.exec(authorization);
  return matched === null ? '' : matched[1];
};

/**
 * 移植元: backend/src/core/token.php の getUserByToken()
 *
 * ⚠️ staff.timestamp（最終アクセス時刻）を条件に入れないこと。
 *   ① の getUserByToken() も見ていない。有効期限の判定は
 *   フロント（context/AuthProvider.tsx）が get_token の結果で行っている。
 *   ここだけ厳しくすると「Express に移した画面だけログアウトする」ことになる。
 *   サーバー側で期限を効かせるのは ① と ② を同時に変える別タスク。
 */
const findStaffByToken = async (token: string): Promise<AuthenticatedStaff | null> => {
  const rows = await query<StaffRow>(
    'SELECT id, name, mail, brand, shop FROM staff WHERE api_token = ? LIMIT 1',
    [token]
  );

  const staff = rows[0];
  if (staff === undefined) return null;

  return {
    id: staff.id,
    name: staff.name,
    mail: staff.mail,
    brand: staff.brand,
    shop: staff.shop,
  };
};

/**
 * エントリに宣言された認証レベルを満たしているかを判定する。
 *
 * @param requireForNone GATEWAY_REQUIRE_AUTH。true なら 'none' のエントリにも
 *   staff 認証を要求する（将来の一括強化用）
 */
export const checkGatewayAuth = async (
  req: Request,
  auth: GatewayAuth,
  requireForNone: boolean
): Promise<GatewayAuthResult> => {
  const needsStaff = auth === 'staff' || auth === 'master' || requireForNone;
  if (!needsStaff) return { ok: true, staff: null };

  const token = extractToken(req);
  const staff = token === '' ? null : await findStaffByToken(token);

  if (staff === null) {
    // ⚠️ トークンそのものはログに出さない（漏洩防止）
    return {
      ok: false,
      status: 401,
      body: { status: 'error', message: '認証が必要です。' },
    };
  }

  if (auth === 'master' && staff.brand !== AUTHZ_MASTER) {
    // ① の requireAuthority() と同じく、誰が何を拒否されたかは追えるようにする
    logger.warn(
      `authz denied: staff_id=${staff.id} authority=${staff.brand === '' ? '(空)' : staff.brand} required=${AUTHZ_MASTER}`
    );
    return {
      ok: false,
      status: 403,
      body: { status: 'error', message: 'この操作を行う権限がありません。' },
    };
  }

  return { ok: true, staff };
};
