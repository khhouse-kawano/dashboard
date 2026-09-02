import type { Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

/**
 * 未移植のリクエストを ① レンタルサーバーの PHP へ転送する。
 *
 * ─────────────────────────────────────────────
 * なぜフォールバックが要るのか
 *
 *   186個のハンドラを全部移し終わるまで切り替えを待つと、
 *   長期間ブランチが分岐したまま塩漬けになり、最後に一括で切り替える
 *   ことになる。それが最も失敗しやすい進め方になる。
 *
 *   未移植は PHP に流す仕組みがあれば、1機能移すたびに本番へ出せる。
 *   問題が起きても、その1機能を登録解除するだけで即座に戻せる。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 転送先は ① レンタルサーバー（khg-marketing.info）。
 *   ② VPS 自身ではない。無限ループにならないよう URL を必ず確認すること。
 */

/** ヘッダをそのまま流すと事故になるものを落とす */
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-length', // ボディを組み直すので、元の長さを送ると壊れる
  'accept-encoding', // 圧縮されると中身を素通しできない
]);

const buildForwardHeaders = (req: Request): Record<string, string> => {
  const headers: Record<string, string> = {};

  for (const [name, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(name.toLowerCase())) continue;
    if (value === undefined) continue;
    headers[name] = Array.isArray(value) ? value.join(', ') : value;
  }

  headers['content-type'] = 'application/json';

  // 転送されたものだと分かるようにしておく。① 側のログで区別できる
  headers['x-forwarded-by'] = 'express-gateway';

  return headers;
};

/**
 * PHP へ転送し、返ってきた内容をそのままクライアントへ返す。
 *
 * ⚠️ JSON としてパースし直さず、本文をそのまま返している。
 *   パースして組み直すと、数値が文字列で返るといった PHP 固有の形が
 *   崩れてフロントが壊れる。転送は「素通し」に徹する。
 */
export const forwardToPhp = async (req: Request, res: Response): Promise<void> => {
  const target = env.phpGatewayUrl;

  if (target === undefined) {
    throw AppError.badRequest(
      '未移植のリクエストですが、転送先（PHP_GATEWAY_URL）が設定されていません。' +
        '.env.prod に ① レンタルサーバーのゲートウェイURLを設定してください。'
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.phpGatewayTimeoutMs);

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: buildForwardHeaders(req),
      body: JSON.stringify(req.body ?? {}),
      signal: controller.signal,
    });

    const text = await upstream.text();

    res.status(upstream.status);

    const contentType = upstream.headers.get('content-type');
    res.type(contentType ?? 'application/json; charset=utf-8');

    res.send(text);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(`PHPへの転送がタイムアウトしました: ${target}`);
      throw new AppError(
        504,
        'INTERNAL_ERROR',
        `転送先の応答が ${env.phpGatewayTimeoutMs / 1000} 秒以内に返りませんでした。`
      );
    }
    logger.error('PHPへの転送に失敗しました', error);
    throw new AppError(502, 'INTERNAL_ERROR', '転送先との通信に失敗しました。');
  } finally {
    clearTimeout(timer);
  }
};
