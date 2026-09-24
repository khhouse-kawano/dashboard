import { query } from '../../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 建売分譲事業の販促媒体（`medium` 軸）の項目名。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **画面と同じ項目名にする**（2026-09-24 の指示）。
 *
 *   実績日起算 … customerTrend/CustomerTrendKaeru.tsx の表示形式
 *   反響日起算 … customer/CustomerKaeru.tsx の表示形式
 *
 * ⚠️ ⚠️ **直した理由**
 *   ⚠️ それまでは `master_data_kaeru.sales_promotion_name` の**生値**を返していた。
 *   ⚠️ ⚠️ **実データの `ネット` が 4,892件（建売の反響の59%）あり**、
 *     ⚠️ **Claude が「『ネット』の中身が不明です」と答えて分析にならなかった。**
 *   ⚠️ 画面では `ネット` は `Web検索` に寄せている。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **振り分けには `hp_campaign` 列も要る。**
 *   ⚠️ 反響媒体だけでは足りない。⚠️ **ポータル経由かどうかがキャンペーン名にしか出ない。**
 */

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
const DISPLAY_MEDIUMS_ACTUAL: string[] = ['SUUMO', "HOME'S", 'ALLGRIT', 'アットホーム'];

/** ⚠️ まとめ行の名前。⚠️ **画面ごとに違う**（「計」が付くのは実績日起算のほう） */
export const HP_ROW_ACTUAL = 'ホームページ反響計';
export const HP_ROW_COHORT = 'ホームページ反響';

/** ⚠️ どれにも当たらなかった顧客の行。⚠️ **0件でも意味がある**ので必ず項目に残す */
export const OTHER_ROW = 'その他（未分類）';

// ---------------------------------------------------------------------------
// SQL の組み立て
// ---------------------------------------------------------------------------

/**
 * 文字列リテラル。
 *
 * ⚠️⚠️ **`HOME'S` のようにシングルクォートを含む名前がある。**
 *   ⚠️ ⚠️ **必ずここを通すこと。** ⚠️ 素で埋めると構文エラーか、最悪は注入になる。
 *
 * ⚠️ ここに来る値は許可リスト（この表と `medium_kaeru`）由来だが、
 *   ⚠️ **`medium_kaeru` は運用側が編集できる**ため、エスケープは必須である。
 */
const lit = (value: string): string => `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "''")}'`;

/** LIKE のパターン。⚠️ `%` と `_` も打ち消す（媒体名に入っていても誤一致させない） */
const likeLit = (value: string): string =>
  lit(`%${value.replace(/[\\%_]/gu, (c) => `\\${c}`)}%`);

/**
 * 末尾の空白と改行を落とす。
 * ⚠️ 画面の `cleanMedium()` と同じ。⚠️ **掃除しないと静かに落ちる**（件数がわずかに減る）。
 */
const cleaned = (column: string): string =>
  `TRIM(REPLACE(REPLACE(COALESCE(${column}, ''), '\\r', ''), '\\n', ''))`;

const MEDIUM = cleaned('m.sales_promotion_name');
const CAMPAIGN = cleaned('m.hp_campaign');

/**
 * 表記ゆれを正式名へ寄せる式。
 * ⚠️ 画面の `normalizeMedium()` と同じ。⚠️ **表に無いものはそのまま**（寄せない）。
 */
const NORMALIZED = (() => {
  const whens = Object.entries(MEDIUM_ALIAS).map(
    ([canonical, aliases]) =>
      `WHEN ${MEDIUM} IN (${aliases.map(lit).join(', ')}) THEN ${lit(canonical)}`
  );
  return `CASE ${whens.join(' ')} ELSE ${MEDIUM} END`;
})();

/**
 * 画面の `mediumFormate()`。
 * ⚠️⚠️ **別名表とは別物である。** ⚠️ 実績日起算の単独行の突き合わせだけに使う。
 *   ⚠️ DB の実データは `公式LINE` / `athome` だが、
 *     ⚠️ **項目名は `ALLGRIT` / `アットホーム`** で出す（画面がそうなっている）。
 */
const FORMATTED = `CASE ${MEDIUM} WHEN '公式LINE' THEN 'ALLGRIT' WHEN 'athome' THEN 'アットホーム' ELSE ${MEDIUM} END`;

/**
 * ⚠️ 「ホームページ反響に入る」条件のうち、⚠️ **単独行に当たらなかった顧客に対する判定**。
 *
 * ⚠️ 画面の `isHp(campaign) || !medium || !campaign` をそのまま写したもの。
 *   ⚠️ ⚠️ **キャンペーン名が空の顧客も入る。** ⚠️ 反響媒体が空の顧客も入る。
 */
const HP_GROUP_REST = (() => {
  const noPortal = PORTALS.map((portal) => `${CAMPAIGN} NOT LIKE ${likeLit(portal)}`).join(' AND ');
  return `((${CAMPAIGN} <> '' AND ${noPortal}) OR ${MEDIUM} = '' OR ${CAMPAIGN} = '')`;
})();

/** 正式名として扱う値の一覧（別名表に無ければ自分自身だけ） */
const aliasesOf = (canonical: string): string[] => MEDIUM_ALIAS[canonical] ?? [canonical];

