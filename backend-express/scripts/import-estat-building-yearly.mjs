/**
 * e-Stat「住宅着工統計」→ building_yearly 取り込みスクリプト
 *
 * 統計表 0003114522
 *   （新設住宅）利用関係別、資金別、建て方別／戸数、床面積
 *   年次 2011〜2024 / 地域 2,324件（町村・郡を含む）
 *
 * 使い方
 *   cd backend-express
 *   node --env-file=.env scripts/import-estat-building-yearly.mjs --dry-run
 *   node --env-file=.env scripts/import-estat-building-yearly.mjs
 *   node --env-file=.env scripts/import-estat-building-yearly.mjs --from 2015 --to 2024
 *
 * 設計方針
 *   - 取得対象の都道府県は population テーブルから決める。
 *     市況表の行は人口データで作るので、人口が無い県を取っても表に出ない。
 *   - UPSERT。既存行は上書きし、削除はしない。
 *     e-Stat 側が過去年を訂正することがあるため、再実行で追随できるようにする。
 *   - 数値が取れない地域（「-」「X」などの秘匿記号）は 0 ではなく取り込み対象外とし、
 *     何件あったかを警告に出す。0 で埋めるとシェアの分母が狂う。
 *
 * ※ ESTAT_APP_ID はログにも例外メッセージにも出さない。
 */

import mysql from 'mysql2/promise';
import { createWarningCollector, dbConfig, chunk } from './lib/csv.mjs';

const STATS_DATA_ID = '0003114522';
const API_BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json';

/**
 * 表章項目・分類のコード。
 *
 * 2024年から集計行のコードが変わっている点に注意。
 *   2024年   建て方=10(小計) 資金=10(総計) 利用関係=10(合計)
 *   2023年以前 建て方=11(計)  資金=11(計)  利用関係=11(計)
 * 年ごとにどちらか一方しか存在しないため、両方を要求しておけば
 * 重複せずにどの年も拾える。片方だけ指定すると、その年のデータが丸ごと空になる。
 */
const CODE = {
  tab: '19',        // 戸数
  cat01: '10,11',   // 建て方: 小計 / 計
  cat02: '10,11',   // 資金: 総計 / 計
};

/** 利用関係コード → building_yearly の列 */
const USE_RELATION = new Map([
  ['10', 'amount'],       // 合計（2024年〜）
  ['11', 'amount'],       // 計（2023年以前）
  ['12', 'owner'],        // 持家
  ['13', 'rent'],         // 貸家
  ['14', 'employer'],     // 給与住宅
  ['15', 'condominiums'], // 分譲住宅
]);

const APP_ID = process.env.ESTAT_APP_ID;
if (APP_ID === undefined || APP_ID.trim() === '') {
  console.error(
    'ESTAT_APP_ID が設定されていません。\n' +
    'backend-express/.env に書いたうえで、node --env-file=.env で実行してください。'
  );
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const raw = Number(process.argv[index + 1]);
  return Number.isInteger(raw) ? raw : fallback;
};

const YEAR_FROM = argValue('--from', 2011);
const YEAR_TO = argValue('--to', 2024);

const call = async (path, params) => {
  const query = new URLSearchParams({ appId: APP_ID, ...params });
  const response = await fetch(`${API_BASE}/${path}?${query.toString()}`);
  if (!response.ok) throw new Error(`${path} が HTTP ${response.status} を返しました。`);

  const json = await response.json();
  const root = json.GET_STATS_DATA ?? json.GET_META_INFO;
  if (root?.RESULT !== undefined && Number(root.RESULT.STATUS) !== 0) {
    throw new Error(`e-Stat エラー(${root.RESULT.STATUS}): ${root.RESULT.ERROR_MSG}`);
  }
  return json;
};

const asArray = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

/** e-Stat の時間軸コード（2024000000）→ 西暦 */
const toYear = (timeCode) => Number(String(timeCode).slice(0, 4));

/**
 * 対象都道府県の地域コードを集める。
 *
 * 都道府県コードは先頭2桁。`46000` のように 000 で終わるものが県そのもの、
 * それ以外が市区町村・郡。県の行は building に無かった県全域行として使う。
 */
