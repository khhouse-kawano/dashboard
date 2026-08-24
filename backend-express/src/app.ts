import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { apiRouter } from './routes';

/**
 * Express アプリの組み立て。
 * listen（起動）は server.ts に分離してあるので、将来テストを書くときは
 * この createApp() だけを呼べばポートを占有せずにテストできる。
 *
 * ミドルウェアは「上から順に」実行されるため、登録順に意味がある。
 */
export const createApp = (): Express => {
  const app = express();

  // Express が自動で付ける X-Powered-By ヘッダを消す（使用技術を外に晒さない）
  app.disable('x-powered-by');

  // 1. CORS: ブラウザから別オリジン（React dev server :3000）で叩けるようにする
  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Token'],
    })
  );

  // 2. ボディパーサ: JSON / フォーム形式のリクエストボディを req.body に変換する
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // 3. アクセスログ
  app.use(requestLogger);

  // 4. アプリ本体のルート
  app.use('/api', apiRouter);

  // 5. 後始末（この 2 つは必ず最後に、この順で置く）
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
