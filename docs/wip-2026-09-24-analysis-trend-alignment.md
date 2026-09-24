# 【作業途中】実績日起算を customerTrend に合わせる（v2.2.148）

⚠️⚠️ **2026-09-24 の終業で中断した。** ⚠️ **明日ここから続ける。**

⚠️ 指示（2026-09-24・口頭）:

> 分析APIについて
> 実績日起算の場合
> CustomerTrendOrder.tsx
> CustomerTrendKaeru.tsx
> と歩留まりが合わないので再度確認を
> 販促媒体名のリストも上記コンポネントに揃えること

---

## ⚠️ 合わなかった原因（3つ）

### ⚠️ 1. 工程の数え方

⚠️⚠️ **最初の実装は `shopTrend` の数え方だった**（「その工程から契約までのどれかがその月」）。
⚠️ ⚠️ **`customerTrend` は違った。**

| 事業 | 画面の数え方 |
|---|---|
| ⚠️ **建売** | ⚠️⚠️ **その工程の最古の日付。空なら上位工程の最古の日付**（`evaluateKPI` / `getOldestDate`）。⚠️ **1人は1つの月にしか立たない** |
| ⚠️ **注文** | ⚠️⚠️ **面談日があればその月だけ。無いときだけ下位の日付で拾う**（`getValue`）。⚠️ **拾い方が OR なので複数月に立ちうる** |

⚠️ 注文の「次アポ」は ⚠️⚠️ **面談日がある人を「面談した月」に数える**という独特の定義。

⚠️ 契約のステータス条件も違う。⚠️ **注文＝「契約済み＋解約」／建売＝「契約済み」のみ。**

### ⚠️ 2. 歩留まりの分母

⚠️⚠️ **分析APIは全部 `leads`（総反響）が分母**だったが、画面は違った。

| 事業 | 指標 | ⚠️ 画面の分母 |
|---|---|---|
| 注文 | 実来場 | 総反響 |
| 注文 | ⚠️ **次アポ** | ⚠️⚠️ **実来場** |
| 注文 | ⚠️ **契約** | ⚠️⚠️ **実来場** |
| 建売 | 接触 | 総反響 |
| 建売 | ⚠️ **店舗来場** | ⚠️⚠️ **接触** |
| 建売 | ⚠️ **申込み** | ⚠️⚠️ **接触** |
| 建売 | ⚠️ **契約** | ⚠️⚠️ **店舗来場** |

### ⚠️ 3. 販促媒体名

| 事業 | 画面の項目 |
|---|---|
| ⚠️ **注文** | `ホームページ反響計`（⚠️ `hp_campaign` が非空）＋ ⚠️ **`medium_list`（`response_medium = 0` かつ `list_medium = 1`）** ＋ `その他` |
| 建売 | `ホームページ反響計` ＋ `SUUMO` `HOME'S` `ALLGRIT` `アットホーム` ＋ `その他` |

---

## ⚠️ ここまでやったこと（⚠️ **型は通る。ビルドも通る**）

| ファイル | 状態 |
|---|---|
| ⚠️ **`analysis/actual.ts`** | ⚠️⚠️ **作り直し済み**（画面の定義どおり） |
| ⚠️ **`analysis/metrics.ts`** | ⚠️ **`denominatorFor()` を追加**。⚠️ `contactRatePct` / `applicationRatePct` も追加 |
| ⚠️ **`analysis/query.ts`** | ⚠️ 新しい `actual.ts` / 分母に対応済み |
| ⚠️ **`analysis/trendMedium.ts`** | ⚠️⚠️ **`kaeruMedium.ts` から改名しただけ。中身は建売のまま** |

### ⚠️ `actual.ts` の要点（作り直した部分）

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
const orderNextAppointment = (inRange: InRange): string | '' => { /* 実装済み */ };
```

⚠️ 契約のステータス条件:

```ts
/** ⚠️ 画面が「契約」と数えるステータス。⚠️⚠️ **事業で違う** */
const CONTRACT_STATUS: Record<AnalysisDivision, string[]> = {
  order: ['契約済み', '解約'],
  kaeru: ['契約済み'],
};
```

### ⚠️ `metrics.ts` の要点

```ts
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