const collectAreas = async (targetPrefs) => {
  const meta = await call('getMetaInfo', { statsDataId: STATS_DATA_ID });
  const classes = asArray(meta.GET_META_INFO?.METADATA_INF?.CLASS_INF?.CLASS_OBJ);
  const areas = asArray(classes.find((c) => c['@id'] === 'area')?.CLASS);

  // 時間軸コードもここで拾っておく。cdTime を指定しないと最新年しか返ってこない。
  const times = asArray(classes.find((c) => c['@id'] === 'time')?.CLASS)
    .map((t) => String(t['@code']))
    .filter((code) => {
      const year = toYear(code);
      return year >= YEAR_FROM && year <= YEAR_TO;
    })
    .sort();

  // 県名 → 先頭2桁 の対応を、県そのものの行から作る
  const prefixByPref = new Map();
  for (const area of areas) {
    const code = String(area['@code']);
    if (!code.endsWith('000')) continue;
    if (targetPrefs.includes(area['@name'])) prefixByPref.set(area['@name'], code.slice(0, 2));
  }

  const missing = targetPrefs.filter((pref) => !prefixByPref.has(pref));
  if (missing.length > 0) {
    console.warn(`  ※ e-Stat に見当たらない県: ${missing.join(', ')}`);
  }

  const selected = [];
  for (const [pref, prefix] of prefixByPref) {
    for (const area of areas) {
      const code = String(area['@code']);
      if (!code.startsWith(prefix)) continue;
      const name = String(area['@name']);
      selected.push({
        pref,
        // 県そのものの行は building の慣習に合わせて '-' で持つ
        area: code === `${prefix}000` ? '-' : name,
        areaCode: code,
        // 政令市の区。市の行と数値が重なるので、県計の検算からは外す
        isWard: name.endsWith('区'),
      });
    }
  }
  return { areas: selected, times };
};

/**
 * 地域コードをまとめて getStatsData を叩く。1回あたりの上限は10万件。
 *
 * cdTime を省くと最新年だけしか返らないため、対象年を必ず明示する。
 */
const fetchValues = async (areaCodes, timeCodes) => {
  const values = [];

  // URL が長くなりすぎないよう地域を分割する
  for (const batch of chunk(areaCodes, 100)) {
    let startPosition = 1;

    for (;;) {
      const json = await call('getStatsData', {
        statsDataId: STATS_DATA_ID,
        cdArea: batch.join(','),
        cdTime: timeCodes.join(','),
        cdTab: CODE.tab,
        cdCat01: CODE.cat01,
        cdCat02: CODE.cat02,
        cdCat04: [...USE_RELATION.keys()].join(','),
        limit: '100000',
        startPosition: String(startPosition),
      });

      const statistical = json.GET_STATS_DATA?.STATISTICAL_DATA;
      values.push(...asArray(statistical?.DATA_INF?.VALUE));

      const next = statistical?.RESULT_INF?.NEXT_KEY;
      if (next === undefined || next === null) break;
      startPosition = Number(next);
    }
  }

  return values;
};

