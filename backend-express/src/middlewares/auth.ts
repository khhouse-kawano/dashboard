import type { Request, RequestHandler } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';
import { AppError } from '../errors/AppError';
import type { AuthenticatedStaff } from '../types/staff';

interface StaffRow extends RowDataPacket, AuthenticatedStaff {}

/**
 * リクエストからトークンを取り出す。
 * 既存フロント（src/utils/apiClient.ts）は `Token` ヘッダに api_token を載せてくるため
 * それを第一候補とし、標準的な `Authorization: Bearer xxx` も受け付ける。
 */
const extractToken = (req: Request): string | null => {
  const tokenHeader = req.header('Token');
  if (tokenHeader !== undefined && tokenHeader.trim() !== '') {
    return tokenHeader.trim();
  }

  const authorization = req.header('Authorization') ?? '';
  const matched = /^Bearer\s+(\S+)$/i.exec(authorization);
  return matched === null ? null : matched[1];
};

/**
 * API トークン認証。PHP 側の core/token.php > getUserByToken() 相当。
 * 認証が必要なルートの前段に挟むと、後続ハンドラで `req.staff` が使えるようになる。
 *
 * @example
 * router.get('/me', requireApiToken, handler);
 */
export const requireApiToken: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req);
  if (token === null) {
    next(AppError.unauthorized('Token ヘッダ、または Authorization: Bearer が必要です'));
    return;
  }

  const rows = await query<StaffRow>(
    'SELECT id, name, mail, brand, shop FROM staff WHERE api_token = ? AND api_token <> \'\' LIMIT 1',
    [token]
  );

  const staff = rows[0];
  if (staff === undefined) {
    // トークンそのものはログに出さない（漏洩防止）
    next(AppError.unauthorized('トークンが無効です'));
    return;
  }

  req.staff = {
    id: staff.id,
    name: staff.name,
    mail: staff.mail,
    brand: staff.brand,
    shop: staff.shop,
  };
  next();
};
