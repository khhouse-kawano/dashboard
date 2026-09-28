# 契約ランキングの達成率を独立した列にする（v2.2.148）

⚠️ 指示（2026-09-24・口頭）:

> `company/Ranking.tsx` の改修
> * 期間設定時、期間未設定時に達成率を別列にする
> * 達成率でもソートできるようにする
> * `targetCategory === staff` の場合の sub の表示ロジックはオーナー修正のままでよいがレビューして必要であれば修正を
> またモーダルサイズを lg から md にしたほうがよい

---

## ⚠️ 何が問題だったか

⚠️ 達成率は ⚠️ **総計・期間計のセルに括弧書きで同居**していた。

| 状態 | 改修前 |
|---|---|
| 期間未指定 | ⚠️ `総計(達成率)` … ⚠️ **1つのセルに2つの数字** |
| 期間指定あり | ⚠️ 期間計の隣に ⚠️ **見出しが `(達成率)` だけの列** |

⚠️⚠️ **同居していると並べ替えの対象にできない。**
⚠️ ⚠️ **さらに達成率の列をクリックしても、期間計でソートされていた**（`handleSort('period')` が付いていた）。

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 変更 |
|---|---|---|
| `frontend/src/components/company/` | ⚠️ **`Ranking.tsx`** | ⚠️ **達成率の独立列・ソート・`sub` の整理** |
| `frontend/src/utils/` | `version.ts` | `2.2.148`（⚠️ オーナーが変更済み） |
| `backend/scripts/sql/` | ⚠️ **`2026-09-24_update_log_2.2.148.sql`** | ⚠️ **新規** |

⚠️⚠️ **バックエンドは触っていない。** ⚠️ **DB のテーブル定義も変えていない。**

---

## 1. 列の構成

⚠️⚠️ **達成率は常に独立した列にした。**

| | 個人別 | 店舗別 |
|---|---|---|
| 期間未指定 | 順位 / 氏名 / 所属 / 総計 | 順位 / 店舗 / 課 / 予算 / 総計 / ⚠️ **達成率** |
| 期間指定あり | 順位 / 氏名 / 所属 / 期間計 / 総計 | 順位 / 店舗 / 課 / 予算 / 期間計 / 総計 / ⚠️ **達成率** |

⚠️ ⚠️ **達成率の列は店舗別のときだけ出す。** ⚠️ **個人別に予算が無いため。**

⚠️⚠️ **見出しに割り算の中身を出すようにした。**

```tsx
{mode === 'shop' && (
    <th
        className="py-2 text-success"
        style={{ width: '90px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSort('rate')}
    >
        達成率{getSortIcon('rate')}
        <div className="fw-normal text-muted" style={{ fontSize: '10px' }}>
            {showPeriodCol ? '期間計÷予算' : '総計÷予算'}
        </div>
    </th>
)}
```

⚠️ ⚠️ **分母（予算）は期間指定に合わせて集計されている**ので、⚠️ **分子も揃える必要がある。**
⚠️ **揃えないと「総計の実績 ÷ 期間の予算」になり、意味の無い数字が出る。**

---

## 2. 達成率を行に持たせた（⚠️ ソートのため）

```ts
type RankedRow = {
    label: string;
    sub: string;
    totalCount: number;
    periodCount: number;
    /** 予算。店舗別のときだけ使う。個人別では常に0 */
    budget: number;
    /**
     * 達成率（%）。⚠️ **店舗別のときだけ使う。個人別では常に0。**
     *
     * ⚠️⚠️ **分子は期間指定の有無で変わる**（指定あり＝期間計 / 指定なし＝総計）。
     *   ⚠️ ⚠️ **予算（budget）も同じ期間で集計してある。** ⚠️ 揃えないと比較の意味が無くなる。
     * ⚠️ ソートに使うため、表示のたびに計算せず行に持たせる。
     */
    rate: number;
    rank: number;
};

/**
 * 並べ替えの対象。
 * ⚠️ `rate` は ⚠️ **店舗別のときだけ意味がある**（個人別に予算が無い）。
 */
type SortKey = 'total' | 'period' | 'rate';
```

集計側:

