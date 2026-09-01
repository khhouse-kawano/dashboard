import { rateLimit } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * 分析APIの流量制限。
 *
 * 分析APIはインターネットに公開され、1リクエストで数万件を走査する
 * 集計クエリを走らせる。無制限だと、キーが漏れた場合や MCP クライアントの
 * 暴走ループで本番DBに負荷が集中する。
 *
 * ─────────────────────────────────────────────
 * なぜ2段に分けるのか
 *
 *   認証の前に置くと req.apiKey がまだ無く、IPでしか数えられない。
 *   マネージャーは社内の同じ回線から使う可能性が高く、IPで数えると
 *   1人が上限に達したときに全員が巻き添えになる。
 *
 *   逆に認証の後だけに置くと、無効なキーでの連打が一切制限されない。
 *   認証は索引1本のSELECTで軽いとはいえ、無制限に叩かせる理由はない。
 *
 *   そこで「認証前にIPで粗く」「認証後にキーで細かく」の2段にする。
 *   registry.ts がこの順で挟む。
 * ─────────────────────────────────────────────
 */

const WINDOW_MS = 60_000;

/** 1分あたりのIP単位の上限。同じ事務所から複数人が使うことを見込んで緩める */
const MAX_PER_IP = 120;

/** 1分あたりのキー単位の上限。手作業での分析としては十分に余裕がある */
const MAX_PER_KEY = 60;

/** 他のエラーと同じJSON形式にそろえる（既定はプレーンテキスト） */
const message = (limit: number, unit: string): Record<string, string> => ({
  status: 'error',
  code: 'RATE_LIMITED',
  message: `リクエストが多すぎます（${unit}あたり ${WINDOW_MS / 1000}秒で${limit}回まで）。少し待ってから再試行してください。`,
});

/** 認証より前。発信元IPで数える */
export const analysisIpRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_PER_IP,
  // req.ip は app.set('trust proxy') の設定に従う。
  // VPS ではリバースプロキシ配下に置くため、TRUST_PROXY の設定を誤ると
  // 全リクエストがプロキシのIPに見えて制限が意味を成さなくなる。
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message(MAX_PER_IP, '接続元'),
});

/** 認証より後。APIキー単位で数える */
export const analysisKeyRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_PER_KEY,
  keyGenerator: (req: Request): string =>
    // 認証後に挟むため apiKey は必ず入っている。
    // 万一入っていなければIPに退避し、素通りだけはさせない。
    req.apiKey === undefined ? `ip:${req.ip ?? 'unknown'}` : `key:${req.apiKey.id}`,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message(MAX_PER_KEY, 'APIキー'),
});
