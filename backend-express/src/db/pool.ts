import mysql from 'mysql2/promise';
import type { ExecuteValues, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';

/**
 * プレースホルダに渡せる値。
 * JSON 由来の値は `undefined` になりがちだが mysql2 は undefined を受け付けないため、
 * 呼び出し側の利便性のために undefined も許可し、内部で null に変換する。
 */
export type SqlParam = ExecuteValues | undefined;

const normalizeParams = (params: ReadonlyArray<SqlParam>): ExecuteValues[] =>
  params.map((param) => (param === undefined ? null : param));

/**
 * MariaDB へのコネクションプール。
 *
 * PHP 側は「リクエストごとに new PDO」だったが、Node は 1 プロセスが
 * 常駐し続けるため、接続を使い回すプールを 1 つだけ作って共有する。
 */
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // PDO と同じく DATE / DATETIME を文字列のまま返す。
  // Date オブジェクトに変換されるとタイムゾーンずれが起きるため、
  // 既存フロントとの互換性のためにも文字列で統一する。
  dateStrings: true,
  // ⚠️ JSON 型の列を文字列のまま返す。
  //
  //   mysql2 は既定で JSON 列を JSON.parse してオブジェクトにするが、
  //   PDO は文字列のまま返す。そのため既定のままだと
  //
  //     PHP     : "family_info": "[{\"name\":\"...\"}]"   ← 文字列
  //     mysql2  : "family_info": [{"name":"..."}]          ← 配列
  //
  //   となり、フロントが JSON.parse() している箇所が
  //   「既にオブジェクト」を渡されて壊れる。
  //
  //   2026-09-02 の callStatusList の差分比較で
  //   family_info.family_info の3,086件がこれに該当した。
  jsonStrings: true,
});

/**
 * SELECT 用ヘルパー。プレースホルダを必ず使うことで SQL インジェクションを防ぐ。
 *
 * @example
 * const rows = await query<StaffRow>('SELECT name FROM staff WHERE id = ?', [id]);
 */
export const query = async <T extends RowDataPacket>(
  sql: string,
  params: ReadonlyArray<SqlParam> = []
): Promise<T[]> => {
  const [rows] = await pool.execute<T[]>(sql, normalizeParams(params));
  return rows;
};

/**
 * INSERT / UPDATE / DELETE 用ヘルパー。
 * 影響行数（affectedRows）や採番された ID（insertId）を含む結果を返す。
 */
export const execute = async (
  sql: string,
  params: ReadonlyArray<SqlParam> = []
): Promise<ResultSetHeader> => {
  const [result] = await pool.execute<ResultSetHeader>(sql, normalizeParams(params));
  return result;
};

/** 疎通確認。接続できない場合は例外を投げる */
export const pingDatabase = async (): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    // 例外が出ても必ずプールに返す
    connection.release();
  }
};

/** プロセス終了時にコネクションを片付ける */
export const closePool = async (): Promise<void> => {
  await pool.end();
};
