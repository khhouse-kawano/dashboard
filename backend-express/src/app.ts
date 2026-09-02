import compression from 'compression';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { buildFeatureRouter } from './core/registry';
import type { RouteSummary } from './core/registry';
import { createSystemRouter } from './core/systemRouter';
import { features } from './features';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestContext } from './middlewares/requestContext';
import { requestLogger } from './middlewares/requestLogger';

export interface BuiltApp {
  app: Express;
  /** 登録されたルート一覧。起動ログとルート一覧APIで使う */
  routes: RouteSummary[];
}

/**
 * Express アプリの組み立て。
 *
 * listen（起動）は server.ts に分離してあるので、テストを書くときは
 * この createApp() だけを呼べばポートを占有せずに検証できる。
 *
 * ミドルウェアは「上から順に」実行されるため、登録順そのものが仕様になる。
 * 番号のとおりの順序で並べること。
 */
export const createApp = (): BuiltApp => {
  const app = express();

  // ---------------------------------------------------------------
  // 0. アプリ設定
  // ---------------------------------------------------------------

  // Express が自動で付ける X-Powered-By を消す（使用技術を外に晒さない）
  app.disable('x-powered-by');

  // リバースプロキシ配下で実クライアントIPを正しく取得するため
  app.set('trust proxy', env.trustProxy);

  // '/api/v1/staff' と '/api/v1/staff/' を同一視する
  app.set('strict routing', false);

  // ---------------------------------------------------------------
  // 1. セキュリティヘッダ
  //    XSS・クリックジャッキング等の緩和ヘッダを一括で付ける。
  //    APIサーバーなのでブラウザ向けのCSPは無効（HTMLを返さないため）。
  // ---------------------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // ---------------------------------------------------------------
  // 2. CORS
  //    React開発サーバー（別オリジン）から叩けるようにする。
  //    X-Request-Id はフロント側でも読めるよう公開する。
  // ---------------------------------------------------------------
  app.use(
    cors({
      origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86_400, // preflight の結果を1日キャッシュさせ、往復回数を減らす
    })
  );

  // ---------------------------------------------------------------
  // 3. リクエストID付与 → アクセスログ
  //    ボディパーサより前に置くこと。後ろに置くと、JSONが壊れていて
  //    パースに失敗したリクエストだけIDが振られず、追跡できなくなる。
  // ---------------------------------------------------------------
  app.use(requestContext);
  app.use(requestLogger);

  // ---------------------------------------------------------------
  // 4. レスポンス圧縮
  //    顧客一覧など数MBのJSONを返すため、転送量が大幅に減る。
  // ---------------------------------------------------------------
  app.use(compression());

  // ---------------------------------------------------------------
  // 5. ボディパーサ
  //    JSON が壊れていた場合はここで例外が出るが、
  //    errorHandler が 400 に変換するので 500 にはならない。
  // ---------------------------------------------------------------
  app.use(express.json({ limit: env.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

  // ---------------------------------------------------------------
  // 6. ルーティング
  //    features/index.ts の登録内容から自動生成する。
  //    機能を追加してもこのファイルを触る必要はない。
  // ---------------------------------------------------------------
  const { router: featureRouter, routes } = buildFeatureRouter(features);

  app.use('/api', createSystemRouter(routes));
  app.use('/api/v1', featureRouter);

  // ---------------------------------------------------------------
  // 7. 後始末（この2つは必ず最後に、この順で置く）
  // ---------------------------------------------------------------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, routes };
};
