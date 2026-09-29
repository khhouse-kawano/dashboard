# 実績日起算と販促媒体を customerTrend に揃える（v2.2.148）

⚠️ 指示（2026-09-24 / 25・口頭）:

> 分析APIについて
> 実績日起算の場合
> CustomerTrendOrder.tsx
> CustomerTrendKaeru.tsx
> と歩留まりが合わないので再度確認を
> 販促媒体名のリストも上記コンポネントに揃えること

---

## ⚠️ 合わなかった原因（3つ）

⚠️⚠️ **最初の実装は `shopTrend` の数え方だった**（2026-09-24 に作ったもの）。
⚠️ ⚠️ **`customerTrend` は数え方も分母も違った。**

| # | 何が違ったか |
|---|---|
| 1 | ⚠️ **工程の数え方**（丸め方が事業ごとに違う） |
| 2 | ⚠️ **歩留まりの分母**（APIは全部 `leads` だった） |
| 3 | ⚠️ **販促媒体の項目名**（注文が生値のままだった） |

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| `backend-express/src/features/analysis/` | ⚠️ **`actual.ts`** | ⚠️⚠️ **作り直し** |
| 同上 | ⚠️ **`trendMedium.ts`** | ⚠️ `kaeruMedium.ts` から改名し ⚠️ **注文事業に対応** |
| 同上 | `metrics.ts` | ⚠️ **`denominatorFor()`** ＋ 比率2件を追加 |
| 同上 | `query.ts` | 新しい定義に合わせて配線 |
| 同上 | `meta.ts` | ⚠️ 説明文を全面的に更新。⚠️ **「比率の分母」を応答に追加** |

⚠️⚠️ **フロントは1行も触っていない。** ⚠️ **MCP も触っていない。** ⚠️ **DB も変えていない。**

---

## 1. ⚠️ 工程の数え方（⚠️ **事業で違う**）

### ⚠️ 建売（`CustomerTrendKaeru.tsx` の `evaluateKPI`）

⚠️⚠️ **「その工程の最も古い日付。空なら上位工程の最も古い日付」で到達日を1つに決める。**
⚠️ ⚠️ **1人は1つの月にしか立たない。**

```ts
/**
 * 建売の到達日。
 *
 * ⚠️ 画面の `evaluateKPI(b, targetKeys, higherKeys)` をそのまま写したもの。
 *   ⚠️⚠️ **自身の工程が空のときだけ上位へ落ちる。** ⚠️ 両方を OR で見るのではない。
 */
const reachDateKaeru = (phase: AnalysisPhase, withFallback: boolean): string => {
  const own = oldestOfPhases('kaeru', [phase]);
  if (!withFallback) return own;

  const higher = oldestOfPhases('kaeru', higherPhases(phase));
  if (own === 'NULL') return higher;
  if (higher === 'NULL') return own;
  return `COALESCE(${own}, ${higher})`;
};
```

⚠️ 最古の日付は `LEAST` で取る。⚠️⚠️ **NULL があると `LEAST` は NULL を返す**ので埋めて戻す。

```ts
const oldest = (dates: string[]): string => {
  if (dates.length === 0) return 'NULL';
  if (dates.length === 1) return dates[0];
  const filled = dates.map((date) => `COALESCE(${date}, '9999-12-31')`);
  return `NULLIF(LEAST(${filled.join(', ')}), '9999-12-31')`;
};
```

### ⚠️ 注文（`CustomerTrendOrder.tsx` の `getValue`）

⚠️⚠️ **面談日があればその月だけ。無いときだけ下位工程の日付で拾う。**
⚠️ ⚠️ **拾い方が OR なので、1人が複数の月に立つことがある。** ⚠️ **画面がそうなっている。**

```ts
/**
 * 注文の「実来場数」。
 *
 * ⚠️⚠️ **「面談日があれば面談日だけを見る」のが要点。**
 *   ⚠️ ⚠️ **上位の日付と OR にしないこと。** ⚠️ 2月に来場して5月に契約した人が5月にも立つ。
 */
const orderRolled = (phase: AnalysisPhase, inRange: InRange): string | '' => {
  const own = oldestOfPhases('order', [phase]);
  const higher = higherPhases(phase).flatMap((p) => columnsOf('order', p));

  if (own === 'NULL' && higher.length === 0) return '';
  if (own === 'NULL') return higher.map((date) => `(${inRange(date)})`).join(' OR ');
  if (higher.length === 0) return inRange(own);

  const fallback = higher.map((date) => `(${inRange(date)})`).join(' OR ');
  return `CASE WHEN ${own} IS NOT NULL THEN (${inRange(own)}) ELSE (${fallback}) END`;
};

/**
 * 注文の「次アポ数」。
 *
 * ⚠️⚠️ **面談日がある人は「面談した月」に次アポとして数える。**
 *   ⚠️ ⚠️ **「面談した月」であって「次アポを取った月」ではない。** ⚠️ 直感と違うので注意。
 */
const orderNextAppointment = (inRange: InRange): string | '' => {
  const visit = oldestOfPhases('order', ['visit']);
  const later = [
    ...columnsOf('order', 'nextAppointment'),
    ...columnsOf('order', 'preScreening'),
    ...columnsOf('order', 'application'),
    ...columnsOf('order', 'contract'),
  ];

  if (later.length === 0) return '';

  const laterInRange = later.map((date) => `(${inRange(date)})`).join(' OR ');
  const laterExists = later.map((date) => `${date} IS NOT NULL`).join(' OR ');

  if (visit === 'NULL') return laterInRange;

  return (
    `CASE WHEN ${visit} IS NOT NULL` +
    ` THEN ((${inRange(visit)}) AND (${laterExists}))` +
    ` ELSE (${laterInRange}) END`
  );
};
```

