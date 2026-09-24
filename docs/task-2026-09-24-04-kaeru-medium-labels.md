# 分析APIの建売の販促媒体を、画面と同じ項目名にする（v2.2.147）

⚠️ 指示（2026-09-24・口頭）:

> なお建売事業の場合の販促媒体の項目名は
> 実績日起算=>CustomerTrendKaeru.tsxの表示形式
> 反響日起算=>CustomerKaeru.tsxの表示形式
> と合わせること
> v2.2.147で分析APIの修正を

⚠️ きっかけ: ⚠️⚠️ **Claude Desktop が「『ネット』の中身が不明です」と答えて分析にならなかった。**

> SUUMO・アットホーム・HOME'S・Web検索・Instagram が別建てで存在するなかで、「ネット」612〜777件規模の区分が各係に存在します。
> この区分が何を指すのか（自社サイト、ポータル横断、入力の既定値など）が判別できません。
> 総反響の59%を占めるため、ここの解像度が上がらない限り媒体別の投資判断は精度を持ちません。

---

## ⚠️ 原因

⚠️⚠️ **分析APIが `master_data_kaeru.sales_promotion_name` の生値をそのまま返していた。**

⚠️ 画面では ⚠️ **`ネット` を `Web検索` に寄せ、さらに `ホームページ反響` に丸めている。**
⚠️ ⚠️ **APIだけが寄せていなかった。**

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| `backend-express/src/features/analysis/` | ⚠️ **`kaeruMedium.ts`** | ⚠️ **新規** |
| 同上 | `query.ts` | ⚠️ **`dimensionSql()` / `resolveMediumSql()` / `mediumNoteFor()` を追加** |
| 同上 | `meta.ts` | ⚠️ 「販促媒体の項目名」を応答に追加 |
| 同上 | `index.ts` | ⚠️ `mediumNote` を meta へ通す |

⚠️⚠️ **フロントは触っていない。** ⚠️ **MCP も触っていない。** ⚠️ **注文事業の媒体は今までどおり生値。**

---

## ⚠️ 合わせた項目名

### 実績日起算（⚠️ `CustomerTrendKaeru.tsx`）

⚠️ `ホームページ反響計` / `SUUMO` / `HOME'S` / `ALLGRIT` / `アットホーム` / `その他（未分類）`

⚠️⚠️ **単独行の4つは画面と同じくコードに直書き。** ⚠️ ⚠️ **`medium_kaeru.show_graph` は見ない。**
⚠️ 画面側も直書きに戻してある（⚠️ **運用側の設定で項目が黙って増減するのを避けるため**）。

### 反響日起算（⚠️ `CustomerKaeru.tsx`）

⚠️ `SUUMO` / `HOME'S` / `アットホーム` / `公式LINE` / `ホームページ反響` / `その他（未分類）`

⚠️⚠️ **こちらは `medium_kaeru.show_graph = 1` から作る**（画面と同じ）。
⚠️ ⚠️ **同じ媒体でも名前が違う。** ⚠️ 実績日起算は `ALLGRIT`、反響日起算は `公式LINE` である（⚠️ **画面がそうなっている**）。

---

## ⚠️⚠️ 画面と食い違うところ（意図的）

⚠️ 画面は ⚠️ **同じ顧客を2つの行に数えている。**
⚠️ ⚠️ **`Web検索` / `Instagram` は自分の行にも出るし、`ホームページ反響` にも丸められる**
（2026-09-22 に「総反響と一致しなくてもよい」と決めた箇所）。

⚠️⚠️ **分析APIの `medium` は集計軸なので、1人は1項目にしか入れられない。**
⚠️ ⚠️ **`Web検索` / `Instagram` はホームページ反響にだけ入れた**（2026-09-24 の利用者の判断）。

| | 画面 | ⚠️ **分析API** |
|---|---|---|
| `Web検索` の行 | ⚠️ 出る | ⚠️⚠️ **出ない**（ホームページ反響に入る） |
| 媒体の合計 | ⚠️ 総反響より多い | ⚠️⚠️ **総反響と一致する** |

⚠️ ⚠️ **この違いは毎回の meta（「販促媒体の項目名」）に書いて渡している。**

---

## 1. 追加したファイル

### `backend-express/src/features/analysis/kaeruMedium.ts`（新規・主要部）

