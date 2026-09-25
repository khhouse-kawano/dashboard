import { query } from '../../db/pool';
import type { RowDataPacket } from 'mysql2/promise';
import type { AnalysisDivision } from './columns';

/**
 * 販促媒体（`medium` 軸）の項目名。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **画面と同じ項目名にする**（2026-09-24 / 25 の指示）。
 *
 *   事業   基準日        合わせる画面
 *   注文   実績日起算    customerTrend/CustomerTrendOrder.tsx
 *   注文   反響日起算    customer/CustomerOrder.tsx
 *   建売   実績日起算    customerTrend/CustomerTrendKaeru.tsx
 *   建売   反響日起算    customer/CustomerKaeru.tsx
 *
 * ⚠️ ⚠️ **直した理由**
 *   ⚠️ それまでは `sales_promotion_name` の**生値**を返していた。
 *   ⚠️ ⚠️ **建売の `ネット` が 4,892件（反響の59%）あり**、
 *     ⚠️ **Claude が「『ネット』の中身が不明です」と答えて分析にならなかった。**
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **4通りすべてで項目名が違う。** ⚠️ **1つに寄せないこと。**
 */

// ---------------------------------------------------------------------------
// 共通の部品
// ---------------------------------------------------------------------------

/**
 * 文字列リテラル。
 *
 * ⚠️⚠️ **`HOME'S` のようにシングルクォートを含む名前がある。**
 *   ⚠️ ⚠️ **必ずここを通すこと。** ⚠️ 素で埋めると構文エラーか、最悪は注入になる。
 *
 * ⚠️ ここに来る値は許可リスト（この表と媒体マスタ）由来だが、
 *   ⚠️ **マスタは運用側が編集できる**ため、エスケープは必須である。
 */
const lit = (value: string): string => `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "''")}'`;

/** LIKE のパターン。⚠️ `%` と `_` も打ち消す（媒体名に入っていても誤一致させない） */
const likeLit = (value: string): string =>
  lit(`%${value.replace(/[\\%_]/gu, (c) => `\\${c}`)}%`);

/**
 * 末尾の空白と改行を落とす。
 *
 * ⚠️ 画面の `cleanMedium()`（建売）と同じ。
 *
 * ⚠️⚠️ **注文の画面は掃除していない。**
 *   ⚠️ 実データに `athome\r\n` のような値があり、⚠️ **画面ではそれが「その他」に落ちている。**
 *   ⚠️ ⚠️ **APIでは掃除して正しい媒体に入れている。**
 *     ⚠️ **そのぶん画面の「その他」より少なく出る。** ⚠️ meta に書いて渡すこと。
 */
const cleaned = (column: string): string =>
  `TRIM(REPLACE(REPLACE(COALESCE(${column}, ''), '\\r', ''), '\\n', ''))`;

const MEDIUM = cleaned('m.sales_promotion_name');
const CAMPAIGN = cleaned('m.hp_campaign');

/** ⚠️ どれにも当たらなかった顧客の行。⚠️ **画面と同じ名前**（「未分類」は付けない） */
export const OTHER_ROW = 'その他';

interface MediumRow extends RowDataPacket {
  medium: string;
}

// ---------------------------------------------------------------------------
// 注文事業
// ---------------------------------------------------------------------------

/**
 * 画面（CustomerTrendOrder.tsx）の `formate()`。
 *
 * ⚠️⚠️ **`公式LINE` を `ALLGRIT` に読み替えるだけ**である。
 *   ⚠️ ⚠️ **建売の別名表とは別物。** ⚠️ 混ぜないこと。
 */
const ORDER_FORMATTED = `CASE ${MEDIUM} WHEN '公式LINE' THEN 'ALLGRIT' ELSE ${MEDIUM} END`;

const orderFormatted = (name: string): string => (name === '公式LINE' ? 'ALLGRIT' : name);

/** ⚠️ 注文の「ホームページ反響計」。⚠️ **キャンペーン名が入っているかどうかだけ**を見る */
export const HP_ROW_ORDER = 'ホームページ反響計';

/**
 * 注文の媒体マスタ。
 *
 * ⚠️ 画面と同じ条件（`medium_list` の `response_medium = 0` かつ `list_medium = 1`）。
 * ⚠️⚠️ **並びは `sort_key`。** ⚠️ 画面の行の並びと揃える。
 */
export const fetchOrderMediums = async (): Promise<string[]> => {
  const rows = await query<MediumRow>(
    'SELECT medium FROM medium_list WHERE response_medium = 0 AND list_medium = 1 ORDER BY sort_key'
  );

  const names = rows
    .map((row) => (row.medium ?? '').replace(/[\r\n]/gu, '').trim())
    .filter((name) => name !== '');

  return [...new Set(names)];
};

