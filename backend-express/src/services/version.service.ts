import { AppError } from '../errors/AppError';
import { findLatestUpdateLog } from '../repositories/version.repository';
import type { UpdateLog } from '../types/version';

/**
 * Service 層：業務ルールを書く場所。DB の都合も HTTP の都合も持ち込まない。
 * （ここでは「レコードが 1 件も無いのは異常」という判断だけを担当する）
 */
export const fetchLatestVersion = async (): Promise<UpdateLog> => {
  const latest = await findLatestUpdateLog();

  if (latest === null) {
    throw AppError.notFound('update_log にレコードが 1 件もありません');
  }

  return latest;
};
