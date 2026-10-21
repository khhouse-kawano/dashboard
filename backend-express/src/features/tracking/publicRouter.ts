import { readFileSync } from 'fs';
import path from 'path';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { logger } from '../../utils/logger';
import { recordConversion } from './conversion';
import { recordPageview } from './pageview';
import { isKnownOrigin, recordTouch } from './touch';

/**
 * 広告流入トラッキング（v2.2.199）の公開の口。⚠️ 認証なし。
 *
 *   GET  /t/v1/tracker.js    … 各ブランドサイトのフッターに貼るスクリプト（public/tracker.js）
 *   POST /api/track/touch    … 着地の記録（tracker.js が sendBeacon で送る）
 *   POST /api/track/pv       … ページの閲覧（v2.2.203。tracker.js がページを開くたびに送る。pageview.ts）
 *   GET  /t/v1/cv.js         … 自社のフォームでないサイトの CV（v2.2.205。public/cv.js。GTM で入れる）
 *   POST /api/track/cv       … その CV（メール・電話のハッシュ。conversion.ts。反響との突き合わせは cvMatch.ts）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **app.ts で全体の CORS より前に置くこと。**
 *   ⚠️ 全体の CORS（.env の CORS_ORIGINS）は、許可外のオリジンのプリフライトに
 *     ACAO を付けずに 204 を返して終わる。⚠️ ここは許可するオリジンを DB（tracking_sites）から決める。
 * ⚠️ 応答は成功・失敗とも 204（指示書 §6-2）。⚠️ 理由はログだけ（touch.ts）。
 * ⚠️ 本文は text/plain の JSON（プリフライトを起こさないため）。application/json も受ける。
 * ⚠️ 本番の ② はビルド結果（dist）しか持たないので、Dockerfile で public/ もコピーしている。
 * ─────────────────────────────────────────────
 */

/**
 * 配信する中身。⚠️ 起動時に1回だけ読む。⚠️ 行頭の // の行と字下げを落として小さくする（5KB 以内の目安）。
 * ⚠️ 読めなければ 404 にする（⚠️ サイトの表示には影響しない）。
 */
const loadScript = (file: string): string | null => {
  try {
    const source = readFileSync(path.resolve(process.cwd(), 'public', file), 'utf8');
    return source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('//')).join('\n');
  } catch (error) {
    logger.error(`${file} を読めません: ${(error as Error).message}`);
    return null;
  }
};

/** 同じ IP から1分に30件まで（指示書 §6-2）。⚠️ 超えても 204（保存しないだけ） */
const touchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.info(`track/touch: 保存しません（流量の上限） origin="${req.get('origin') ?? ''}"`);
    res.status(204).end();
  },
});

/**
 * ページの閲覧は同じ IP から1分に120件まで（v2.2.203）。⚠️ 着地（30件）より多い：社内の回線など、1つの IP から何人も見るため。
 * ⚠️ 超えても 204（保存しないだけ）
 */
const pageviewLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.info(`track/pv: 保存しません（流量の上限） origin="${req.get('origin') ?? ''}"`);
    res.status(204).end();
  },
});

/** v2.2.205 CV は同じ IP から1分に30件まで（⚠️ 超えても 204） */
const cvLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.info(`track/cv: 保存しません（流量の上限） origin="${req.get('origin') ?? ''}"`);
    res.status(204).end();
  },
});

/** 許可したオリジンにだけ ACAO を返す。⚠️ credentials は使わない */
const trackingCors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const origin = req.get('origin') ?? '';
  try {
    if (await isKnownOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  } catch (error) {
    logger.error(`track/touch: オリジンの確認に失敗: ${(error as Error).message}`);
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  next();
};

const readBody = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const createTrackingPublicRouter = (): Router => {
  const router = Router();
  for (const file of ['tracker.js', 'cv.js']) {
    const script = loadScript(file);
    router.get(`/t/v1/${file}`, (_req, res) => {
      if (script === null) {
        res.status(404).end();
        return;
      }
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(script);
    });
  }

  router.options('/api/track/touch', trackingCors);
  router.post(
    '/api/track/touch',
    trackingCors,
    touchLimiter,
    express.text({ type: () => true, limit: '16kb' }),
    async (req: Request, res: Response) => {
      try {
        await recordTouch({
          body: readBody(req.body),
          origin: req.get('origin') ?? '',
          ip: req.ip ?? '',
          userAgent: req.get('user-agent') ?? '',
        });
      } catch (error) {
        logger.error(`track/touch: 保存に失敗: ${(error as Error).message}`);
      }
      res.status(204).end();
    }
  );
  // ⚠️ 本文が大きすぎる・読めないときも 204（⚠️ 全体の errorHandler に渡すと 400/413 になる）
  router.use('/api/track/touch', (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.info(`track/touch: 保存しません（本文を読めない: ${error.message}）`);
    res.status(204).end();
  });

  // v2.2.203 ページの閲覧（⚠️ 着地と同じ CORS・応答は常に 204）
  router.options('/api/track/pv', trackingCors);
  router.post(
    '/api/track/pv',
    trackingCors,
    pageviewLimiter,
    express.text({ type: () => true, limit: '16kb' }),
    async (req: Request, res: Response) => {
      try {
        await recordPageview({ body: readBody(req.body), origin: req.get('origin') ?? '', userAgent: req.get('user-agent') ?? '' });
      } catch (error) {
        logger.error(`track/pv: 保存に失敗: ${(error as Error).message}`);
      }
      res.status(204).end();
    }
  );
  router.use('/api/track/pv', (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.info(`track/pv: 保存しません（本文を読めない: ${error.message}）`);
    res.status(204).end();
  });

  // v2.2.205 自社のフォームでないサイトの CV（⚠️ 着地と同じ CORS・応答は常に 204）
  router.options('/api/track/cv', trackingCors);
  router.post(
    '/api/track/cv',
    trackingCors,
    cvLimiter,
    express.text({ type: () => true, limit: '16kb' }),
    async (req: Request, res: Response) => {
      try {
        await recordConversion({ body: readBody(req.body), origin: req.get('origin') ?? '', userAgent: req.get('user-agent') ?? '' });
      } catch (error) {
        logger.error(`track/cv: 保存に失敗: ${(error as Error).message}`);
      }
      res.status(204).end();
    }
  );
  router.use('/api/track/cv', (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.info(`track/cv: 保存しません（本文を読めない: ${error.message}）`);
    res.status(204).end();
  });

  return router;
};
