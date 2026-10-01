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

/**
 * ⚠️⚠️ **大きな文字列を書くとき専用。** ⚠️ 普段は `execute()` を使うこと。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **なぜ必要か（mysql2 の不具合）**
 *
 *   ⚠️ `execute()` はプリペアドステートメント（COM_STMT_EXECUTE）を使う。
 *     ⚠️ ⚠️ **mysql2 3.24.1 には、値が 65,535 バイト以上のときに
 *       送信パケットの長さを1バイト読み違える不具合がある。**
 *
 *       Internal error: COM_STMT_EXECUTE serialized 99018 bytes, expected 99019
 *
 *   ⚠️ ⚠️ **ローカルで境界を実測した**（2026-10-01）。
 *     ⚠️ **65,534 バイトまで … 通る**
 *     ⚠️⚠️ **65,535 バイト以上 … 必ず落ちる**
 *     ⚠️ 文字の種類は関係ない（⚠️ ASCII だけでも落ちる）。⚠️ **長さだけの問題。**
 *
 *   ⚠️ 長さを表す数の桁が 3バイト→4バイト に変わる境目であり、
 *     ⚠️ **見積もり側と書き込み側で桁数の判断が食い違っている。**
 *
 * ⚠️ こちらはテキストプロトコル（COM_QUERY）で、⚠️ **値は mysql2 が
 *   エスケープして文に埋め込む。** ⚠️ ⚠️ **プレースホルダは使えるので
 *   SQLインジェクションの心配は `execute()` と同じく無い。**
 *
 * ⚠️⚠️ **使う場所を増やさないこと。**
 *   ⚠️ プリペアドのほうが速く、型も厳密である。
 *   ⚠️ ⚠️ **「64KBを超えうる値を書く」ところだけ**に留める。
 *     ⚠️ 現状は分析レポートのHTML（features/analysis/report.ts）のみ。
 *
 * ⚠️ mysql2 を上げたときは ⚠️ **この関数が要らなくなったか確かめること。**
 * ─────────────────────────────────────────────
 */
export const executeLarge = async (
  sql: string,
  params: ReadonlyArray<SqlParam> = []
): Promise<ResultSetHeader> => {
  const [result] = await pool.query<ResultSetHeader>(sql, normalizeParams(params));
  return result;
};

/**
 * トランザクション。複数の書き込みを1つにまとめる。
 *
 * ⚠️ `query()` / `execute()` はプールから毎回別の接続を取るため、
 *   それらを並べても**トランザクションにならない**。
 *   BEGIN した接続と別の接続で INSERT すると、ロールバックが効かない。
 *   必ずこの関数が渡す `tx` を使うこと。
 *
 * @example
 * await withTransaction(async (tx) => {
 *   await tx.execute('INSERT INTO master_data ...', [...]);
 *   await tx.execute('UPDATE inquiry_ambassador SET sync = 1 ...', [...]);
 * });
 */
export interface Tx {
  query<T extends RowDataPacket>(sql: string, params?: ReadonlyArray<SqlParam>): Promise<T[]>;
  execute(sql: string, params?: ReadonlyArray<SqlParam>): Promise<ResultSetHeader>;
}

export const withTransaction = async <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  const tx: Tx = {
    query: async <R extends RowDataPacket>(
      sql: string,
      params: ReadonlyArray<SqlParam> = []
    ) => {
      const [rows] = await connection.execute<R[]>(sql, normalizeParams(params));
      return rows;
    },
    execute: async (sql: string, params: ReadonlyArray<SqlParam> = []) => {
      const [result] = await connection.execute<ResultSetHeader>(sql, normalizeParams(params));
      return result;
    },
  };

  try {
    const result = await fn(tx);
    await connection.commit();
    return result;
  } catch (error) {
    // ⚠️ ロールバック自体が失敗しても、元の例外を投げること。
    //   ここで別の例外に差し替えると、本当の原因が消える。
    try {
      await connection.rollback();
    } catch {
      // 接続が既に切れている場合など。元の例外を優先する
    }
    throw error;
  } finally {
    // ⚠️ 例外時も必ずプールへ返す。返さないと接続が枯れて全体が止まる
    connection.release();
  }
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
