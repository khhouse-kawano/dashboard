/** フロントで分岐しやすいよう、エラーの種類を固定の文字列で表す */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

/**
 * 「想定内のエラー」を表すクラス。
 *
 * 機能ファイルの中で `throw AppError.notFound('...')` と書けば、
 * Express 5 が自動的に errorHandler まで運び、指定した HTTP ステータスで返る。
 * これに当てはまらない例外（バグ・DB障害など）は 500 として扱われる。
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = '認証が必要です'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'この操作を行う権限がありません'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'リソースが見つかりません'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(409, 'CONFLICT', message, details);
  }
}