/**
 * 注文・実績日起算（⚠️ **CustomerTrendOrder.tsx の表示形式**）。
 *
 * ⚠️ 項目: ホームページ反響計 / 媒体マスタの各行 / その他
 *
 * ⚠️⚠️ **キャンペーン名があれば、媒体が何であれホームページ反響計に寄せる。**
 *   ⚠️ 画面は ⚠️ **両方の行に同じ人を数えている**が、
 *     ⚠️ ⚠️ **集計軸は1人1項目**なのでこちらに寄せる（2026-09-24 の判断）。
 */
const orderActualSql = (mediums: string[]): string => {
  const whens = [
    `WHEN ${CAMPAIGN} <> '' THEN ${lit(HP_ROW_ORDER)}`,
    ...mediums.map(
      (name) => `WHEN ${ORDER_FORMATTED} = ${lit(orderFormatted(name))} THEN ${lit(name)}`
    ),
  ];
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};

/**
 * 注文・反響日起算（⚠️ **CustomerOrder.tsx の表示形式**）。
 *
 * ⚠️ 項目: 媒体マスタの各行 / その他
 *
 * ⚠️⚠️ **ホームページ反響計の行は無い。**
 *   ⚠️ ⚠️ **あちらの画面は `hp_campaign` を見ておらず、媒体名の一致だけで数えている。**
 *   ⚠️ `公式LINE` の読み替えもしていないため、ここでも素の一致で引く。
 */
const orderCohortSql = (mediums: string[]): string => {
  const whens = mediums.map((name) => `WHEN ${MEDIUM} = ${lit(name)} THEN ${lit(name)}`);
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};

// ---------------------------------------------------------------------------
// 建売分譲事業
// ---------------------------------------------------------------------------

/**
 * 正式名 → その名前として扱う値の一覧。
 *
 * ⚠️⚠️ **frontend/src/components/customer/customerKaeruUtils.ts の
 *   `MEDIUM_ALIAS` をそのまま写したもの。**
 *   ⚠️ ⚠️ **片方だけ直さないこと。** ⚠️ 画面とAPIで件数が食い違う。
 */
export const MEDIUM_ALIAS: Record<string, string[]> = {
  'アットホーム': ['アットホーム', 'athome'],
  'Instagram': ['Instagram', 'SNS広告', 'Facebook'],
  'Web検索': [
    'Web検索', 'WEB検索', 'ネット検索', 'ネット広告',
    'インターネット検索', 'ネット',
  ],
  'カゴスマ・タテルヤ': ['カゴスマ・タテルヤ', 'カゴスマ'],
  '公式LINE': ['公式LINE', 'ALLGRIT'],
  'その他': ['その他', 'テレビCM', '住宅展示場', 'Yahoo!不動産', 'Youtube', 'YouTube'],
};

/**
 * ⚠️⚠️ **無条件でホームページ反響に丸める媒体。**
 *   ⚠️ 画面（両方）の `HOMEPAGE_MEDIUMS` と同じ。
 */
export const HOMEPAGE_MEDIUMS: string[] = ['Web検索', 'Instagram'];

/**
 * ⚠️ ポータル。⚠️ **キャンペーン名にこれが入っていたら「ホームページ反響ではない」。**
 *   ⚠️ 画面の `isHp()` / `isHpCampaign()` と同じ一覧。
 */
const PORTALS: string[] = ['SUUMO', 'ALLGRIT', "HOME'S", 'アットホーム', 'タウンライフ', 'カゴスマ'];

/**
 * ⚠️⚠️ **実績日起算で単独行にする媒体。**
 *   ⚠️ 画面（CustomerTrendKaeru.tsx）の `displayMediums` の直書きと同じ。
 *   ⚠️ ⚠️ **`medium_kaeru.show_graph` は見ない。**
 *     ⚠️ 運用側で設定が変わると項目が黙って増減するため、画面側でも直書きにしてある。
 */
const DISPLAY_MEDIUMS_KAERU: string[] = ['SUUMO', "HOME'S", 'ALLGRIT', 'アットホーム'];

/** ⚠️ まとめ行の名前。⚠️ **画面ごとに違う**（「計」が付くのは実績日起算のほう） */
export const HP_ROW_KAERU_ACTUAL = 'ホームページ反響計';
export const HP_ROW_KAERU_COHORT = 'ホームページ反響';

