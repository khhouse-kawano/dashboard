/**
 * 「かえるホーム工程表」CSV → kaeru_building 取り込みスクリプト
 *
 * 使い方
 *   cd backend-express
 *   node scripts/import-kaeru-csv.mjs "<CSVのパス>" --dry-run
 *   node scripts/import-kaeru-csv.mjs "<CSVのパス>"
 *
 * 設計方針
 *   - 全件入れ替え（TRUNCATE → INSERT）。トランザクションで囲む。
 *   - このCSVは市区町村しか持たず県が無い。population テーブルの (pref, area) を
 *     引いて補完する。市況表が「県 → 市区町村」で絞り込む作りのため、
 *     県が無いと集計に載らない。
 *   - 基礎着工日の `1970-01-01` はスプレッドシート側の未入力を表すセンチネル値。
 *     219件あり、実際に1970年に着工したわけではないので NULL にする。
 *
 * ログについて
 *   顧客名・担当者名は個人情報のため出力しない。物件IDと物件名のみ扱う。
 *   （物件名は「姶良松原A」のような区画名だが、稀に「〇〇様」形式が混ざるため
 *     警告のサンプルには物件IDだけを使う。）
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

/** 列位置。ヘッダは1行のみ。 */
const COL = {
  propertyId: 0,       // 物件ID
  name: 1,             // 物件名称
  useCode: 2,          // 用途
  staff: 4,            // 契約担当
  progress: 5,         // 工程状況
  sales: 6,            // 販売状況
  area: 7,             // エリア（市区町村）
  constructionDate: 11,// 基礎着工日
  completionDate: 12,  // 完工日
  handoverDate: 15,    // 引渡日
  contractDate: 18,    // 契約計上日
};

const HEADER_ROWS = 1;

/** スプレッドシートが未入力を表すために入れているセンチネル値 */
const EPOCH_SENTINEL = '1970-01-01';

/**
 * 用途コード → category。
 *
 * スプレッドシートに凡例が無いため、コードの正式な定義は実データからの推定。
 *
 *   4 … 物件名に「中古」を含むものが並ぶ中古再販。新設着工ではないので、
 *       e-Stat の分譲着工（building.condominiums）を分母にしたシェアの
 *       分子から外す。
 *   3 … 「S×L平屋」「H川上」など価格3400〜3800万円帯の注文系モデルハウス。
 *       分譲着工の分子に含めてよいと確認済み（2026-08-27）。
 *   0/1/2/5 … 建売。
 *
 * ※ use_code 列に生値を残してあるので、定義が変わっても再取り込みなしで
 *   ここのマッピングだけ直せば見直せる。
 */
const CATEGORY_BY_USE_CODE = new Map([['4', '中古']]);
const categoryOf = (useCode) => CATEGORY_BY_USE_CODE.get(useCode) ?? '建売';

const cell = (row, key) => String(row[COL[key]] ?? '').trim();

/**
 * 市区町村 → 県 の対応表を作る。
 *
 * population だけでは町村の収録が足りず（三股町・国富町・綾町・肝付町 等が無い）
 * 35件が補完できなかった。building は町村まで網羅しているので4テーブルを併用する。
 * いずれも e-Stat 由来で県名の表記は揃っている。
 */
const loadAreaToPref = async (connection) => {
  const [rows] = await connection.query(`
    SELECT DISTINCT pref, area FROM population    WHERE area <> '-' AND area <> ''
    UNION SELECT DISTINCT pref, area FROM building     WHERE area <> '-' AND area <> ''
    UNION SELECT DISTINCT pref, area FROM households   WHERE area <> '-' AND area <> ''
    UNION SELECT DISTINCT pref, area FROM households_c WHERE area <> '-' AND area <> ''
  `);

  const map = new Map();
  const ambiguous = new Set();

  for (const { pref, area } of rows) {
    const key = String(area).trim();
    const value = String(pref).trim();
    const existing = map.get(key);
    if (existing !== undefined && existing !== value) {
      // 同名の市区町村が複数県にある場合は機械的に決められない
      ambiguous.add(key);
      continue;
    }
    map.set(key, value);
  }

  for (const key of ambiguous) {
    map.delete(key);
    console.log(`  ※ ${key} は複数県に存在するため県を自動補完しません`);
  }
  return map;
};

