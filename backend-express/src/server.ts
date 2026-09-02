import { createApp } from './app';
import { env } from './config/env';
import { closePool, pingDatabase } from './db/pool';
import { gatewaySummary, logGatewayRoutes } from './gateway';
import { logger } from './utils/logger';

/**
 * 起動処理。
 * 先に DB 疎通を確認してから listen することで、
 * 「サーバーは立っているのに全リクエストが 500」という状態を避ける。
 */
const bootstrap = async (): Promise<void> => {
  await pingDatabase();
  logger.info(`DB 接続 OK: ${env.db.host}:${env.db.port}/${env.db.database}`);

  const { app, routes } = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`Express API 起動: http://localhost:${env.port} (NODE_ENV=${env.nodeEnv})`);
    logger.info(`CORS 許可オリジン: ${env.corsOrigins.join(', ')}`);
    logger.info(`登録ルート ${routes.length} 件:`);
    for (const r of routes) {
      logger.info(`  ${r.auth ? '🔒' : '  '} ${r.method.padEnd(6)} ${r.path}  — ${r.summary}`);
    }

    // PHP互換ゲートウェイの状態。転送先が未設定だと未移植のリクエストが
    // すべて失敗するため、起動時に必ず目に入る場所へ出す
    logger.info(gatewaySummary());
    logGatewayRoutes();
  });

  // 重い集計SQLの途中で切断されないよう、既定より長めに設定する
  server.requestTimeout = env.requestTimeoutMs;
  server.headersTimeout = env.requestTimeoutMs + 5_000;

  // docker compose down / Ctrl+C 時に、処理中のリクエストを捨てずに終了する
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
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

  // 拾い損ねた例外も必ずログに残す（沈黙して死ぬのを防ぐ）
  process.on('unhandledRejection', (reason) => {
    logger.error('未処理の Promise 拒否', reason);
  });
  process.on('uncaughtException', (error) => {
    logger.error('捕捉されなかった例外', error);
    shutdown('uncaughtException');
  });
};

bootstrap().catch((error: unknown) => {
  logger.error('起動に失敗しました', error);
  process.exit(1);
});
