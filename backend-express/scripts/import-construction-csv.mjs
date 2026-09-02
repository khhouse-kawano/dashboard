/**
 * 「受注完工【KHG】」CSV → contract_customer 取り込みスクリプト
 *
 * 使い方
 *   cd backend-express
 *   node scripts/import-construction-csv.mjs "<CSVのパス>" --dry-run
 *   node scripts/import-construction-csv.mjs "<CSVのパス>"
 *
 * 環境変数
 *   DB_HOST(127.0.0.1) DB_PORT(3307) DB_NAME(local_db) DB_USER(local_user) DB_PASS(local_password)
 *
 * 設計方針
 *   - 全件入れ替え（TRUNCATE → INSERT）。スプレッドシートが常に正であり、
 *     DB側での独自編集は存在しないため、差分更新にする理由がない。
 *     取り違えを防ぐためトランザクションで囲み、失敗したら元に戻す。
 *   - 値の自動補正はしない。日付として読めない値は NULL にして status に退避し、
 *     何件あったかを警告として出す。勝手に直すと元データの誤りが隠れてしまう。
 *
 * ログについて
 *   氏名・住所・担当者名は個人情報のため出力しない。
 *   調査に必要な手掛かりは「元CSVの行番号」だけを出す。
 */

import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { parseCsv, normalizeDate, createWarningCollector, dbConfig, chunk } from './lib/csv.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = process.argv[2];

if (CSV_PATH === undefined || CSV_PATH.startsWith('--')) {
  console.error('CSVのパスを第1引数で指定してください。');
  process.exit(1);
}

/**
 * 列位置。CSVはヘッダが2行あり、3行目からがデータ。
 * 列9は結合セルの名残で常に空。
 */
const COL = {
  name: 1,             // 邸名
  contractDate: 2,     // 契約計上年月日
  constructionDate: 3, // 現在 着工予定日（済は実績）
  completionDate: 4,   // 完工予定日（済は実績）
  handoverDate: 5,     // 現在 引渡年月日（済は実績）
  staff: 6,            // 営業担当
  section: 7,          // 営業所属課
  shop: 8,             // 事業所
  address: 10,         // 建築地
  pref: 11,            // 県
};

const HEADER_ROWS = 2;
const DATE_FIELDS = ['contractDate', 'constructionDate', 'completionDate', 'handoverDate'];

/** 日付列に入りうる非日付の状態値。日付として無効でも「打ち間違い」ではないもの。 */
const STATUS_VALUES = new Set(['未定', '解約', '未入力', '工程表無し', '-', '工程表なし']);

const cell = (row, key) => String(row[COL[key]] ?? '').trim();

const main = async () => {
  const warnings = createWarningCollector();
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8')).slice(HEADER_ROWS);

  const records = [];

  rows.forEach((row, index) => {
    const sourceRow = index + HEADER_ROWS + 1; // 1始まりの実ファイル行番号

    const name = cell(row, 'name');
    if (name === '') {
      // 完全な空行と、名前だけ抜けた行。どちらも集計対象にならない。
      warnings.warn('邸名が空のためスキップ', `行${sourceRow}`);
      return;
    }

    // 日付4列を正規化する。非日付値は status にまとめて退避する。
    const dates = {};
    let status = '';
    for (const field of DATE_FIELDS) {
      const raw = cell(row, field);
      const normalized = normalizeDate(raw);
      dates[field] = normalized;

      if (normalized !== null || raw === '') continue;

      if (STATUS_VALUES.has(raw)) {
        // 「解約」は他の状態より重いので優先して残す
        if (status === '' || raw === '解約') status = raw;
      } else {
        warnings.warn(`日付として解釈できない値（要修正）: ${JSON.stringify(raw)}`, `行${sourceRow}`);
      }
    }

    const shop = cell(row, 'shop');
    let category = '';
    if (shop === '') {
      warnings.warn('事業所が空のため category を判定できない', `行${sourceRow}`);
    } else {
      category = shop.includes('かえる') ? '建売' : '注文';
    }

    if (cell(row, 'pref') === '') {
      warnings.warn('県が空', `行${sourceRow}`);
    }

    records.push([
      name,
      dates.contractDate,
      dates.constructionDate,
      dates.completionDate,
      dates.handoverDate,
      status,
      cell(row, 'staff'),
      cell(row, 'section'),
      shop,
      category,
      cell(row, 'address'),
      cell(row, 'pref'),
      sourceRow,
    ]);
  });

  // ---- 取り込み結果のサマリ（個人情報は含めない） ----
  const countBy = (index) => records.reduce((acc, r) => {
    const key = r[index] === '' ? '(空)' : r[index];
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  console.log(`\n=== contract_customer 取り込み${DRY_RUN ? '（DRY RUN）' : ''} ===`);
  console.log(`CSV行数(ヘッダ除く): ${rows.length}`);
  console.log(`取り込み対象       : ${records.length}`);
  console.log(`着工日あり         : ${records.filter((r) => r[2] !== null).length}`);
  console.log(`status あり        : ${records.filter((r) => r[5] !== '').length}`);

  console.log('\n[category]');
  for (const [key, value] of [...countBy(9).entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(value).padStart(5)}  ${key}`);
  }
  console.log('\n[県]');
  for (const [key, value] of [...countBy(11).entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(value).padStart(5)}  ${key}`);
  }

  console.log('\n[警告]');
  warnings.report();

  if (DRY_RUN) {
    console.log('\nDRY RUN のため書き込みは行いませんでした。');
    return;
  }

  const connection = await mysql.createConnection(dbConfig());
  try {
    await connection.beginTransaction();
    await connection.query('TRUNCATE TABLE `contract_customer`');

    const sql = `
      INSERT INTO \`contract_customer\`
        (name, contractDate, constructionDate, completionDate, handoverDate,
         status, staff, section, shop, category, address, pref, sourceRow)
      VALUES ?`;

    for (const batch of chunk(records, 500)) {
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
  // 例外メッセージに接続情報が混ざる可能性があるため、パスワードだけは伏せる
  const message = String(error?.message ?? error).replace(/(password[^,)]*)/gi, 'password=***');
  console.error(message);
  process.exit(1);
});
