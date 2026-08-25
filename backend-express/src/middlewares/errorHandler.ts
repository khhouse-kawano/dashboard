import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isProduction } from '../config/env';
import { AppError } from '../errors/AppError';
import type { ErrorCode } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * エラーレスポンスの形は全エンドポイントで統一する。
 *
 * { "error": { "code": "NOT_FOUND", "message": "...", "requestId": "..." } }
 *
 * フロントは axios が非2xxで自動的に throw するため、
 * catch 側で `err.response?.data?.error?.code` を見て分岐できる。
 */

/** body-parser が投げるエラーには type / status が生えている */
interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

const isBodyParserError = (err: unknown): err is BodyParserError =>
  err instanceof Error && typeof (err as BodyParserError).type === 'string';

interface Normalized {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  /** 想定外＝サーバー側の不具合として error ログに残すべきか */
  unexpected: boolean;
}

const normalize = (err: unknown): Normalized => {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      unexpected: false,
    };
  }

  // JSON の構文エラー・サイズ超過はクライアント起因なので 4xx で返す
  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      return {
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'リクエストボディが正しい JSON ではありません',
        unexpected: false,
      };
    }
    if (err.type === 'entity.too.large') {
      return {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'リクエストのサイズが上限を超えています',
        unexpected: false,
      };
    }
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'サーバー内部でエラーが発生しました',
    unexpected: true,
  };
};

/** どのルートにも一致しなかったリクエスト。errorHandler の直前に置く */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `エンドポイントが存在しません: ${req.method} ${req.originalUrl}`,
      requestId: req.requestId,
    },
  });
};

/**
 * 集約エラーハンドラ。
 *
 * Express 5 では async ハンドラ内の throw / reject も自動でここに流れてくるため、
 * 各機能ファイルで try-catch を書く必要はない（＝握りつぶしが起きにくい）。
 * 引数が4つであることがエラーハンドラの目印なので、未使用でも next は省略できない。
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const { statusCode, code, message, details, unexpected } = normalize(err);
  const label = `${req.method} ${req.originalUrl} -> ${statusCode} [${req.requestId}]`;

  // 想定外のエラーは必ずスタックトレース付きでログに残す（握りつぶさない）
  if (unexpected) {
    logger.error(label, err);
  } else {
    logger.warn(`${label} ${message}`);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      requestId: req.requestId,
      // 想定外のエラーに限り、かつ開発環境でだけスタックトレースを返す
      ...(!isProduction && unexpected && err instanceof Error ? { stack: err.stack } : {}),
    },
  });
};