### ⚠️ 契約のステータス（⚠️ **事業で違う**）

```ts
/** ⚠️ 画面が「契約」と数えるステータス。⚠️⚠️ **事業で違う** */
const CONTRACT_STATUS: Record<AnalysisDivision, string[]> = {
  // ⚠️ 注文は解約も契約として数える（CustomerTrendOrder.tsx）
  order: ['契約済み', '解約'],
  // ⚠️⚠️ **建売は契約済みのみ**（CustomerTrendKaeru.tsx）
  kaeru: ['契約済み'],
};
```

⚠️⚠️ **以前はステータスを見ていなかったので、画面より多く出ていた。**

---

## 2. ⚠️ 歩留まりの分母

⚠️⚠️ **APIは全部 `leads`（総反響）を分母にしていた。** ⚠️ **画面は違う。**

```ts
const ACTUAL_DENOMINATOR: Record<AnalysisDivision, Partial<Record<RateKey, MetricKey>>> = {
  order: {
    nextAppointmentRatePct: 'visits',
    contractRatePct: 'visits',
  },
  kaeru: {
    visitRatePct: 'contacts',
    applicationRatePct: 'contacts',
    nextAppointmentRatePct: 'visits',
    contractRatePct: 'visits',
  },
};

/** 比率の分母を引く。⚠️ 実績日起算のときだけ画面に合わせる */
export const denominatorFor = (
  key: RateKey,
  division: AnalysisDivision,
  basisIsActual: boolean
): MetricKey => {
  if (!basisIsActual) return 'leads';
  return ACTUAL_DENOMINATOR[division][key] ?? 'leads';
};
```

⚠️ ⚠️ **反響日起算は今までどおり全部 `leads`。** ⚠️ **変えていない**（コホートの意味が変わるため）。

⚠️ 比率を2つ追加した。

| キー | 分子 | 分母（実績日起算） |
|---|---|---|
| ⚠️ **`contactRatePct`** | `contacts` | `leads` |
| ⚠️ **`applicationRatePct`** | `applications` | ⚠️ `contacts` |

⚠️⚠️ **どの指標で割ったかを毎回 meta に返すようにした。**

```ts
  ...(input.rates.length === 0
    ? {}
    : {
        比率の分母: Object.fromEntries(
          input.rates.map((key) => [
            key,
            `${RATES[key].numerator} ÷ ${denominatorFor(key, division, input.actual !== undefined)}`,
          ])
        ),
      }),
```

⚠️ ⚠️ **書かないと Claude が自分で `leads` で割り直して食い違う。**

---

## 3. ⚠️ 販促媒体（⚠️ **4通りすべて項目名が違う**）

| 事業 | 基準日 | 合わせた画面 | 項目 |
|---|---|---|---|
| 注文 | 実績日 | `CustomerTrendOrder.tsx` | ⚠️ `ホームページ反響計` ＋ 媒体マスタ19件 ＋ `その他` |
| 注文 | 反響日 | `CustomerOrder.tsx` | ⚠️⚠️ **まとめ行なし**。媒体マスタ19件 ＋ `その他` |
| 建売 | 実績日 | `CustomerTrendKaeru.tsx` | `ホームページ反響計` ＋ `SUUMO` `HOME'S` `ALLGRIT` `アットホーム` ＋ `その他` |
| 建売 | 反響日 | `CustomerKaeru.tsx` | `ホームページ反響` ＋ `show_graph=1` の媒体 ＋ `その他` |

⚠️ 注文の媒体マスタ:

```sql
SELECT medium FROM medium_list
 WHERE response_medium = 0 AND list_medium = 1 ORDER BY sort_key
```

