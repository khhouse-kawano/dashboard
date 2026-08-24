import { Router } from 'express';
import { requireApiToken } from '../middlewares/auth';
import { healthRouter } from './health.route';
import { versionRouter } from './version.route';

/**
 * API ルーティングの集約点。app.ts では `app.use('/api', apiRouter)` の 1 行だけ。
 *
 * ルート一覧
 *   GET  /api/health      疎通確認（認証不要）
 *   GET  /api/v1/version  最新バージョン取得（show_version.php の移植）
 *   GET  /api/v1/me       トークンに紐づくスタッフ情報（認証の動作確認用）
 *
 * PHP から 1 本ずつ移植していく際は、
 *   1. repositories/xxx.repository.ts に SQL を移す
 *   2. services/xxx.service.ts に判断ロジックを移す
 *   3. controllers/xxx.controller.ts で入出力を整える
 *   4. routes/xxx.route.ts を作り、下の v1Router に use で追加する
 * の順で進める。
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);

// ---- v1 ----
const v1Router = Router();

v1Router.use('/version', versionRouter);

// 認証ミドルウェアの動作確認用。requireApiToken を通ると req.staff が入る
v1Router.get('/me', requireApiToken, (req, res) => {
  res.json({ status: 'ok', data: req.staff });
});

apiRouter.use('/v1', v1Router);