/**
 * 表記ゆれを正式名へ寄せる式。
 * ⚠️ 画面の `normalizeMedium()` と同じ。⚠️ **表に無いものはそのまま**（寄せない）。
 */
const KAERU_NORMALIZED = (() => {
  const whens = Object.entries(MEDIUM_ALIAS).map(
    ([canonical, aliases]) =>
      `WHEN ${MEDIUM} IN (${aliases.map(lit).join(', ')}) THEN ${lit(canonical)}`
  );
  return `CASE ${whens.join(' ')} ELSE ${MEDIUM} END`;
})();

/**
 * 画面（CustomerTrendKaeru.tsx）の `mediumFormate()`。
 * ⚠️⚠️ **別名表とは別物である。** ⚠️ 実績日起算の単独行の突き合わせだけに使う。
 */
const KAERU_FORMATTED =
  `CASE ${MEDIUM} WHEN '公式LINE' THEN 'ALLGRIT' WHEN 'athome' THEN 'アットホーム' ELSE ${MEDIUM} END`;

/**
 * ⚠️ 「ホームページ反響に入る」条件のうち、⚠️ **単独行に当たらなかった顧客に対する判定**。
 * ⚠️ 画面の `isHp(campaign) || !medium || !campaign` をそのまま写したもの。
 */
const KAERU_HP_REST = (() => {
  const noPortal = PORTALS.map((portal) => `${CAMPAIGN} NOT LIKE ${likeLit(portal)}`).join(' AND ');
  return `((${CAMPAIGN} <> '' AND ${noPortal}) OR ${MEDIUM} = '' OR ${CAMPAIGN} = '')`;
})();

const aliasesOf = (canonical: string): string[] => MEDIUM_ALIAS[canonical] ?? [canonical];

/**
 * その顧客が、単独行として出している媒体に当たるか。
 * ⚠️ 画面の `matchesShownMedium()` と同じ。
 */
const kaeruMatchesShown = (shown: string): string => {
  const inCampaign = aliasesOf(shown)
    .map((alias) => `${CAMPAIGN} LIKE ${likeLit(alias)}`)
    .join(' OR ');
  return `(${KAERU_NORMALIZED} = ${lit(shown)} OR (${CAMPAIGN} <> '' AND (${inCampaign})))`;
};

/** 丸め対象（Web検索 / Instagram）かどうか */
const KAERU_ROLLED_UP = `${KAERU_NORMALIZED} IN (${HOMEPAGE_MEDIUMS.map(lit).join(', ')})`;

/** 建売・実績日起算（⚠️ **CustomerTrendKaeru.tsx の表示形式**） */
const kaeruActualSql = (): string => {
  const whens = [
    // ⚠️⚠️ **丸めを先に見る。** ⚠️ 画面も `isRolledUpMedium` を優先している
    `WHEN ${KAERU_ROLLED_UP} THEN ${lit(HP_ROW_KAERU_ACTUAL)}`,
    ...DISPLAY_MEDIUMS_KAERU.map(
      (display) =>
        `WHEN (${KAERU_FORMATTED} = ${lit(display)} OR ${CAMPAIGN} LIKE ${likeLit(display)})` +
        ` THEN ${lit(display)}`
    ),
    `WHEN ${KAERU_HP_REST} THEN ${lit(HP_ROW_KAERU_ACTUAL)}`,
  ];
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};

/** 建売・反響日起算（⚠️ **CustomerKaeru.tsx の表示形式**） */
const kaeruCohortSql = (shownMediums: string[]): string => {
  const whens = [
    `WHEN ${KAERU_ROLLED_UP} THEN ${lit(HP_ROW_KAERU_COHORT)}`,
    ...shownMediums
      // ⚠️ Web検索 / Instagram は上で丸め済み。単独行には出さない
      .filter((shown) => !HOMEPAGE_MEDIUMS.includes(shown))
      .map((shown) => `WHEN ${kaeruMatchesShown(shown)} THEN ${lit(shown)}`),
    `WHEN ${KAERU_HP_REST} THEN ${lit(HP_ROW_KAERU_COHORT)}`,
  ];
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};

/**
 * 建売で単独行にする媒体を `medium_kaeru` から引く。
 *
 * ⚠️⚠️ **画面（CustomerKaeru.tsx）と同じく `show_graph = 1` で決める。**
 *   ⚠️ ⚠️ **運用側がこの列を変えると項目が増減する。** ⚠️ 画面も同じ挙動である。
 */
