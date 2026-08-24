import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';
import type { UpdateLog } from '../types/version';

interface UpdateLogRow extends RowDataPacket, UpdateLog {}

/**
 * Repository 層：SQL を書く唯一の場所。HTTP のことも業務ルールも知らない。
 * 移植元 → backend/src/handlers/show_version.php
 */
export const findLatestUpdateLog = async (): Promise<UpdateLog | null> => {
  // PHP 版は SELECT * だったが、列を明示して意図しない列の露出を防ぐ
  const rows = await query<UpdateLogRow>(
    'SELECT `no`, `version`, `date`, `note` FROM update_log ORDER BY `no` DESC LIMIT 1'
  );
  return rows[0] ?? null;
};
