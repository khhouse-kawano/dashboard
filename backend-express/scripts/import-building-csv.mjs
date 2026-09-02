/**
 * 建築着工（月次・市区町村別）CSV → building 取り込みスクリプト
 *
 * 使い方
 *   cd backend-express
 *   node scripts/import-building-csv.mjs "<CSVのパス>" --dry-run
 *   node scripts/import-building-csv.mjs "<CSVのパス>"
 *
 * CSV の形式（ヘッダ行なし・9列）
 *   0 空欄 / 1 都道府県 / 2 市区町村 / 3 年月(YYYY/MM)
 *   4 合計 / 5 持家 / 6 貸家 / 7 給与住宅 / 8 分譲住宅
 *
 * なぜ CSV なのか
 *   e-Stat の API には「月次 × 市区町村（町村を含む）× 利用関係別」の
 *   統計表が存在しない。月次で利用関係別があるのは市部までで、
 *   町村まで網羅した月次は床面積のみ（戸数が無い）。
 *   そのため月次だけは CSV での更新を続ける。
 *   年次は API から取れるので import-estat-building-yearly.mjs を使う。
 *
 * 設計方針
 *   - 全件入れ替え（TRUNCATE → INSERT）をトランザクションで囲む。
 *   - 「合計 = 持家 + 貸家 + 給与住宅 + 分譲住宅」を検算し、合わない行を警告に出す。
 *     自動補正はしない。
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

const COL = {
  pref: 1, area: 2, period: 3,
  amount: 4, owner: 5, rent: 6, employer: 7, condominiums: 8,
};

const NUMERIC = ['amount', 'owner', 'rent', 'employer', 'condominiums'];

const cell = (row, key) => String(row[COL[key]] ?? '').trim();

const main = async () => {
  const warnings = createWarningCollector();

  // ヘッダ行が無いので全行がデータ。BOM は parseCsv 側で落としている。
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
    .filter((row) => String(row[COL.pref] ?? '').trim() !== '');

  const records = [];

  rows.forEach((row, index) => {
    const sourceRow = index + 1;

    const pref = cell(row, 'pref');
    const area = cell(row, 'area');
    const period = cell(row, 'period');

    if (!/^\d{4}\/\d{2}$/.test(period)) {
      warnings.warn(`年月の書式が不正: ${JSON.stringify(period)}`, `行${sourceRow}`);
      return;
    }

    const values = {};
    let broken = false;
    for (const key of NUMERIC) {
      const raw = cell(row, key);
      const parsed = Number(raw);
      if (raw === '' || !Number.isInteger(parsed)) {
        warnings.warn(`数値でない値: ${JSON.stringify(raw)}`, `行${sourceRow}`);
        broken = true;
        break;
      }
      values[key] = parsed;
    }
    if (broken) return;

    // 内訳の合計が合計欄と一致するか検算する。ズレたまま入れるとシェアが狂う。
    const breakdown = values.owner + values.rent + values.employer + values.condominiums;
    if (breakdown !== values.amount) {
      warnings.warn(
        `合計(${values.amount})と内訳の和(${breakdown})が一致しない`,
        `${pref}/${area}/${period}`
      );
    }

    records.push([
      pref, area, period,
      values.amount, values.owner, values.rent, values.employer, values.condominiums,
    ]);
  });

  // ---- サマリ ----
  const prefs = new Set(records.map((r) => r[0]));
  const periods = [...new Set(records.map((r) => r[2]))].sort();

  console.log(`\n=== building 取り込み${DRY_RUN ? '（DRY RUN）' : ''} ===`);
  console.log(`CSV行数     : ${rows.length}`);
  console.log(`取り込み対象: ${records.length}`);
  console.log(`都道府県    : ${prefs.size}件`);
  console.log(`期間        : ${periods[0]} 〜 ${periods[periods.length - 1]}（${periods.length}ヶ月）`);

  // 郡・区は他の行と数値が重なる。県計を足し上げるときに除外する対象なので件数を出す。
  const gun = records.filter((r) => r[1].endsWith('郡')).length;
  const ku = records.filter((r) => r[1].endsWith('区')).length;
  console.log(`  うち郡の行: ${gun}（配下の町村と重複）`);
  console.log(`  うち区の行: ${ku}（属する市と重複）`);

  console.log('\n[警告]');
  warnings.report();

  if (DRY_RUN) {
    console.log('\nDRY RUN のため書き込みは行いませんでした。');
    return;
  }

  const connection = await mysql.createConnection(dbConfig());
  try {
    await connection.beginTransaction();
    await connection.query('TRUNCATE TABLE `building`');

    const sql = `
      INSERT INTO \`building\`
        (pref, area, year, amount, owner, rent, employer, condominiums)
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