```ts
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

export const HOMEPAGE_MEDIUMS: string[] = ['Web検索', 'Instagram'];

const PORTALS: string[] = ['SUUMO', 'ALLGRIT', "HOME'S", 'アットホーム', 'タウンライフ', 'カゴスマ'];

const DISPLAY_MEDIUMS_ACTUAL: string[] = ['SUUMO', "HOME'S", 'ALLGRIT', 'アットホーム'];

export const HP_ROW_ACTUAL = 'ホームページ反響計';
export const HP_ROW_COHORT = 'ホームページ反響';
export const OTHER_ROW = 'その他（未分類）';

/**
 * 文字列リテラル。
 *
 * ⚠️⚠️ **`HOME'S` のようにシングルクォートを含む名前がある。**
 *   ⚠️ ⚠️ **必ずここを通すこと。** ⚠️ 素で埋めると構文エラーか、最悪は注入になる。
 */
const lit = (value: string): string => `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "''")}'`;

/** LIKE のパターン。⚠️ `%` と `_` も打ち消す */
const likeLit = (value: string): string =>
  lit(`%${value.replace(/[\\%_]/gu, (c) => `\\${c}`)}%`);

/** 末尾の空白と改行を落とす。⚠️ 画面の `cleanMedium()` と同じ */
const cleaned = (column: string): string =>
  `TRIM(REPLACE(REPLACE(COALESCE(${column}, ''), '\\r', ''), '\\n', ''))`;

const MEDIUM = cleaned('m.sales_promotion_name');
const CAMPAIGN = cleaned('m.hp_campaign');

/** 表記ゆれを正式名へ寄せる式。⚠️ 画面の `normalizeMedium()` と同じ */
const NORMALIZED = (() => {
  const whens = Object.entries(MEDIUM_ALIAS).map(
    ([canonical, aliases]) =>
      `WHEN ${MEDIUM} IN (${aliases.map(lit).join(', ')}) THEN ${lit(canonical)}`
  );
  return `CASE ${whens.join(' ')} ELSE ${MEDIUM} END`;
})();

/**
 * 画面の `mediumFormate()`。
 * ⚠️⚠️ **別名表とは別物である。**
 *   ⚠️ DB の実データは `公式LINE` / `athome` だが、項目名は `ALLGRIT` / `アットホーム` で出す。
 */
const FORMATTED = `CASE ${MEDIUM} WHEN '公式LINE' THEN 'ALLGRIT' WHEN 'athome' THEN 'アットホーム' ELSE ${MEDIUM} END`;

/** ⚠️ 画面の `isHp(campaign) || !medium || !campaign` をそのまま写したもの */
const HP_GROUP_REST = (() => {
  const noPortal = PORTALS.map((portal) => `${CAMPAIGN} NOT LIKE ${likeLit(portal)}`).join(' AND ');
  return `((${CAMPAIGN} <> '' AND ${noPortal}) OR ${MEDIUM} = '' OR ${CAMPAIGN} = '')`;
})();

const aliasesOf = (canonical: string): string[] => MEDIUM_ALIAS[canonical] ?? [canonical];

/** ⚠️ 画面の `matchesShownMedium()` と同じ */
const matchesShown = (shown: string): string => {
  const inCampaign = aliasesOf(shown)
    .map((alias) => `${CAMPAIGN} LIKE ${likeLit(alias)}`)
    .join(' OR ');
  return `(${NORMALIZED} = ${lit(shown)} OR (${CAMPAIGN} <> '' AND (${inCampaign})))`;
};

const IS_ROLLED_UP = `${NORMALIZED} IN (${HOMEPAGE_MEDIUMS.map(lit).join(', ')})`;

/** 実績日起算の販促媒体（⚠️ **CustomerTrendKaeru.tsx の表示形式**） */
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

/** 反響日起算の販促媒体（⚠️ **CustomerKaeru.tsx の表示形式**） */
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

/**
 * 単独行にする媒体を `medium_kaeru` から引く。
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
```

⚠️ ⚠️ **`kaeruMediumNote()`（meta に添える説明）も同じファイルにある。**

---

## 2. 追加した関数（`query.ts`）

```ts
/**
 * 軸のSQL式を引く。
 *
 * ⚠️⚠️ **建売の販促媒体だけは表から引けない**（2026-09-24 追加）。
 *   ⚠️ 画面と同じ項目名にまとめる必要があり、
 *     ⚠️ ⚠️ **反響日起算では `medium_kaeru` を読んでから式を組み立てる**ため。
 *
 * ⚠️ ⚠️ **軸・絞り込み・中央値の3箇所すべてでこれを使うこと。**
 *   ⚠️ 1箇所でも `dimension().sql()` を直に呼ぶと、そこだけ生値になって食い違う。
 */
