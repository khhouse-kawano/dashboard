import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * ヘッダーの「新着物件」バッジ。
 *
 * 移植元: backend/src/handlers/header.php
 *
 * ⚠️ SQL は menu.php の新着物件クエリと同一だが、あえて共通化していない。
 *   PHP 側でも2箇所に別々に書かれており、片方だけ条件が変わる可能性がある。
 *   共通化すると「menu を直したら header も変わった」という
 *   移植では検出しづらい事故になるため、PHP の構造をそのまま写す。
 *
 * ⚠️ 件数だけが必要なのに全行を取得している（COUNT(*) を使っていない）。
 *   PHP が count($rows) で数えているのに合わせている。
 *   直近3日分なので行数は少なく、実害は無い。改善は移行完了後。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const ESTATE_SQL = `
  SELECT registered_at
    FROM estate_info
   WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
`;

export interface HeaderResponse {
  estate: number;
}

export const runHeader = async (): Promise<HeaderResponse> => {
  const estate = await query<DynamicRow>(ESTATE_SQL);
  return { estate: estate.length };
};
