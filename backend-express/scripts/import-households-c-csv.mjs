/**
 * 世帯数内訳（住宅の建て方 × 家族類型）CSV → households_c 取り込みスクリプト
 *
 * 使い方
 *   cd backend-express
 *   node scripts/import-households-c-csv.mjs "<CSVのパス>" --dry-run
 *   node scripts/import-households-c-csv.mjs "<CSVのパス>"
 *
 * CSV の形式（ヘッダ行なし・18列）
 *   0 空欄 / 1 都道府県 / 2 市区町村 / 3 住宅の建て方 / 4 delete_key(未使用)
 *   5 一般世帯数
 *   6..9  単身（65歳未満 / 30歳未満 / 30〜64歳 / 65歳以上）
 *   10,11 夫婦のみ（全体 / 65歳以上）
 *   12..17 夫婦＋子（末子 0〜2 / 3〜5 / 6〜9 / 10〜17 / 18〜24 / 25歳以上）
 *
 * 設計方針
 *   - 県全域行は元CSVでは area が県名になっている（例「佐賀県」）。
 *     households 側は '-' に揃えてあるので、ここでも '-' に直して取り込む。
 *     揃っていないと市況表の県全域行で世帯構成が出ない。
 *   - 全件入れ替え（TRUNCATE → INSERT）をトランザクションで囲む。
 *   - 「総数 = 一戸建 + 長屋建 + 共同住宅 + その他」を地域ごとに検算する。
 *     原資料が10戸単位に丸められているため、少しのズレは正常。
 */

import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { parseCsv, createWarningCollector, dbConfig, chunk } from './lib/csv.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = process.argv[2];

if (CSV_PATH === undefined || CSV_PATH.startsWith('--')) {
  console.error('CSVのパスを第1引数で指定してください。');
  process.exit(1);
}

const COL = { pref: 1, area: 2, type: 3 };

/** 5列目以降。DBの列名と並び順を一致させている。 */
const VALUE_COLUMNS = [
  'amount',
  'one_person_under65', 'one_person_under30', 'one_person_30_64', 'one_person_over65',
  'wife_husband', 'wife_husband_over65',
  'wife_husband_child_under3', 'wife_husband_child_3_5', 'wife_husband_child_6_9',
  'wife_husband_child_10_17', 'wife_husband_child_18_24', 'wife_husband_child_over25',
];

const VALUE_START = 5;

/** 「総数」を構成する建て方 */
const PARTS = ['一戸建', '長屋建', '共同住宅', 'その他'];

/** 原資料の丸めで生じる誤差の許容幅 */
const ROUNDING_TOLERANCE = 100;

const cell = (row, index) => String(row[index] ?? '').trim();

const main = async () => {
  const warnings = createWarningCollector();

  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
    .filter((row) => String(row[COL.pref] ?? '').trim() !== '');

  const records = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    const sourceRow = index + 1;
    const pref = cell(row, COL.pref);
    const rawArea = cell(row, COL.area);
    const type = cell(row, COL.type);

    // 県全域行の表記を households と揃える
    const area = rawArea === pref ? '-' : rawArea;

    const key = `${pref}|${area}|${type}`;
    if (seen.has(key)) {
      warnings.warn('同じ (都道府県, 市区町村, 建て方) が重複しているためスキップ', `行${sourceRow}`);
      return;
    }
    seen.add(key);

    const values = [];
    let broken = false;
    for (let i = 0; i < VALUE_COLUMNS.length; i++) {
      const raw = cell(row, VALUE_START + i);
      const parsed = Number(raw);
      if (raw === '' || !Number.isInteger(parsed)) {
        warnings.warn(`数値でない値: ${JSON.stringify(raw)}`, `行${sourceRow}`);
        broken = true;
        break;
      }
      values.push(parsed);
    }
    if (broken) return;

    records.push([pref, area, type, ...values]);
  });

  // ---- 総数と建て方の内訳が合うか検算 ----
  const byArea = new Map();
  for (const record of records) {
    const [pref, area, type, amount] = record;
    const entry = byArea.get(`${pref}|${area}`) ?? { total: null, parts: 0 };
    if (type === '総数') entry.total = amount;
    else if (PARTS.includes(type)) entry.parts += amount;
    byArea.set(`${pref}|${area}`, entry);
  }

  for (const [key, entry] of byArea) {
    if (entry.total === null) {
      warnings.warn('「総数」の行が無い', key);
      continue;
    }
    const gap = Math.abs(entry.total - entry.parts);
    if (gap > ROUNDING_TOLERANCE) {
      warnings.warn(`総数(${entry.total})と建て方の和(${entry.parts})の差が丸め誤差を超える`, key);
    }
  }

  const prefs = new Set(records.map((r) => r[0]));
  const areas = new Set(records.map((r) => `${r[0]}|${r[1]}`));
  const types = new Map();
  for (const record of records) types.set(record[2], (types.get(record[2]) ?? 0) + 1);

  console.log(`\n=== households_c 取り込み${DRY_RUN ? '（DRY RUN）' : ''} ===`);
  console.log(`CSV行数       : ${rows.length}`);
  console.log(`取り込み対象  : ${records.length}`);
  console.log(`都道府県      : ${prefs.size}件`);
  console.log(`地域          : ${areas.size}件（県全域行を含む）`);
  console.log(`県全域行(-)   : ${records.filter((r) => r[1] === '-' && r[2] === '総数').length}件`);
  console.log(`建て方        : ${[...types.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`);

  console.log('\n[警告]');
  warnings.report();

  if (DRY_RUN) {
    console.log('\nDRY RUN のため書き込みは行いませんでした。');
    return;
  }

  const connection = await mysql.createConnection(dbConfig());
  try {
    await connection.beginTransaction();
    await connection.query('TRUNCATE TABLE `households_c`');

    const sql = `
      INSERT INTO \`households_c\`
        (pref, area, type, ${VALUE_COLUMNS.join(', ')})
      VALUES ?`;

    for (const batch of chunk(records, 1000)) {
      await connection.query(sql, [batch]);
    }

    await connection.commit();
    console.log(`\n${records.length} 件を書き込みました。`);
  } catch (error) {
    await connection.rollback();
    console.error('\n取り込みに失敗したためロールバックしました。');
    throw error;
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  const message = String(error?.message ?? error).replace(/(password[^,)]*)/gi, 'password=***');
  console.error(message);
  process.exit(1);
});