```ts
            return {
                label: key,
                sub,
                totalCount: target.length,
                periodCount: periodTarget.length,
                budget,
                /**
                 * ⚠️⚠️ **分子は予算と同じ期間のものを使う。**
                 *   ⚠️ 期間指定があれば期間計、無ければ総計。
                 *   ⚠️ ⚠️ **揃えないと「総計の実績 ÷ 期間の予算」になり、意味の無い数字が出る。**
                 * ⚠️ 個人別は予算が無いので常に0（列も出さない）。
                 */
                rate: mode === 'shop'
                    ? achievementRate(showPeriodCol ? periodTarget.length : target.length, budget)
                    : 0
            };
```

⚠️ `achievementRate()` と `showPeriodCol` は ⚠️ **`useEffect` より前へ移した**（中で使うため）。

---

## 3. 並べ替え・順位・足切りを1つの関数に寄せた

⚠️⚠️ **改修前は3箇所に `sortConfig.key === 'total' ? … : …` が散っていた。**
⚠️ ⚠️ **達成率を足すと3箇所を直す必要があり、1つ直し忘れれば並びと順位が食い違う。**

```ts
        /**
         * 並べ替えと順位付けに使う値。
         *
         * ⚠️⚠️ **ソート・順位・足切りの3箇所で必ず同じものを使うこと。**
         *   ⚠️ ⚠️ **1箇所でも食い違うと、並びと順位が合わない表になる。**
         *
         * ⚠️ 達成率は店舗別にしか無いため、個人別では総計に読み替える
         *   （⚠️ **店舗別で達成率ソートにしたまま個人別へ切り替えたとき**に効く）。
         */
        const valueOf = (item: { totalCount: number, periodCount: number, rate: number }): number => {
            if (sortConfig.key === 'period') return item.periodCount;
            if (sortConfig.key === 'rate') return mode === 'shop' ? item.rate : item.totalCount;
            return item.totalCount;
        };
```

⚠️ ソート・順位付け・足切りのすべてが `valueOf()` を通る。

⚠️⚠️ **達成率ソートのまま個人別へ切り替えても落ちない**ようにしてある（総計に読み替える）。
⚠️ ⚠️ **これが無いと、全員 `rate = 0` になって順位が全部1位になる。**

---

## 4. ⚠️ `sub`（個人別の所属）のレビュー結果

⚠️ オーナー改修の原文:

```ts
const targetShops = inCategory.filter(c => c.staff === key && monthArray.includes(formate(c.contract)))?.map(c => c.shop);
const isContracted = inCategory.filter(c => c.staff === key && monthArray.includes(formate(c.contract))).length > 0;
const formattedTargetShop = isContracted ? [...new Set(targetShops)].length > 0 ? [...new Set(targetShops)].join(',') : [...new Set(targetShops)][0]
    : staffList.find(s => s.name === key && String(s.period) === String(thisYear))?.shop ?? '';
```

### ⚠️ 意図は変えていない

⚠️⚠️ **「実際に契約を上げた店舗を出す。無ければ今年のマスタの所属」**という判断は ⚠️ **そのまま残した。**
⚠️ 期中の異動があるため、⚠️ **マスタの所属だけでは「どこで上げた実績か」が分からない。**

### ⚠️ 直したところ

| # | 何が起きていたか | どう直したか |
|---|---|---|
| 1 | ⚠️⚠️ **同じ `filter` を2回実行**（`targetShops` と `isContracted`） | ⚠️ 1回にまとめ、⚠️ **`length > 0` で判定** |
| 2 | ⚠️⚠️ **到達しない分岐があった。** `isContracted` が真なら必ず `length > 0` なので、`[...new Set(targetShops)][0]`（⚠️ **`undefined` を返す枝**）には入らない | ⚠️ **枝ごと削除** |
| 3 | ⚠️⚠️ **空の店舗名が混ざると `A,,B` になる** | ⚠️ `.filter(shop => shop)` を追加 |
| 4 | ⚠️ `filter()` の結果に `?.map` を付けていた（⚠️ **配列は null にならない**） | ⚠️ 削除 |
| 5 | ⚠️ `[...new Set(...)]` を3回書いていた | ⚠️ 1度だけにした |

