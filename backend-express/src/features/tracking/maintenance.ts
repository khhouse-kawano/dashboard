import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';

/**
 * アクセス解析の表の整理（v2.2.203）。② の起動から少し待って1回、その後6時間ごと（startTrackingMaintenance）。
 *
 * ─────────────────────────────────────────────
 * 1. 消さない顧客ID（tracking_keep_visitors）を足す
 *    - cv：反響（inquiry_customer.landing_params）に khg_vid がある人
 *    - master：有効名簿（master_data.landing_params）に khg_vid がある人（MA 用。2026-10-21 の指示）
 * 2. tracking_pageviews が PAGEVIEW_CAP 行を超えていたら、新しい PAGEVIEW_CAP 行より古い行のうち、
 *    消さない顧客ID に無い人の行を消す（⚠️ 一度に DELETE_CHUNK 行ずつ。DB を長く止めないため）
 * ⚠️ 消さない人の行は上限に関係なく残る。⚠️ 増えすぎていないかは手順書の確認の SQL で見る。
 * ⚠️ tracking_touches（訪問）は消さない（行数が少ないため）。
 * ─────────────────────────────────────────────
 */

export const PAGEVIEW_CAP = 500_000;
const DELETE_CHUNK = 10_000;
const FIRST_DELAY_MS = 90_000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;

/** landing_params から khg_vid（36文字）を取り出す SQL の式 */
const VID_SQL = "LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36))";
const UUID_SQL = "'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'";

export interface MaintenanceResult {
  kept: number;
  deleted: number;
}

/** ⚠️ cap は確かめるときだけ小さくして渡す（ふだんは PAGEVIEW_CAP） */
export const runTrackingMaintenance = async (cap: number = PAGEVIEW_CAP): Promise<MaintenanceResult> => {
  let kept = 0;
  for (const [table, reason] of [['inquiry_customer', 'cv'], ['master_data', 'master']] as const) {
    const result = await execute(
      `INSERT IGNORE INTO tracking_keep_visitors (visitor_id, reason)
       SELECT DISTINCT CONVERT(${VID_SQL} USING utf8mb4), '${reason}'
         FROM ${table}
        WHERE landing_params LIKE '%khg_vid=%' AND ${VID_SQL} REGEXP ${UUID_SQL}`
    );
    kept += result.affectedRows;
  }

  let deleted = 0;
  const cutoff = await query<RowDataPacket & { id: number }>(
    `SELECT id FROM tracking_pageviews ORDER BY id DESC LIMIT 1 OFFSET ${Math.max(0, Math.floor(cap))}`
  );
  if (cutoff.length > 0) {
    const cutoffId = Number(cutoff[0].id);
    for (;;) {
      const result = await execute(
        `DELETE FROM tracking_pageviews
          WHERE id <= ? AND visitor_id NOT IN (SELECT visitor_id FROM tracking_keep_visitors)
          LIMIT ${DELETE_CHUNK}`,
        [cutoffId]
      );
      deleted += result.affectedRows;
      if (result.affectedRows < DELETE_CHUNK) break;
    }
  }
  logger.info(`tracking: 整理しました（消さない顧客ID を ${kept} 人追加・閲覧 ${deleted} 行を削除）`);
  return { kept, deleted };
};

export const startTrackingMaintenance = (): void => {
  const run = (): void => {
    runTrackingMaintenance().catch((error: unknown) => logger.error('tracking: 整理に失敗しました', error));
  };
  setTimeout(run, FIRST_DELAY_MS).unref();
  setInterval(run, INTERVAL_MS).unref();
};
