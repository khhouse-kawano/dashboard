import type { RequestHandler } from 'express';
import { logger } from '../utils/logger';

/**
 * アクセスログ。レスポンス完了時にステータスと所要時間を出す。
 * `docker compose logs -f express-api` で確認できる。
 */

/**
 * ログに出さないパス。
 * Docker の healthcheck が 10 秒ごとに叩くため、除外しないと
 * 本当に見たいログが健康診断で埋め尽くされる。
 */
const SILENT_PATHS = new Set<string>(['/api/health']);

export const requestLogger: RequestHandler = (req, res, next) => {
  if (SILENT_PATHS.has(req.path)) {
    next();
    return;
  }

  const startedAt = Date.now();

  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    const staff = req.staff === undefined ? '-' : req.staff.mail;
    logger.info(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs}ms [${req.requestId}] ${staff}`
    );
  });

  next();
};
