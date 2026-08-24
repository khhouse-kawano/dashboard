import type { RequestHandler } from 'express';
import { logger } from '../utils/logger';

/**
 * アクセスログ。レスポンス完了時（finish イベント）にステータスと所要時間を出す。
 * `docker compose logs -f express-api` で疎通の確認に使える。
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} (${elapsedMs}ms)`);
  });

  next();
};