const dimensionSql = (
  key: DimensionKey,
  basisSql: string,
  mediumSql: string | null
): string => (key === 'medium' && mediumSql !== null ? mediumSql : dimension(key).sql(basisSql));

/** 建売の販促媒体の式を用意する。⚠️ 注文事業では `null`（今までどおり生値） */
const resolveMediumSql = async (
  division: AnalysisDivision,
  basis: Basis
): Promise<string | null> => {
  if (division !== 'kaeru') return null;
  if (basis === 'actual') return kaeruMediumSqlActual();
  return kaeruMediumSqlCohort(await fetchShownMediums());
};

/**
 * 建売で販促媒体を使ったときだけ、項目名の説明を添える。
 * ⚠️⚠️ **書かないと、画面の「Web検索」行と件数が合わない理由が伝わらない。**
 */
const mediumNoteFor = async (
  division: AnalysisDivision,
  options: PivotOptions,
  basisIsActual: boolean
): Promise<string | undefined> => {
  if (division !== 'kaeru') return undefined;

  const used =
    options.groupBy.includes('medium') || options.filters.medium !== undefined;
  if (!used) return undefined;

  const shown = basisIsActual ? [] : await fetchShownMediums();
  return kaeruMediumNote(basisIsActual, shown);
};
```

⚠️ `buildWhere()` / `attachMedians()` / `attachMediansActual()` は ⚠️ **`mediumSql` を受け取る形に引数を足した**（中身の判断は変えていない）。

---

## ⚠️ 確認（2026-09-24・ローカル）

⚠️ 検証用のAPIキーを ⚠️ **一時的に作り、使い終わって削除した**（⚠️ **値は一度も表示していない**）。

期間 2025-04 〜 2026-09。

| # | 確認 | 結果 |
|---|---|---|
| 1 | ⚠️⚠️ **「ネット」の項目** | ⚠️⚠️ **消えた**（⚠️ ホームページ反響に丸まった） |
| 2 | ⚠️ 実績日起算の項目 | ⚠️ `ホームページ反響計 3,982` / `SUUMO 524` / `ALLGRIT 297` / `アットホーム 129` / `HOME'S 76` / `その他（未分類）41` |
| 3 | ⚠️ 反響日起算の項目 | ⚠️ `ホームページ反響 3,982` / `SUUMO 524` / `公式LINE 297` / `アットホーム 129` / `HOME'S 76` / `その他（未分類）41` |
| 4 | ⚠️⚠️ **取りこぼしの確認** | ⚠️⚠️ **媒体の合計 5,049 が店舗の合計 5,049 と一致** |
| 5 | ⚠️ 媒体で絞り込み | ⚠️ `medium=ホームページ反響計` が通る（2026-05 は 249件） |
| 6 | ⚠️ 注文事業 | ⚠️ **今までどおり生値**（触っていない） |
| 7 | ⚠️ 検証用APIキー | ⚠️ **削除済み（残り0件）** |

⚠️ ⚠️ **`その他（未分類）` が 41件しかない**ので、⚠️ **取りこぼしはほぼ無い。**

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`customerKaeruUtils.ts` の `MEDIUM_ALIAS` を直したら `kaeruMedium.ts` も直すこと。** ⚠️ 片方だけだと画面とAPIで件数が食い違う |
| 2 | ⚠️⚠️ **`CustomerTrendKaeru.tsx` の `displayMediums`（直書きの4つ）を変えたら `DISPLAY_MEDIUMS_ACTUAL` も変えること** |
| 3 | ⚠️ 反響日起算の項目は ⚠️ **`medium_kaeru.show_graph` 次第で増減する**（⚠️ 画面も同じ） |
| 4 | ⚠️⚠️ **注文事業の媒体は生値のまま**で、⚠️ `athome` と `athome\r\n` のように**表記ゆれで項目が割れている**。⚠️ **同じ手当てが要るなら別の指示で** |
| 5 | ⚠️ 軸・絞り込み・中央値の ⚠️ **3箇所すべてが `dimensionSql()` を通ること。** ⚠️ 1箇所でも直呼びすると、そこだけ生値になる |