const main = async () => {
  const warnings = createWarningCollector();
  const connection = await mysql.createConnection(dbConfig());

  try {
    // ---- 対象都道府県 ----
    const [prefRows] = await connection.query(
      "SELECT DISTINCT pref FROM population WHERE pref <> '' ORDER BY pref"
    );
    const targetPrefs = prefRows.map((row) => String(row.pref));
    console.log(`対象都道府県: ${targetPrefs.join(', ')}`);

    // ---- 地域コード・年次コード ----
    const { areas, times } = await collectAreas(targetPrefs);
    console.log(`対象地域: ${areas.length}件（県全域行を含む）`);
    console.log(`対象年次: ${times.length}年`);

    const areaByCode = new Map(areas.map((a) => [a.areaCode, a]));

    // ---- 取得 ----
    console.log(`\ne-Stat から ${YEAR_FROM}〜${YEAR_TO} 年を取得します...`);
    const values = await fetchValues([...areaByCode.keys()], times);
    console.log(`  ${values.length} 件の数値を受け取りました。`);

    // ---- (地域, 年) 単位に組み直す ----
    const records = new Map();

    for (const value of values) {
      const year = toYear(value['@time']);
      if (year < YEAR_FROM || year > YEAR_TO) continue;

      const area = areaByCode.get(String(value['@area']));
      if (area === undefined) continue;

      const column = USE_RELATION.get(String(value['@cat04']));
      if (column === undefined) continue;

      // 秘匿・該当なしは「-」「X」等の記号で返る。0 と区別するため取り込まない。
      const raw = String(value.$ ?? '').trim();
      const parsed = Number(raw);
      if (raw === '' || !Number.isFinite(parsed)) {
        warnings.warn(`数値でない値のため無視: ${JSON.stringify(raw)}`, `${area.areaCode}/${year}`);
        continue;
      }

      const key = `${area.areaCode}|${year}`;
      const current = records.get(key) ?? {
        pref: area.pref,
        area: area.area,
        areaCode: area.areaCode,
        isWard: area.isWard,
        year,
        amount: 0, owner: 0, rent: 0, employer: 0, condominiums: 0,
      };
      current[column] = parsed;
      records.set(key, current);
    }

    const rows = [...records.values()].sort(
      (a, b) => a.pref.localeCompare(b.pref) || a.areaCode.localeCompare(b.areaCode) || a.year - b.year
    );

    // ---- サマリ ----
    const years = [...new Set(rows.map((r) => r.year))].sort();
    console.log(`\n=== building_yearly 取り込み${DRY_RUN ? '（DRY RUN）' : ''} ===`);
    console.log(`行数: ${rows.length}`);
    console.log(`年次: ${years[0]} 〜 ${years[years.length - 1]}（${years.length}年）`);

    const byPref = rows.reduce((acc, r) => {
      acc.set(r.pref, (acc.get(r.pref) ?? 0) + 1);
      return acc;
    }, new Map());
    console.log('\n[県別の行数]');
    for (const [pref, count] of [...byPref.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(5)}  ${pref}`);
    }

    // 検算: 県全域行の持家が市区町村の合計と一致するか。
    //   郡は配下の町村と、政令市の区は市の行と、それぞれ数値が重なるので合計から外す。
    const latest = years[years.length - 1];
    console.log(`\n[検算 ${latest}年 持家戸数]`);
    for (const pref of byPref.keys()) {
      const total = rows.find((r) => r.pref === pref && r.area === '-' && r.year === latest);
      const parts = rows.filter(
        (r) =>
          r.pref === pref &&
          r.area !== '-' &&
          !r.area.endsWith('郡') &&
          !r.isWard &&
          r.year === latest
      );
      const sum = parts.reduce((acc, r) => acc + r.owner, 0);
      const mark = total !== undefined && total.owner === sum ? '一致' : `ずれ ${(total?.owner ?? 0) - sum}`;
      console.log(`  ${pref}: 県全域=${total?.owner ?? '-'} / 市区町村合計=${sum}  → ${mark}`);
    }

    console.log('\n[警告]');
    warnings.report();

    if (DRY_RUN) {
      console.log('\nDRY RUN のため書き込みは行いませんでした。');
      return;
    }

    // ---- UPSERT ----
    const sql = `
      INSERT INTO \`building_yearly\`
        (pref, area, areaCode, year, amount, owner, rent, employer, condominiums)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        pref = VALUES(pref), area = VALUES(area),
        amount = VALUES(amount), owner = VALUES(owner), rent = VALUES(rent),
        employer = VALUES(employer), condominiums = VALUES(condominiums)`;

    const tuples = rows.map((r) => [
      r.pref, r.area, r.areaCode, r.year,
      r.amount, r.owner, r.rent, r.employer, r.condominiums,
    ]);

    await connection.beginTransaction();
    for (const batch of chunk(tuples, 500)) {
      await connection.query(sql, [batch]);
    }
    await connection.commit();

    console.log(`\n${rows.length} 件を書き込みました。`);
  } catch (error) {
    try { await connection.rollback(); } catch { /* 未開始なら無視 */ }
    throw error;
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  // クエリ文字列に appId が混ざる可能性があるため必ず伏せる
  const message = String(error?.message ?? error)
    .replace(/appId=[^&\s]+/g, 'appId=***')
    .replace(/(password[^,)]*)/gi, 'password=***');
  console.error(message);
  process.exit(1);
});
