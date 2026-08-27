/**
 * 市況分析のテーブルを、本番へ適用できる1本のSQLに書き出す。
 *
 * 使い方
 *   cd backend-express
 *   node scripts/export-market-tables.mjs
 *   node scripts/export-market-tables.mjs --out ../market_deploy.sql
 *
 * なぜ必要か
 *   本番のDBには市況分析のテーブルがまだ無い（または旧構造のまま）。
 *   ローカルで作り直したものをそのまま持っていけるよう、
 *   CREATE TABLE と INSERT をまとめて1ファイルに出す。
 *
 * 安全のための決めごと
 *   - 既存テーブルは DROP せず _backup_<日付> にリネームして退避する。
 *     取り違えたときに戻せるようにするため。
 *   - 参照専用のテーブル（master_data 系）は一切含めない。
 *   - トランザクションで囲み、途中で失敗したら何も残らないようにする。
 *
 * ※ 出力SQLには顧客の氏名・住所が含まれる。取り扱いに注意すること。
 */

import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { dbConfig } from './lib/csv.mjs';

/** 書き出す順番。依存は無いが、レビューしやすいよう用途ごとに並べる。 */
const TABLES = [
  'population',
  'households',
  'households_c',
  'building',
  'building_yearly',
  'contract_customer',
  'kaeru_building',
];

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
};

const OUT_PATH = argValue('--out', 'market_deploy.sql');

/** 日付は実行時に固定して、退避テーブル名がぶれないようにする */
const stamp = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
};

/** SQL のリテラルに変換する。数値もそのまま文字列として安全に出す。 */
const literal = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `'${y}-${m}-${d}'`;
  }
  return mysql.escape(String(value));
};

const main = async () => {
  const suffix = stamp();
  const connection = await mysql.createConnection(dbConfig());
  const parts = [];

  parts.push(
    '-- ============================================================================',
    '-- 市況分析テーブル 本番適用用SQL',
    `-- 生成日時: ${suffix}`,
    '--',
    '-- 適用:',
    '--   mysql -u<USER> -p <DB名> < market_deploy.sql',
    '--',
    `-- 既存テーブルは DROP せず _backup_${suffix} にリネームして退避する。`,
    '-- 問題があれば退避したテーブルから戻せる。',
    '--',
    '-- ※ 顧客の氏名・住所を含む。取り扱いに注意すること。',
    '-- ============================================================================',
    '',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    'START TRANSACTION;',
    ''
  );

  try {
    for (const table of TABLES) {
      const [[{ 'Create Table': createSql }]] = await connection.query(
        `SHOW CREATE TABLE \`${table}\``
      );
      const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
      const [columns] = await connection.query(
        'SELECT column_name FROM information_schema.columns ' +
          'WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position',
        [table]
      );
      const columnNames = columns.map((c) => c.column_name ?? c.COLUMN_NAME);

      parts.push(
        `-- ---------------------------------------------------------------------------`,
        `-- ${table}（${rows.length} 行）`,
        `-- ---------------------------------------------------------------------------`,
        // 対象が無いときに RENAME で落ちないよう、存在確認してから退避する
        `SET @stmt = IF(`,
        `  (SELECT COUNT(*) FROM information_schema.tables`,
        `    WHERE table_schema = DATABASE() AND table_name = '${table}') > 0`,
        `  AND (SELECT COUNT(*) FROM information_schema.tables`,
        `    WHERE table_schema = DATABASE() AND table_name = '${table}_backup_${suffix}') = 0,`,
        `  'RENAME TABLE \`${table}\` TO \`${table}_backup_${suffix}\`',`,
        `  'DO 0'`,
        `);`,
        `PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;`,
        `DROP TABLE IF EXISTS \`${table}\`;`,
        `${createSql};`,
        ''
      );

      if (rows.length > 0) {
        const columnList = columnNames.map((c) => `\`${c}\``).join(', ');
        // 1文が長くなりすぎるとサーバー側の max_allowed_packet に当たるため分割する
        for (let i = 0; i < rows.length; i += 200) {
          const values = rows
            .slice(i, i + 200)
            .map((row) => `(${columnNames.map((c) => literal(row[c])).join(', ')})`)
            .join(',\n');
          parts.push(`INSERT INTO \`${table}\` (${columnList}) VALUES\n${values};`, '');
        }
      }

      console.log(`  ${table.padEnd(20)} ${String(rows.length).padStart(6)} 行`);
    }

    parts.push('COMMIT;', 'SET FOREIGN_KEY_CHECKS = 1;', '');

    const outPath = path.resolve(OUT_PATH);
    fs.writeFileSync(outPath, parts.join('\n'), 'utf8');

    const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
    console.log(`\n${outPath} に書き出しました（${sizeMb} MB）。`);
    console.log(`既存テーブルは _backup_${suffix} に退避されます。`);
    console.log('※ 顧客の氏名・住所を含みます。共有経路に注意してください。');
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  const message = String(error?.message ?? error).replace(/(password[^,)]*)/gi, 'password=***');
  console.error(message);
  process.exit(1);
});
