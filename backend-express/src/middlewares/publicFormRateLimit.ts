import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

/**
 * 公開フォーム（認証なしの書き込み口）の流量制限。
 *
 * ─────────────────────────────────────────────
 * なぜ必要か
 *
 *   ambassador_inquiry / event_reservation は社外の誰でも叩ける書き込み口である。
 *   無制限だと、スクリプトで叩かれた時点で inquiry_ambassador / event_db が
 *   ゴミで埋まり、本物の反響が紛れて追客漏れになる。
 *   （DBが落ちるより、**本物が見つからなくなる**ほうが被害が大きい）
 *
 * ⚠️ イベント予約は当日に来場者が一斉に申し込むことは無い想定だが、
 *   締切直前に家族分をまとめて申し込むことはある。5件/10分はそれも通る。
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

/**
 * 制限の対象にする request 名。ここに無いものは素通しする。
 *
 * ⚠️ **認証なしの書き込み口を追加したら、必ずここにも追加すること。**
 *   追加を忘れても動いてしまうため、エラーでは気づけない。
 */
const GUARDED_REQUESTS = new Set(['ambassador_inquiry', 'event_reservation']);

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
 * イベント受付（event_checkin）の失敗回数の制限。
 *
 * ⚠️⚠️ **フォームの制限とは別物にすること。**
 *   受付では1台のスマホで何十人もチェックインする。5件/10分の制限を掛けると
 *   **当日の受付が止まる。**
 *
 * ⚠️ `skipSuccessfulRequests: true` により、**数えるのは失敗だけ**である。
 *   正しい合い言葉での受付は何回でも通り、合い言葉の総当たりだけが止まる。
 *   （合い言葉が違うとき 401 を返す実装が前提。200 で返すと数えられない）
 *
 * ⚠️ 会場では全スタッフが同じWi-Fiで同一IPになりうるが、成功は数えないため
 *   互いの受付を邪魔しない。
 */
const checkinLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    status: 'error',
    message: '合い言葉の入力を繰り返し間違えました。しばらく待ってから再度お試しください。',
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

  if (typeof request !== 'string') {
    next();
    return;
  }

  // ⚠️ 受付は別の制限を使う。フォームと同じ 5件/10分 にすると当日の受付が止まる
  if (request === 'event_checkin') {
    void checkinLimiter(req, res, next);
    return;
  }

  if (!GUARDED_REQUESTS.has(request)) {
    next();
    return;
  }

  void limiter(req, res, next);
};