直したあと:

```ts
            const contractedShops = [...new Set(
                inCategory
                    .filter(c => c.staff === key && monthArray.includes(formate(c.contract)))
                    .map(c => c.shop)
                    // ⚠️ 空の店舗を混ぜないこと。⚠️ `A,,B` のような表示になる
                    .filter(shop => shop)
            )];

            const sub = mode === 'staff'
                ? (contractedShops.length > 0
                    ? contractedShops.join(',')
                    : staffList.find(s => s.name === key && String(s.period) === String(thisYear))?.shop ?? '')
                : (sectionByShop.get(key) ?? '');
```

### ⚠️⚠️ 直していないが、知っておくべきこと

⚠️ ⚠️ **`sub` の判定はステータスを見ていない。**
⚠️ 件数（`totalCount`）は ⚠️ **`status === '契約済み'` だけ**を数えているのに対し、
⚠️ ⚠️ **所属は解約・失注でも契約日が入っていれば拾う。**

⚠️ そのため ⚠️ **件数が 0 なのに所属が出ている行が出うる。**
⚠️ ⚠️ **オーナー改修のままでよいとの指示なので変えていない。** ⚠️ **揃えたい場合は指示をください。**

---

## 5. ⚠️ モーダルの幅

⚠️⚠️ **もともと `size` を指定しておらず、既に md（Bootstrap の既定・500px）である。**

```tsx
<Modal show={showRanking} onHide={() => setShowRanking(false)} centered>
```

⚠️ ⚠️ **`react-bootstrap` に `size="md"` は無い**（指定できるのは `sm` / `lg` / `xl` のみ）。
⚠️ **md にするとは「`size` を書かないこと」である。** ⚠️ **変更は不要だった。**

⚠️ ⚠️ **店舗別＋期間指定だと7列になり、500px では窮屈**である。
⚠️ **広げたい場合は指示をください**（⚠️ そのときは `size="lg"` を足す）。

---

## ⚠️ 確認（2026-09-24・ローカル）

| # | 確認 | 結果 |
|---|---|---|
| 1 | `npm run build` | ⚠️ **成功**（⚠️ **今回の変更による新しい警告は無し**） |
| 2 | `npx eslint Ranking.tsx` | ⚠️ **指摘なし** |
| 3 | ビルド | ⚠️ **`main.3bfc5388.js`** |

---

## ⚠️ ブラウザでの確認（未実施）

- [ ] ⚠️ **店舗別で「達成率」が独立した列で出る**（⚠️ 期間指定の有無にかかわらず）
- [ ] ⚠️ 見出しに ⚠️ **「期間計÷予算」/「総計÷予算」**が出て、期間の指定で切り替わる
- [ ] ⚠️⚠️ **達成率の見出しをクリックすると達成率で並び替わる**（⚠️ 2度押しで昇順）
- [ ] ⚠️ 順位の数字が ⚠️ **並びと一致している**（⚠️ 同着は同じ順位）
- [ ] ⚠️⚠️ **達成率で並べたまま「個人別」に切り替えても壊れない**（⚠️ 総計順になる）
- [ ] ⚠️ 個人別に ⚠️ **予算・達成率の列が出ない**
- [ ] ⚠️ 該当なしのとき ⚠️ **「該当するデータがありません」が表の幅いっぱいに出る**
- [ ] ⚠️ 個人別の所属が ⚠️ **契約を上げた店舗**（複数ならカンマ区切り）
- [ ] ⚠️ 予算が0の店舗が ⚠️ **`0%`**（⚠️ `Infinity%` や `NaN%` にならない）

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **並べ替えの対象を足すときは `valueOf()` だけを直すこと。** ⚠️ ソート・順位・足切りが同じものを見る |
| 2 | ⚠️ `sub`（個人別の所属）は ⚠️ **ステータスを見ていない**。⚠️ 件数0でも所属が出ることがある |
| 3 | ⚠️ 店舗別＋期間指定で ⚠️ **7列**になる。⚠️ **幅が足りなければ `size="lg"`** |
| 4 | ⚠️ 達成率は ⚠️ **切り上げの整数**（`Math.ceil`）。⚠️ 99.1% は 100% と出る |