⚠️⚠️ **反響日起算は今までどおり全部 `leads`。** ⚠️ **変えないこと。**

---

## ⚠️⚠️ 明日やること

| # | やること |
|---|---|
| 1 | ⚠️⚠️ **`trendMedium.ts` を注文事業にも対応させる**（⚠️ **いちばん大きい残り**） |
| 2 | ⚠️ 建売の `その他（未分類）` → ⚠️ **`その他`** に改名（⚠️ 画面に合わせる） |
| 3 | ⚠️ `query.ts` の `resolveMediumSql()` を注文にも通す（⚠️ **今は `division !== 'kaeru'` で null を返している**） |
| 4 | ⚠️ `meta.ts` の説明文を新しい数え方・分母に合わせて書き直す |
| 5 | ⚠️⚠️ **ローカルで画面の数字と突き合わせる**（⚠️ **いちばん大事**） |
| 6 | ⚠️ docs（task-2026-09-24-06）とデプロイ手順の更新 |

### ⚠️ 1 の下ごしらえ（調査済み）

注文の媒体マスタ:

```sql
SELECT medium, category FROM medium_list
 WHERE response_medium = 0 AND list_medium = 1 ORDER BY sort_key;
```

⚠️ 実データ（19件・2026-09-24）:
公式アンバサダー / チラシ / HOME'S / タウンライフ / SUUMO / カゴスマ / 公式LINE /
メタ住宅展示場 / 持ち家計画 / athome / ハウジングバザール / イエタッタ / SNS広告 /
インターネット検索 / イベント / フリーペーパー / ハガキ/DM / 紹介 / 土地新着ネット

⚠️ 画面の突き合わせ（`CustomerTrendOrder.tsx`）:

```ts
const formate = (medium: string) => {
    return medium === '公式LINE' ? 'ALLGRIT' : medium;   // ⚠️ 建売の formate とは別物
};

// 行の振り分け
if (mediumIndex === 0) return true;                 // 全販促媒体
if (mediumIndex === 1) return o.hp_campaign;        // ⚠️ ホームページ反響計（非空かどうかだけ）
if (medium === 'その他') {
    return (!o.medium || !mediumArray.some(m => formate(m) === formate(o.medium)));
}
return formate(o.medium) === formate(medium);
```

⚠️ 集計軸は1人1項目なので、⚠️ **`hp_campaign` が非空なら「ホームページ反響計」に寄せる**（建売と同じ方針。⚠️ **画面は二重に数えている**）。

---

## ⚠️ 判断が要る点（⚠️ **明日確認すること**）

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **注文の媒体は生値に `\r\n` が混ざっている**（`athome\r\n` など）。⚠️ **画面は掃除しないので「その他」に落ちる。** ⚠️ APIで掃除すると数字がわずかに変わる。⚠️ **掃除する方針でよいか** |
| 2 | ⚠️⚠️ **分析APIは `shop_list`（`report_flag = 1`）で母数を絞っているが、画面は絞っていない。** ⚠️ ⚠️ **これだけで件数が食い違う。** ⚠️ **突き合わせのときに必ず確認すること** |
| 3 | ⚠️ 注文の実来場・次アポは ⚠️ **1人が複数月に立つ**（画面がそう）。⚠️ **合計すると実人数を超える** |

---

## ⚠️ いまの状態

| | |
|---|---|
| 型検査 | ⚠️ **通る**（`npx tsc --noEmit`） |
| ⚠️ 動作 | ⚠️⚠️ **未検証。** ⚠️ **数字は合っていない前提で見ること** |
| ブランチ | `v2.2.148` |
| ⚠️ デプロイ | ⚠️⚠️ **この状態で ② に上げないこと** |