const main = async () => {
  const warnings = createWarningCollector();
  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8')).slice(HEADER_ROWS);

  // 県の補完には DB が要るので、dry-run でも参照だけはする
  const connection = await mysql.createConnection(dbConfig());
  let records = [];

  try {
    const areaToPref = await loadAreaToPref(connection);
    console.log(`\ne-Statテーブルから市区町村→県の対応表を ${areaToPref.size} 件読み込みました。`);

    const seen = new Set();

    rows.forEach((row, index) => {
      const sourceRow = index + HEADER_ROWS + 1;

      if (row.every((c) => String(c).trim() === '')) return;

      const rawId = cell(row, 'propertyId');
      const propertyId = Number(rawId);
      if (!Number.isInteger(propertyId) || propertyId <= 0) {
        warnings.warn('物件IDが不正なためスキップ', `行${sourceRow}`);
        return;
      }
      if (seen.has(propertyId)) {
        warnings.warn('物件IDが重複しているためスキップ', `ID=${propertyId}`);
        return;
      }
      seen.add(propertyId);

      // 着工日: 1970-01-01 は未入力
      const rawConstruction = cell(row, 'constructionDate');
      let constructionDate = normalizeDate(rawConstruction, { minYear: 1970 });
      if (constructionDate === EPOCH_SENTINEL) {
        constructionDate = null;
        warnings.warn('基礎着工日が 1970-01-01（未入力）のため NULL にした', `ID=${propertyId}`);
      } else if (constructionDate === null && rawConstruction !== '') {
        warnings.warn(`基礎着工日を日付として解釈できない: ${JSON.stringify(rawConstruction)}`, `ID=${propertyId}`);
      }

      const area = cell(row, 'area');
      let pref = '';
      if (area === '') {
        warnings.warn('エリアが空のため県を補完できない', `ID=${propertyId}`);
      } else {
        pref = areaToPref.get(area) ?? '';
        if (pref === '') {
          warnings.warn(`population に該当エリアが無く県を補完できない: ${JSON.stringify(area)}`, `ID=${propertyId}`);
        }
      }

      const useCode = cell(row, 'useCode');

      records.push([
        propertyId,
        cell(row, 'name'),
        useCode,
        categoryOf(useCode),
        cell(row, 'progress'),
        cell(row, 'sales'),
        area,
        pref,
        constructionDate,
        normalizeDate(cell(row, 'completionDate'), { minYear: 1970 }),
        normalizeDate(cell(row, 'handoverDate'), { minYear: 1970 }),
        normalizeDate(cell(row, 'contractDate'), { minYear: 1970 }),
        cell(row, 'staff'),
      ]);
    });

    // 1970-01-01 は completionDate 等にも入りうる。まとめて潰す。
    records = records.map((r) => r.map((v) => (v === EPOCH_SENTINEL ? null : v)));

    const countBy = (index) => records.reduce((acc, r) => {
      const key = r[index] === '' ? '(空)' : r[index];
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map());

    console.log(`\n=== kaeru_building 取り込み${DRY_RUN ? '（DRY RUN）' : ''} ===`);
    console.log(`CSV行数(ヘッダ除く): ${rows.length}`);
    console.log(`取り込み対象       : ${records.length}`);
    console.log(`着工日あり         : ${records.filter((r) => r[8] !== null).length}`);

    console.log('\n[category]');
    for (const [key, value] of [...countBy(3).entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(value).padStart(5)}  ${key}`);
    }
    console.log('\n[県（補完後）]');
    for (const [key, value] of [...countBy(7).entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(value).padStart(5)}  ${key}`);
    }
    console.log('\n[販売状況]');
    for (const [key, value] of [...countBy(5).entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(value).padStart(5)}  ${key}`);
    }

    console.log('\n[警告]');
    warnings.report();

    if (DRY_RUN) {
      console.log('\nDRY RUN のため書き込みは行いませんでした。');
      return;
    }

    await connection.beginTransaction();
    await connection.query('TRUNCATE TABLE `kaeru_building`');

    const sql = `
      INSERT INTO \`kaeru_building\`
        (property_id, name, use_code, category, progress_status, sales_status,
         area, pref, constructionDate, completionDate, handoverDate, contractDate, staff)
      VALUES ?`;

    for (const batch of chunk(records, 500)) {
      await connection.query(sql, [batch]);
    }

    await connection.commit();
    console.log(`\n${records.length} 件を書き込みました。`);
  } catch (error) {
    try { await connection.rollback(); } catch { /* 未開始なら無視 */ }
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
