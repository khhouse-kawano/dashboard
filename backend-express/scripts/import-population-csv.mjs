/**
 * 人口 CSV → population 取り込みスクリプト
 *
 * 使い方
 *   cd backend-express
 *   node scripts/import-population-csv.mjs "<CSVのパス>" --dry-run
 *   node scripts/import-population-csv.mjs "<CSVのパス>"
 *   node scripts/import-population-csv.mjs "<CSVのパス>" --prefs 鹿児島県,宮崎県,福岡県
 *
 * CSV の形式（ヘッダ行なし・27列）
 *   0 空欄 / 1 都道府県 / 2 市区町村 / 3 性別(計/男/女) / 4 調査年
 *   5 総人口 / 6..26 5歳階級（0〜4 … 100歳以上）の21列
 *
 * ── 対象県を絞る理由 ────────────────────────────────
 * CSV は全国47都道府県ぶんあるが、市況分析の対象は限られる。
 * population は市況表の「行」を決める土台で、都道府県の選択肢も
 * 他テーブルの絞り込みもここを基準にしているため、全県を入れると
 * 自社の営業実績が無い県まで選択肢に並んでしまう。
 * 既定では TARGET_PREFS の県だけを取り込む。増やすときは --prefs で指定する。
 * ────────────────────────────────────────────
 *
 * 設計方針
 *   - 全件入れ替え（TRUNCATE → INSERT）をトランザクションで囲む。
 *   - 「総人口 = 5歳階級の合計」は一致しない。年齢不詳が総人口にだけ含まれるため。
 *     これは元データの仕様なので、差が大きいものだけ警告する。
 */

import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { parseCsv, createWarningCollector, dbConfig, chunk } from './lib/csv.mjs';

/** 市況分析の対象県。ここを増やすと都道府県セレクタに出るようになる。 */
const TARGET_PREFS = ['鹿児島県', '宮崎県', '大分県', '熊本県', '佐賀県', '福岡県'];

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = process.argv[2];

if (CSV_PATH === undefined || CSV_PATH.startsWith('--')) {
  console.error('CSVのパスを第1引数で指定してください。');
  process.exit(1);
}

const prefsArgIndex = process.argv.indexOf('--prefs');
const targetPrefs =
  prefsArgIndex === -1
    ? TARGET_PREFS
    : (process.argv[prefsArgIndex + 1] ?? '').split(',').map((p) => p.trim()).filter((p) => p !== '');

if (targetPrefs.length === 0) {
  console.error('--prefs には都道府県をカンマ区切りで指定してください。');
  process.exit(1);
}

const COL = { pref: 1, area: 2, gender: 3, year: 4, amount: 5 };

/** 5歳階級の列名。DBの列順と一致させている。 */
const AGE_COLUMNS = [
  'age_0_4', 'age_5_9', 'age_10_14', 'age_15_19', 'age_20_24',
  'age_25_29', 'age_30_34', 'age_35_39', 'age_40_44', 'age_45_49',
  'age_50_54', 'age_55_59', 'age_60_64', 'age_65_69', 'age_70_74',
  'age_75_79', 'age_80_84', 'age_85_89', 'age_90_94', 'age_95_99',
  'age_100_',
];

const AGE_START = 6;

const GENDERS = new Set(['計', '男', '女']);

/**
 * 総人口と5歳階級の合計の差の許容幅（割合）。
 * 年齢不詳ぶんだけ総人口のほうが多くなる。1%を超えたら入力ミスを疑う。
 */
const UNKNOWN_AGE_TOLERANCE = 0.01;

const cell = (row, index) => String(row[index] ?? '').trim();

const main = async () => {
  const warnings = createWarningCollector();
  const targets = new Set(targetPrefs);

  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
    .filter((row) => String(row[COL.pref] ?? '').trim() !== '');

  const records = [];
  const seen = new Set();
  let skippedOtherPref = 0;

  rows.forEach((row, index) => {
    const sourceRow = index + 1;
    const pref = cell(row, COL.pref);

    if (!targets.has(pref)) {
      skippedOtherPref += 1;
      return;
    }

    const area = cell(row, COL.area);
    const gender = cell(row, COL.gender);
    const year = cell(row, COL.year);

    if (!GENDERS.has(gender)) {
      warnings.warn(`性別が想定外: ${JSON.stringify(gender)}`, `行${sourceRow}`);
      return;
    }

    const key = `${pref}|${area}|${gender}|${year}`;
    if (seen.has(key)) {
      warnings.warn('同じ (県, 市区町村, 性別, 年) が重複しているためスキップ', `行${sourceRow}`);
      return;
    }
    seen.add(key);

    const amountRaw = cell(row, COL.amount);
    const amount = Number(amountRaw);
    if (amountRaw === '' || !Number.isInteger(amount)) {
      warnings.warn(`総人口が数値でない: ${JSON.stringify(amountRaw)}`, `行${sourceRow}`);
      return;
    }

    const ages = [];
    let broken = false;
    for (let i = 0; i < AGE_COLUMNS.length; i++) {
      const raw = cell(row, AGE_START + i);
      const parsed = Number(raw);
      if (raw === '' || !Number.isInteger(parsed)) {
        warnings.warn(`世代の値が数値でない: ${JSON.stringify(raw)}`, `行${sourceRow}`);
        broken = true;
        break;
      }
      ages.push(parsed);
    }
    if (broken) return;

    // 年齢不詳ぶんだけ総人口のほうが多くなるのが正常。開きすぎだけ警告する。
    const bandSum = ages.reduce((acc, value) => acc + value, 0);
    if (amount > 0 && Math.abs(amount - bandSum) / amount > UNKNOWN_AGE_TOLERANCE) {
      warnings.warn(
        `総人口(${amount})と世代合計(${bandSum})の差が1%を超える`,
        `${pref}/${area}/${gender}`
      );
    }

    records.push([pref, area, gender, year, amount, ...ages]);
  });

  // ---- サマリ ----
  const byPref = new Map();
  for (const record of records) byPref.set(record[0], (byPref.get(record[0]) ?? 0) + 1);

  console.log(`\n=== population 取り込み${DRY_RUN ? '（DRY RUN）' : ''} ===`);
  console.log(`CSV行数         : ${rows.length}`);
  console.log(`対象外の県で除外: ${skippedOtherPref}`);
  console.log(`取り込み対象    : ${records.length}`);
  console.log(`対象県          : ${targetPrefs.join(', ')}`);

  console.log('\n[県別]');
  for (const pref of targetPrefs) {
    const count = byPref.get(pref) ?? 0;
    const areas = new Set(records.filter((r) => r[0] === pref).map((r) => r[1])).size;
    const mark = count === 0 ? '  ← CSVに存在しない' : '';
    console.log(`  ${pref.padEnd(6)} ${String(count).padStart(4)}行 / ${String(areas).padStart(3)}地域${mark}`);
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
    await connection.query('TRUNCATE TABLE `population`');

    const sql = `
      INSERT INTO \`population\`
        (pref, area, gender, year, amount, ${AGE_COLUMNS.join(', ')})
      VALUES ?`;

    for (const batch of chunk(records, 500)) {
      await connection.query(sql, [batch]);
    }

    await connection.commit();
    console.log(`\n${records.length} 件を書き込みました。`);
    console.log('※ 対象県を変えたときは import-estat-building-yearly.mjs も実行し直すこと。');
    console.log('   年次の着工は population の県を見て取得範囲を決めている。');
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
