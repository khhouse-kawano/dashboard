import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isProduction } from '../config/env';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/** どのルートにも一致しなかったリクエスト。app.ts で errorHandler の直前に置く */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `エンドポイントが存在しません: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * 集約エラーハンドラ。
 *
 * Express 5 では async ハンドラ内の throw / reject も自動でここに流れてくるため、
 * 各コントローラで try-catch を書く必要はない（＝エラーの握りつぶしが起きにくい）。
 * 引数が 4 つであることがエラーハンドラの目印なので、未使用でも `next` は省略できない。
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'サーバー内部でエラーが発生しました';

  // 想定外のエラーは必ずサーバーログに残す（握りつぶさない）
  if (isAppError) {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode} ${message}`);
  } else {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}`, err);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(isAppError && err.details !== undefined ? { details: err.details } : {}),
    // 想定外のエラーに限り、かつ開発環境でだけスタックトレースを返す
    // （本番で内部構造を外部に漏らさないため）
    ...(!isProduction && !isAppError && err instanceof Error ? { stack: err.stack } : {}),
  });
};
