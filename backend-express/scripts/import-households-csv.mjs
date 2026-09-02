/**
 * 世帯総数 CSV → households 取り込みスクリプト
 *
 * 使い方
 *   cd backend-express
 *   node scripts/import-households-csv.mjs "<CSVのパス>" --dry-run
 *   node scripts/import-households-csv.mjs "<CSVのパス>"
 *
 * CSV の形式（ヘッダ行なし・8列）
 *   0 空欄 / 1 都道府県 / 2 市区町村 / 3 調査年(空)
 *   4 一般世帯総数 / 5 単独世帯 / 6 2人以上の世帯 / 7 間借り・同居など
 *
 * ── 2世代が連結されている点に注意 ──────────────────────────
 * このCSVは同じ (都道府県, 市区町村) が2回出てくる。前半が新しい調査、
 * 後半が古い調査で、県全域行の書き方だけが違う。
 *
 *   前半（新しい）… 県全域行の area が '-'
 *   後半（古い）  … 県全域行の area が県名そのもの（例「佐賀県」）
 *
 * 佐賀県なら 314,000（前半）と 307,900（後半）。世帯数は増加傾向なので
 * 値が大きい前半が新しい。市区町村もすべて前半のほうが大きく、
 * 既存DBで観測した傾向（90組中89組）とも一致する。
 * よって「各 (都道府県, 市区町村) の最初の出現だけを採る」で新しい世代が残る。
 * ────────────────────────────────────────────────
 *
 * 設計方針
 *   - 全件入れ替え（TRUNCATE → INSERT）をトランザクションで囲む。
 *   - 「総数 = 単独 + 2人以上 + 間借り」を検算するが、原資料が10戸単位に
 *     丸められているため ±10 程度のズレは正常。閾値を超えたものだけ警告する。
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
  pref: 1, area: 2, year: 3,
  amount: 4, onePerson: 5, moreTwoPeople: 6, liveTogether: 7,
};

/** 原資料の丸め（10戸単位）で生じる誤差。これを超えたら入力ミスを疑う。 */
const ROUNDING_TOLERANCE = 50;

const cell = (row, key) => String(row[COL[key]] ?? '').trim();

const main = async () => {
  const warnings = createWarningCollector();

  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
    .filter((row) => String(row[COL.pref] ?? '').trim() !== '');

  /** 採用済みの (pref, area)。2回目の出現＝古い世代なので捨てる。 */
  const seen = new Set();
  const records = [];
  let skippedOldGeneration = 0;

  rows.forEach((row, index) => {
    const sourceRow = index + 1;
    const pref = cell(row, 'pref');
    const area = cell(row, 'area');

    // 古い世代の県全域行。新しい世代では '-' で入っているので不要。
    if (area === pref) {
      skippedOldGeneration += 1;
      return;
    }

    const key = `${pref}|${area}`;
    if (seen.has(key)) {
      skippedOldGeneration += 1;
      return;
    }
    seen.add(key);

    const values = {};
    let broken = false;
    for (const field of ['amount', 'onePerson', 'moreTwoPeople', 'liveTogether']) {
      const raw = cell(row, field);
      const parsed = Number(raw);
      if (raw === '' || !Number.isInteger(parsed)) {
        warnings.warn(`数値でない値: ${JSON.stringify(raw)}`, `行${sourceRow}`);
        broken = true;
        break;
      }
      values[field] = parsed;
    }
    if (broken) return;

    // 県全域行は市区町村の積み上げではないので検算の対象外
    if (area !== '-') {
      const breakdown = values.onePerson + values.moreTwoPeople + values.liveTogether;
      const gap = Math.abs(breakdown - values.amount);
      if (gap > ROUNDING_TOLERANCE) {
        warnings.warn(
          `総数(${values.amount})と内訳の和(${breakdown})の差が丸め誤差を超える`,
          `${pref}/${area}`
        );
      }
    }

    records.push([
      pref, area, cell(row, 'year'),
      values.amount, values.onePerson, values.moreTwoPeople, values.liveTogether,
    ]);
  });

  const prefs = new Set(records.map((r) => r[0]));
  const totals = records.filter((r) => r[1] === '-').length;

  console.log(`\n=== households 取り込み${DRY_RUN ? '（DRY RUN）' : ''} ===`);
  console.log(`CSV行数           : ${rows.length}`);
  console.log(`古い世代として除外: ${skippedOldGeneration}`);
  console.log(`取り込み対象      : ${records.length}`);
  console.log(`都道府県          : ${prefs.size}件`);
  console.log(`県全域行(-)       : ${totals}件`);

  // 郡・区は他の行と重なるので、県計を足し上げるときの除外対象。件数を把握しておく。
  const gun = records.filter((r) => r[1].endsWith('郡')).length;
  const ku = records.filter((r) => /区$/.test(r[1])).length;
  console.log(`  うち郡の行      : ${gun}`);
  console.log(`  うち区の行      : ${ku}`);

  console.log('\n[警告]');
  warnings.report();

  if (DRY_RUN) {
    console.log('\nDRY RUN のため書き込みは行いませんでした。');
    return;
  }

  const connection = await mysql.createConnection(dbConfig());
  try {
    await connection.beginTransaction();
    await connection.query('TRUNCATE TABLE `households`');

    const sql = `
      INSERT INTO \`households\`
        (pref, area, year, amount, one_person, more_two_people, live_together)
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
