/**
 * e-Stat の統計表（statsDataId）を探すための調査スクリプト。
 *
 * 使い方
 *   cd backend-express
 *   node --env-file=.env scripts/estat-discover.mjs
 *   node --env-file=.env scripts/estat-discover.mjs --keyword "住宅・土地統計調査"
 *   node --env-file=.env scripts/estat-discover.mjs --meta 0003448233   # 表の中身を見る
 *
 * 何もしない安全な読み取り専用スクリプト。DBには一切触らない。
 *
 * ※ ESTAT_APP_ID は環境変数から読むだけで、ログには絶対に出さない。
 */

const APP_ID = process.env.ESTAT_APP_ID;

if (APP_ID === undefined || APP_ID.trim() === '') {
  console.error(
    'ESTAT_APP_ID が設定されていません。\n' +
    'backend-express/.env に書いたうえで、node --env-file=.env で実行してください。'
  );
  process.exit(1);
}

const BASE = 'https://api.e-stat.go.jp/rest/3.0/app/json';

const arg = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
};

/** appId を含む URL は組み立てるが、ログに出すときは必ず伏せる */
const call = async (path, params) => {
  const query = new URLSearchParams({ appId: APP_ID, ...params });
  const response = await fetch(`${BASE}/${path}?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`${path} が HTTP ${response.status} を返しました。`);
  }
  const json = await response.json();

  const result = json.GET_STATS_LIST?.RESULT ?? json.GET_META_INFO?.RESULT ?? json.GET_STATS_DATA?.RESULT;
  if (result !== undefined && Number(result.STATUS) !== 0) {
    throw new Error(`e-Stat エラー(${result.STATUS}): ${result.ERROR_MSG}`);
  }
  return json;
};

const asArray = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

/** 統計表を検索して一覧を出す */
const search = async (keyword, extra = {}) => {
  const json = await call('getStatsList', {
    searchWord: keyword,
    limit: '100',
    ...extra,
  });

  const tables = asArray(json.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF);
  console.log(`\n=== "${keyword}" の検索結果: ${tables.length}件 ===`);

  for (const table of tables) {
    const title =
      typeof table.TITLE === 'object' ? table.TITLE.$ : table.TITLE;
    const name = table.STATISTICS_NAME ?? '';
    const cycle = table.CYCLE ?? '';
    const survey = table.SURVEY_DATE ?? '';
    const updated = table.UPDATED_DATE ?? '';
    const rows = table.OVERALL_TOTAL_NUMBER ?? '';

    console.log(
      `\n  id=${table['@id']}  行数=${rows}  周期=${cycle}  調査年月=${survey}  更新=${updated}` +
      `\n    統計: ${name}` +
      `\n    表名: ${title}`
    );
  }
  return tables;
};

/** 統計表のメタ情報（分類事項）を出す。どの列が使えるか調べるのに使う。 */
const meta = async (statsDataId) => {
  const json = await call('getMetaInfo', { statsDataId });
  const classes = asArray(json.GET_META_INFO?.METADATA_INF?.CLASS_INF?.CLASS_OBJ);

  console.log(`\n=== statsDataId=${statsDataId} のメタ情報 ===`);
  const title = json.GET_META_INFO?.METADATA_INF?.TABLE_INF?.TITLE;
  console.log(`表名: ${typeof title === 'object' ? title.$ : title}`);

  for (const cls of classes) {
    const items = asArray(cls.CLASS);
    console.log(`\n  [${cls['@id']}] ${cls['@name']}  (${items.length}項目)`);
    for (const item of items.slice(0, 12)) {
      console.log(`      ${item['@code']}  ${item['@name']}`);
    }
    if (items.length > 12) console.log(`      ... 他 ${items.length - 12} 項目`);
  }
};

const main = async () => {
  const metaId = arg('--meta');
  if (metaId !== null) {
    await meta(metaId);
    return;
  }

  const keyword = arg('--keyword');
  if (keyword !== null) {
    await search(keyword);
    return;
  }

  // 既定: 現在DBに入っている3系統に対応しそうな統計表を探す
  await search('市区町村別人口', { statsCode: '00200524' }); // 人口推計
  await search('住宅の種類別世帯数');
  await search('利用関係別着工新設住宅');
};

main().catch((error) => {
  // 例外文にクエリ文字列（=appId）が混ざる可能性があるため必ず伏せる
  console.error(String(error?.message ?? error).replace(/appId=[^&\s]+/g, 'appId=***'));
  process.exit(1);
});
