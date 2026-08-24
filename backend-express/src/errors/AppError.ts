/**
 * 「想定内のエラー」を表すクラス。
 *
 * Service 層などで `throw AppError.notFound('...')` すると、
 * Express 5 が自動的に errorHandler まで運び、指定した HTTP ステータスで返る。
 * これに当てはまらない例外（バグ・DB障害など）は 500 として扱われる。
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, message, details);
  }

  static unauthorized(message = '認証が必要です'): AppError {
    return new AppError(401, message);
  }

  static forbidden(message = 'この操作を行う権限がありません'): AppError {
    return new AppError(403, message);
  }

  static notFound(message = 'リソースが見つかりません'): AppError {
    return new AppError(404, message);
  }
}
