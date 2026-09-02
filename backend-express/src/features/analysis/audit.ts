import type { Request } from 'express';
import { execute } from '../../db/pool';

/**
 * 分析APIの実行履歴を残す。
 *
 * 集計値しか返していないとはいえ、全店舗の成績を横断で引ける口を
 * インターネットに公開する。「いつ誰がどの範囲を引いたか」を後から
 * 追えるようにしておく。
 *
 * ⚠️ レスポンス本体は保存しない。ログが肥大化するうえ、
 *   同じ情報を二重に持つことになるため。
 *
 * ⚠️ 記録に失敗しても業務は止めない。監査ログが書けないことを理由に
 *   集計結果を返さないほうが害が大きいので、失敗はログに出すだけにする。
 */

export interface AuditInput {
  endpoint: string;
  groupBy?: readonly string[];
  metrics?: readonly string[];
  basis?: string;
  from?: string;
  to?: string;
  filters?: Record<string, string>;
  rowCount?: number;
  durationMs: number;
  status: 'ok' | 'bad_request' | 'unauthorized' | 'rate_limited' | 'error';
  errorMessage?: string;
}

/** varchar の桁を超えると INSERT が失敗するため、保存前に丸める */
const clip = (value: string | undefined, max: number): string | undefined =>
  value === undefined ? undefined : value.slice(0, max);

export const recordAnalysisQuery = (req: Request, input: AuditInput): void => {
  const filters =
    input.filters === undefined || Object.keys(input.filters).length === 0
      ? undefined
      : JSON.stringify(input.filters);

  execute(
    `INSERT INTO analysis_query_log
       (api_key_id, staff_id, endpoint, group_by, metrics, basis,
        period_from, period_to, filters, row_count, duration_ms,
        status, error_message, client_ip, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.apiKey?.id,
      req.apiKey?.staffId,
      clip(input.endpoint, 64),
      clip(input.groupBy?.join(','), 255),
      clip(input.metrics?.join(','), 512),
      clip(input.basis, 16),
      input.from,
      input.to,
      clip(filters, 512),
      input.rowCount,
      Math.round(input.durationMs),
      input.status,
      clip(input.errorMessage, 255),
      // trust proxy を設定していないと、リバースプロキシ配下では
      // 全リクエストが同じIPに見える点に注意（app.ts で設定済み）
      clip(req.ip, 45),
      clip(req.requestId, 64),
    ]
  ).catch((error: unknown) => {
    console.error('[analysis] 監査ログの記録に失敗しました', error);
  });
};