```ts
/**
 * 注文・実績日起算（⚠️ **CustomerTrendOrder.tsx の表示形式**）。
 *
 * ⚠️⚠️ **キャンペーン名があれば、媒体が何であれホームページ反響計に寄せる。**
 *   ⚠️ 画面は ⚠️ **両方の行に同じ人を数えている**が、
 *     ⚠️ ⚠️ **集計軸は1人1項目**なのでこちらに寄せる。
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
 * ⚠️⚠️ **ホームページ反響計の行は無い。**
 *   ⚠️ ⚠️ **あちらの画面は `hp_campaign` を見ておらず、媒体名の一致だけで数えている。**
 */
const orderCohortSql = (mediums: string[]): string => {
  const whens = mediums.map((name) => `WHEN ${MEDIUM} = ${lit(name)} THEN ${lit(name)}`);
  return `CASE ${whens.join(' ')} ELSE ${lit(OTHER_ROW)} END`;
};
```

⚠️ 建売の `その他（未分類）` は ⚠️ **`その他`** に改名した（⚠️ 画面と同じ名前）。

⚠️⚠️ **注文の媒体名は末尾に改行が混ざっている**（`athome\r\n` など）。
⚠️ ⚠️ **画面は掃除していないので「その他」に落ちている。** ⚠️ **APIは掃除して正しい媒体に入れている。**
⚠️ **そのぶん画面より「その他」が少なく出る。** ⚠️ meta に書いてある。

---

## ⚠️ 確認（2026-09-25・ローカル）

⚠️ 検証用のAPIキーを ⚠️ **一時的に作り、使い終わって削除した**（⚠️ **値は一度も表示していない**）。

⚠️⚠️ **画面と同じ式で組んだSQLと、APIの値を1件ずつ突き合わせた。**

### 注文事業

| 月 | leads | 実来場 | 次アポ | 契約 |
|---|---|---|---|---|
| 2026-04 | 993 | 302 | 155 | 59 |
| 2026-05 | 1,068 | 375 | 207 | 86 |
| 2026-06 | 874 | 283 | 156 | 43 |

### 建売分譲事業

| 月 | leads | 接触 | 来場 | 申込 | 契約 |
|---|---|---|---|---|---|
| 2026-04 | 282 | 192 | 104 | 37 | 30 |
| 2026-05 | 296 | 224 | 126 | 48 | 42 |
| 2026-06 | 311 | 173 | 115 | 25 | 21 |

⚠️⚠️ **全項目で一致した。**

### そのほか

| # | 確認 | 結果 |
|---|---|---|
| 1 | ⚠️ 比率の分母 | ⚠️ **注文 `nextAppointments ÷ visits` / `contracts ÷ visits`** |
| 2 | 同上（建売） | ⚠️ **`visits ÷ contacts` / `applications ÷ contacts` / `contracts ÷ visits`** |
| 3 | ⚠️ 媒体の合計 | ⚠️⚠️ **4通りとも総反響と一致**（注文 5,787 / 建売 1,927） |
| 4 | ⚠️ 「ネット」 | ⚠️ **消えた** |
| 5 | `npx tsc --noEmit` / `npm run build` | ⚠️ **成功** |
| 6 | ⚠️ 検証用APIキー | ⚠️ **削除済み（残り0件）** |

---

## ⚠️⚠️ 残る差（⚠️ **意図的に残した**）

⚠️ ⚠️ **母数の絞り込みだけは画面と違う。**

| | |
|---|---|
| 分析API | ⚠️ `shop_list.report_flag = 1` の店舗に絞る |
| ⚠️ **画面** | ⚠️⚠️ **絞っていない** |

⚠️ 直近12ヶ月で 236件の差（⚠️ **注文事業のみ。建売は0件**）。

| 店舗 | 件数 | |
|---|---|---|
| ⚠️ **JH八代店** | ⚠️ **190** | ⚠️⚠️ **`report_flag = 0` だが実在の店舗**（熊本営業課） |
| グループ管理 | 31 | 管理用 |
| DJH全店舗管理 ほか | 15 | 管理用・未設定 |

⚠️⚠️ **今のまま残すと決めた**（2026-09-25 の利用者の判断）。
⚠️ ⚠️ **理由: 反響日起算や他のエンドポイントと母数が揃い、既存のKPI分析画面とも同じになるため。**
⚠️ **この差は meta に明記して毎回返している。**

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **画面（customerTrend / customer）のKPI定義を変えたら `actual.ts` も直すこと。** ⚠️ 片方だけだと食い違う |
| 2 | ⚠️⚠️ **媒体マスタ（`medium_list` / `medium_kaeru`）を変えると項目が増減する。** ⚠️ 画面も同じ挙動 |
| 3 | ⚠️ 注文の実来場・次アポは ⚠️ **1人が複数月に立つ**（画面がそう）。⚠️ **月をまたいで合計してはならない** |
| 4 | ⚠️ 画面と数件ずれたら ⚠️ **まず `report_flag` の差を疑う**（上の表） |
| 5 | ⚠️⚠️ **MCP の説明文「既定の reaction」が古いまま。** ⚠️ **次に MCP を配布する版で直すこと** |