/**
 * その顧客が、単独行として出している媒体に当たるか。
 * ⚠️ 画面の `matchesShownMedium()` と同じ（反響媒体の一致、またはキャンペーン名に別名を含む）。
 */
const matchesShown = (shown: string): string => {
  const inCampaign = aliasesOf(shown)
    .map((alias) => `${CAMPAIGN} LIKE ${likeLit(alias)}`)
    .join(' OR ');
  return `(${NORMALIZED} = ${lit(shown)} OR (${CAMPAIGN} <> '' AND (${inCampaign})))`;
};

/** 丸め対象（Web検索 / Instagram）かどうか */
const IS_ROLLED_UP = `${NORMALIZED} IN (${HOMEPAGE_MEDIUMS.map(lit).join(', ')})`;

/**
 * 実績日起算の販促媒体（⚠️ **CustomerTrendKaeru.tsx の表示形式**）。
 *
 * ⚠️ 項目: ホームページ反響計 / SUUMO / HOME'S / ALLGRIT / アットホーム / その他（未分類）
 */
export const kaeruMediumSqlActual = (): string => {
  const whens = [
    // ⚠️⚠️ **丸めを先に見る。** ⚠️ 画面も `isRolledUpMedium` を優先している
    `WHEN ${IS_ROLLED_UP} THEN ${lit(HP_ROW_ACTUAL)}`,
    ...DISPLAY_MEDIUMS_ACTUAL.map(
      (display) =>
        `WHEN (${FORMATTED} = ${lit(display)} OR ${CAMPAIGN} LIKE ${likeLit(display)})` +
        ` THEN ${lit(display)}`
    ),
    `WHEN ${HP_GROUP_REST} THEN ${lit(HP_ROW_ACTUAL)}`,
  ];
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};

/**
 * 反響日起算の販促媒体（⚠️ **CustomerKaeru.tsx の表示形式**）。
 *
 * ⚠️ 項目: `medium_kaeru.show_graph = 1` の媒体 / ホームページ反響 / その他（未分類）
 *
 * @param shownMediums ⚠️ `fetchShownMediums()` が返す正式名の一覧
 */
export const kaeruMediumSqlCohort = (shownMediums: string[]): string => {
  const whens = [
    `WHEN ${IS_ROLLED_UP} THEN ${lit(HP_ROW_COHORT)}`,
    ...shownMediums
      // ⚠️ Web検索 / Instagram は上で丸め済み。単独行には出さない
      .filter((shown) => !HOMEPAGE_MEDIUMS.includes(shown))
      .map((shown) => `WHEN ${matchesShown(shown)} THEN ${lit(shown)}`),
    `WHEN ${HP_GROUP_REST} THEN ${lit(HP_ROW_COHORT)}`,
  ];
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};

interface MediumRow extends RowDataPacket {
  medium: string;
}

/**
 * 単独行にする媒体を `medium_kaeru` から引く。
 *
 * ⚠️⚠️ **画面（CustomerKaeru.tsx）と同じく `show_graph = 1` で決める。**
 *   ⚠️ ⚠️ **運用側がこの列を変えると項目が増減する。** ⚠️ 画面も同じ挙動である。
 * ⚠️ 表記を寄せたうえで重複を落とす（`Facebook` と `Instagram` は同じ名前になる）。
 */
export const fetchShownMediums = async (): Promise<string[]> => {
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

/**
 * 応答の meta に添える説明。
 * ⚠️⚠️ **画面と数字が食い違いうる点を必ず伝えること。**
 */
export const kaeruMediumNote = (basisIsActual: boolean, shownMediums: string[]): string =>
  '⚠️ 建売分譲事業の販促媒体は、ダッシュボードの画面と同じ項目名にまとめている' +
  `（${basisIsActual ? '実績日起算は「販促媒体別動向」' : '反響日起算は「顧客分析」'}の画面）。` +
  `⚠️ 項目は ${(basisIsActual ? [HP_ROW_ACTUAL, ...DISPLAY_MEDIUMS_ACTUAL] : [HP_ROW_COHORT, ...shownMediums.filter((s) => !HOMEPAGE_MEDIUMS.includes(s))]).join(' / ')} / ${OTHER_ROW}。` +
  '⚠️ 表記ゆれは寄せてある（「ネット」「インターネット検索」「ネット広告」は Web検索、' +
  '「SNS広告」「Facebook」は Instagram、「athome」はアットホーム、「公式LINE」は ALLGRIT）。' +
  `⚠️⚠️ Web検索・Instagram の反響は${basisIsActual ? HP_ROW_ACTUAL : HP_ROW_COHORT}にまとめている。` +
  '⚠️ 画面ではこの2つが単独行にも重ねて出ているため、' +
  `画面の「Web検索」「Instagram」の行の件数とは一致しない（APIは1人を1項目にしか数えない）。` +
  '⚠️ 振り分けには反響媒体だけでなくキャンペーン名（hp_campaign）も使っている。' +
  `⚠️ ${OTHER_ROW}が大きいときは、媒体の記録が追いついていないということ。`;
