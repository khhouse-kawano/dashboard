import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * リクエストIDの付与。
 *
 * 1リクエストに1つIDを振り、アクセスログ・エラーログ・エラーレスポンスの
 * すべてに載せる。「画面でエラーが出た」という報告からサーバーログの該当箇所を
 * 一発で特定できるようにするための仕組み。
 *
 * リバースプロキシが X-Request-Id を付けている場合はそれを引き継ぐ。
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header('X-Request-Id');
  const isUsable = incoming !== undefined && incoming.length > 0 && incoming.length <= 64;

  const requestId = isUsable ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
