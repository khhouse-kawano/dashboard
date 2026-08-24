import { Router } from 'express';
import { pingDatabase } from '../db/pool';
import { env } from '../config/env';

/** マウント先: /api/health（認証不要。Docker の healthcheck からも叩かれる） */
export const healthRouter = Router();

// GET /api/health
healthRouter.get('/', async (_req, res) => {
  // DB に到達できなければ例外が飛び、errorHandler が 500 を返す＝unhealthy と判定される
  await pingDatabase();

  res.json({
    status: 'ok',
    service: 'express-api',
    nodeEnv: env.nodeEnv,
    database: 'connected',
    timestamp: new Date().toISOString(),
  });
});
