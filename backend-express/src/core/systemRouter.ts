import { Router } from 'express';
import { env, isProduction } from '../config/env';
import { pingDatabase } from '../db/pool';
import type { RouteSummary } from './registry';

/**
 * 機能ではなく「サーバー自身」に関するエンドポイント。
 *   GET /api/health      疎通確認（Docker の healthcheck が使う）
 *   GET /api/v1/_routes  登録済みルート一覧（開発環境のみ）
 */
export const createSystemRouter = (routes: RouteSummary[]): Router => {
  const router = Router();

  router.get('/health', async (_req, res) => {
    // DB に到達できなければ例外が飛び、errorHandler が 500 を返す＝unhealthy と判定される
    await pingDatabase();

    res.json({
      status: 'ok',
      service: 'express-api',
      nodeEnv: env.nodeEnv,
      database: 'connected',
      routeCount: routes.length,
      timestamp: new Date().toISOString(),
    });
  });

  // 実装済みのAPIをフロント側から一覧できるようにする。
  // 「どのURLを叩けばいいか」をコードを読まずに確認できる。
  // 本番では内部構造を晒さないため無効化する。
  if (!isProduction) {
    router.get('/v1/_routes', (_req, res) => {
      res.json({
        count: routes.length,
        routes: [...routes].sort((a, b) => a.path.localeCompare(b.path)),
      });
    });
  }

  return router;
};