export const fetchKaeruShownMediums = async (): Promise<string[]> => {
  const rows = await query<MediumRow>(
    'SELECT medium FROM medium_kaeru WHERE show_graph = 1 ORDER BY no'
  );

  const canonical = new Map<string, string>();
  for (const [name, aliases] of Object.entries(MEDIUM_ALIAS)) {
    for (const alias of aliases) canonical.set(alias, name);
  }

  const names = rows
    .map((row) => (row.medium ?? '').replace(/[\r\n]/gu, '').trim())
    .filter((name) => name !== '')
    .map((name) => canonical.get(name) ?? name);

  return [...new Set(names)];
};

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export interface TrendMedium {
  /** `medium` 軸に差し替えるSQL式 */
  sql: string;
  /** 出てくる項目名（`その他` を除く。meta の説明に使う） */
  items: string[];
}

/**
 * 販促媒体の式を組み立てる。
 *
 * ⚠️⚠️ **事業と基準日の4通りで項目名が違う。**
 * ⚠️ 媒体マスタを読むので非同期である。
 */
export const resolveTrendMedium = async (
  division: AnalysisDivision,
  basisIsActual: boolean
): Promise<TrendMedium> => {
  if (division === 'kaeru') {
    if (basisIsActual) {
      return { sql: kaeruActualSql(), items: [HP_ROW_KAERU_ACTUAL, ...DISPLAY_MEDIUMS_KAERU] };
    }
    const shown = await fetchKaeruShownMediums();
    const items = shown.filter((name) => !HOMEPAGE_MEDIUMS.includes(name));
    return { sql: kaeruCohortSql(shown), items: [HP_ROW_KAERU_COHORT, ...items] };
  }

  const mediums = await fetchOrderMediums();
  if (basisIsActual) {
    return { sql: orderActualSql(mediums), items: [HP_ROW_ORDER, ...mediums] };
  }
  return { sql: orderCohortSql(mediums), items: [...mediums] };
};

/**
 * 応答の meta に添える説明。
 * ⚠️⚠️ **画面と数字が食い違いうる点を必ず伝えること。**
 */
export const trendMediumNote = (
  division: AnalysisDivision,
  basisIsActual: boolean,
  items: string[]
): string => {
  const screen =
    division === 'kaeru'
      ? basisIsActual
        ? '販促媒体別動向（建売）'
        : '顧客分析（建売）'
      : basisIsActual
        ? '販促媒体別動向（注文）'
        : '顧客分析（注文）';

  const common =
    `⚠️ 販促媒体は、ダッシュボードの「${screen}」の画面と同じ項目名にまとめている。` +
    `⚠️ 項目は ${[...items, OTHER_ROW].join(' / ')}。` +
    '⚠️ 表記ゆれ（末尾の空白・改行）は寄せてある。' +
    `⚠️ ${OTHER_ROW}が大きいときは、媒体の記録が追いついていないということ。` +
    '⚠️⚠️ APIの集計軸は1人を1項目にしか数えないため、画面の行の合計とは一致しないことがある' +
    '（画面は同じ人をまとめ行と個別行の両方に数えている箇所がある）。';

  if (division === 'kaeru') {
    return (
      common +
      '⚠️ 建売は別名も寄せている（「ネット」「インターネット検索」「ネット広告」は Web検索、' +
      '「SNS広告」「Facebook」は Instagram、「athome」はアットホーム、「公式LINE」は ALLGRIT）。' +
      `⚠️⚠️ Web検索・Instagram の反響は${basisIsActual ? HP_ROW_KAERU_ACTUAL : HP_ROW_KAERU_COHORT}にまとめている。` +
      '⚠️ 振り分けには反響媒体だけでなくキャンペーン名（hp_campaign）も使っている。'
    );
  }

  return (
    common +
    (basisIsActual
      ? `⚠️⚠️ キャンペーン名（hp_campaign）が入っている顧客は、媒体が何であれ${HP_ROW_ORDER}にまとめている。` +
        '⚠️ 画面もキャンペーン名の有無だけでこの行を作っている。'
      : '⚠️⚠️ この基準日ではキャンペーン名を見ていない（画面がそうなっている）。' +
        `そのため${HP_ROW_ORDER}という項目は出ない。`) +
    '⚠️ 注文では「公式LINE」と「ALLGRIT」を同じ媒体として扱っている。' +
    '⚠️⚠️ 画面は媒体名の末尾の空白・改行を掃除していないため、' +
    `画面ではそれらが「${OTHER_ROW}」に落ちている。` +
    `APIは掃除して正しい媒体に入れているので、画面より「${OTHER_ROW}」が少なく出る。`
  );
};
