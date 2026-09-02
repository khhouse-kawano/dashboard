import { Router } from 'express';
import type { RequestHandler } from 'express';
import { env, isProduction } from '../config/env';
import { AppError } from '../errors/AppError';
import { requireApiToken } from '../middlewares/auth';
import { logger } from '../utils/logger';
import { forwardToPhp } from './phpFallback';
import { entryCount, findEntry, listEntries } from './registry';
import type { GatewayBody, GatewayContext } from './types';

/**
 * PHP互換ゲートウェイのルーター。
 *
 * ─────────────────────────────────────────────
 * 役割
 *
 *   フロントから届く POST { request, roll, category, ... } を見て
 *
 *     移植済み  → Express のハンドラで処理する
 *     未移植    → ① レンタルサーバーの PHP へ転送する
 *
 *   フロントのコードは一切変えず、.env の REACT_APP_XSERVER_API を
 *   このURLに向けるだけで切り替えられる。
 *
 * ⚠️ 移植が0件の状態でも安全に切り替えられる。
 *   全リクエストが PHP へ転送されるだけで、挙動は今までと同じになる。
 *   まずこの状態で「転送が正しく動く」ことを確認してから移植を始めること。
 * ─────────────────────────────────────────────
 */

/** 文字列として取り出す。数値や null が来ても落ちないようにする */
const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * request の形式を検証する。
 *
 * ⚠️ PHP 側（index.php）と同じ制限をかけている。
 *   英数字・アンダースコア・ハイフンとスラッシュのみ。ドットを許さない。
 *   Express ではファイルパスに連結しないため直接の危険は無いが、
 *   同じ入力を弾く状態にしておかないと
 *   「PHPでは400、Expressでは通る」という差が生まれ、
 *   移植の検証時に原因の分からない差分になる。
 */
const REQUEST_PATTERN = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

export const createGatewayRouter = (): Router => {
  const router = Router();

  // -----------------------------------------------------------------
  // 移植済み一覧。どれが Express で動いているかを確認するための窓口。
  // 本番では内部構造を晒さないため無効化する。
  // -----------------------------------------------------------------
  if (!isProduction) {
    router.get('/_routes', (_req, res) => {
      res.json({
        移植済み: entryCount(),
        転送先: env.phpGatewayUrl ?? '(未設定)',
        認証: env.gatewayRequireAuth ? 'Token必須（未移植の転送分を除く）' : 'PHP互換（検証しない）',
        一覧: listEntries().map(({ key, entry }) => ({
          key,
          summary: entry.summary,
          auth: entry.auth,
          phpSource: entry.phpSource,
        })),
      });
    });
  }

  // -----------------------------------------------------------------
  // 本体
  // -----------------------------------------------------------------
  const handle: RequestHandler = async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as GatewayBody;
      const request = asString(body.request);

      if (request === '' || !REQUEST_PATTERN.test(request)) {
        // ⚠️ PHP と同じメッセージ・同じ 400 を返す。
        //   フロントがこの文言で分岐している可能性があるため変えない。
        res
          .status(400)
          .json({ status: 'error', message: '不正なリクエストです。' });
        return;
      }

      const roll = asString(body.roll);
      const category = asString(body.category);

      const entry = findEntry(request, roll, category);

      // -------------------------------------------------------------
      // 未移植 → PHP へ転送
      //
      // ⚠️ ここで認証を要求しないこと。
      //   転送先の PHP が自前で認証を行う（あるいは行わない）ため、
      //   Express 側で先に弾くと、これまで動いていた画面が
      //   突然 401 になる。認証方針の変更は移植と分けて行う。
      // -------------------------------------------------------------
      if (entry === undefined) {
        // ⚠️⚠️ ループ検知。
        //   ① のPHP（core/express_proxy.php）は移植済みのリクエストを
        //   ここへ転送してくる。そのリクエストが未登録だった場合に
        //   ① へ転送し返すと、① が再びここへ送って無限ループになる。
        //
        //   起こりうるのは「① の許可リストには入れたが ② のビルドが古い」
        //   という状態。デプロイの順序を間違えると実際に発生する。
        const forwardedBy = req.header('X-Forwarded-By') ?? '';
        if (forwardedBy.includes('xserver-php')) {
          logger.error(
            `ループ検知: ① から転送された "${request}" が ② に未登録です。` +
              '① の expressProxyRequests() から外すか、② を再デプロイしてください。'
          );
          // 500番台を返すと ① 側が自動でフォールバックし、
          // ① 自身のPHPで処理される（画面は止まらない）
          res.status(502).json({
            status: 'error',
            message: `"${request}" は Express に未実装です。`,
          });
          return;
        }

        await forwardToPhp(req, res);
        return;
      }

      // -------------------------------------------------------------
      // 移植済み → Express で処理
      // -------------------------------------------------------------
      if (entry.auth === 'staff' && env.gatewayRequireAuth) {
        // requireApiToken は失敗時に next(error) を呼ぶ。
        // ここでは Promise として待ちたいので手動でラップする。
        await new Promise<void>((resolve, reject) => {
          void requireApiToken(req, res, (error?: unknown) => {
            if (error === undefined || error === null) resolve();
            else reject(error instanceof Error ? error : AppError.unauthorized());
          });
        });
      }

      const ctx: GatewayContext = {
        body,
        request,
        roll,
        category,
        token: req.header('Token') ?? '',
        requestId: req.requestId ?? '',
        req,
        res,
      };

      const result = await entry.handler(ctx);

      // ハンドラが自分でレスポンスを送った場合（ファイル出力など）は何もしない
      if (res.headersSent) return;

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  // フロントは baseURL 直下に POST するため '/' で受ける。
  // 末尾スラッシュの有無を吸収するため両方登録する。
  router.post('/', handle);

  return router;
};

/** 起動ログ用 */
export const gatewaySummary = (): string => {
  const target = env.phpGatewayUrl ?? '(未設定)';
  return `PHP互換ゲートウェイ: 移植済み ${entryCount()} 件 / 未移植の転送先 ${target}`;
};

export const logGatewayRoutes = (): void => {
  const rows = listEntries();
  if (rows.length === 0) {
    logger.info('  （移植済みのエンドポイントはまだありません。全て転送されます）');
    return;
  }
  for (const { key, entry } of rows) {
    logger.info(`  ${entry.auth === 'staff' ? '🔒' : '  '} ${key}  — ${entry.summary}`);
  }
};
