import type { AuthenticatedStaff } from './staff';

/**
 * Express の Request 型を拡張する。
 * これにより requireApiToken を通した後のハンドラで `req.staff` が型付きで参照できる。
 */
declare global {
  namespace Express {
    interface Request {
      staff?: AuthenticatedStaff;
    }
  }
}

export {};
