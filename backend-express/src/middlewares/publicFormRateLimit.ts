import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

/**
 * 公開フォーム（認証なしの書き込み口）の流量制限。
 *
 * ─────────────────────────────────────────────
 * なぜ必要か
 *
 *   ambassador_inquiry は社外の誰でも叩ける唯一の書き込み口である。
 *   無制限だと、スクリプトで叩かれた時点で inquiry_ambassador が
 *   ゴミで埋まり、本物の反響が紛れて追客漏れになる。
 *   （DBが落ちるより、**本物が見つからなくなる**ほうが被害が大きい）
 *
 * ⚠️ 上限は「人が手で入力して送信する」速度から決めている。
 *   入力・確認モーダル・送信で最低でも1分はかかるため、
 *   10分で5件も送れば十分に余裕がある。
 *   家族で別々に申し込む・入力し直すといった正当な連投も通る。
 * ─────────────────────────────────────────────
 *
 * ⚠️ **これは嫌がらせを完全には防げない。** IPを変えられれば回ってしまう。
 *   目的は「1台のスクリプトによる大量投入を止めること」であり、
 *   最後の砦は InquiryAmbassador.tsx での人の目視である。
 */

/** 制限の対象にする request 名。ここに無いものは素通しする */
const GUARDED_REQUESTS = new Set(['ambassador_inquiry']);

const WINDOW_MS = 10 * 60_000;
const MAX_PER_IP = 5;

const limiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_PER_IP,
  // ⚠️ 生の req.ip で数えないこと。IPv6 は1契約に /64 が丸ごと割り当てられ、
  //   下位ビットを変えるだけで無限に別キー扱いになり制限を回避できる。
  //   ipKeyGenerator() は IPv4 はそのまま、IPv6 をサブネット単位に丸める。
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // ⚠️ フォーム側（form.js）は message をそのまま画面に出す。
  //   「制限に掛かった」と分かる日本語にしておくこと。
  //   既定のプレーンテキストだと JSON.parse に失敗して
  //   「通信に失敗しました」という誤った案内になる。
  message: {
    status: 'error',
    message:
      '送信が続けて行われました。お手数ですが時間をおいて再度お試しください。',
  },
});

/**
 * ゲートウェイに挟むミドルウェア。
 *
 * ⚠️ ゲートウェイは全ての通信が同じURLへの POST であるため、
 *   ルーティングでは対象を絞れない。ボディの request を見て振り分ける。
 *
 * ⚠️ express.json() より後に置くこと。前に置くと req.body が未定義で、
 *   **全リクエストが素通りして制限が一切効かない**（エラーにならないので気づけない）。
 */
export const publicFormRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const request = (req.body as { request?: unknown } | undefined)?.request;

  if (typeof request !== 'string' || !GUARDED_REQUESTS.has(request)) {
    next();
    return;
  }

  void limiter(req, res, next);
};
