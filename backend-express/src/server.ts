import { createApp } from './app';
import { env } from './config/env';
import { closePool, pingDatabase } from './db/pool';
import { logger } from './utils/logger';

/**
 * 起動処理。
 * 先に DB 疎通を確認してから listen することで、
 * 「サーバーは立っているのに全リクエストが 500」という状態を避ける。
 */
const bootstrap = async (): Promise<void> => {
  await pingDatabase();
  logger.info(`DB 接続 OK: ${env.db.host}:${env.db.port}/${env.db.database}`);

  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`Express API 起動: http://localhost:${env.port} (NODE_ENV=${env.nodeEnv})`);
    logger.info(`CORS 許可オリジン: ${env.corsOrigins.join(', ')}`);
  });

  // docker compose down / Ctrl+C 時に、処理中のリクエストを捨てずに終了する
  const shutdown = (signal: string): void => {
    logger.info(`${signal} を受信。シャットダウンします`);

    server.close(() => {
      void closePool()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error('コネクションプールの終了に失敗しました', error);
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

bootstrap().catch((error: unknown) => {
  logger.error('起動に失敗しました', error);
  process.exit(1);
});
