# 注文の店舗別推移「KPI単価」の分母を直す／サジェストが隠れる不具合（v2.2.140）

⚠️ 指示（`ReadMeClaude.md`）:

> - `CompetitorMaterials.tsx` の改修
>   * `TableCompetitor.tsx` のように `house_maker` テーブルを使ってサジェスト機能を追加してほしい
> - `frontend/src/shopTrend/` ディレクトリの改修
>   * `checked.budget === true` の場合の KPI 単価がおかしい
>     歩留まり / 総額 にならない

⚠️ 作業中の追加指示:

> サジェストリストの要素が隠れているから実装されていないように見えた
> 最前面に出すように

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 種別 |
|---|---|---|
| `frontend/src/components/shopTrend/` | ⚠️ **`ShopTrendOrder.tsx`** | ⚠️ 不具合の修正 |
| `frontend/src/components/header/` | ⚠️ **`CompetitorMaterials.tsx`** | ⚠️ 表示の修正 |

⚠️ ⚠️ **`ShopTrendKaeru.tsx` と `ShopTrendResale.tsx` は触っていない**（元から正しいため。理由は下）。

---

## ⚠️ 1. KPI単価の分母が、上の歩留まりと別物だった

### ⚠️ 何が起きていたか

⚠️⚠️ **同じ列の上下で、同じ「実来場」「契約」なのに数え方が違っていた。**

| | 上のKPI行 | ⚠️ **単価の分母（旧）** |
|---|---|---|
| 反響 | 反響日がその月 | 同じ ✅ |
| ⚠️ **実来場** | ⚠️ **来場日がその月** | ⚠️ **反響日がその月 かつ 来場フラグあり** |
| ⚠️ **契約** | ⚠️ **契約日がその月 かつ status が 契約済み/解約** | ⚠️ **反響日がその月 かつ 契約日あり**（⚠️ **status を見ない**） |

⚠️⚠️ **反響日で絞っているので、「8月の来場単価」なのに 2024/10 に来場した人まで分母に入っていた。**

### ⚠️ どれくらいずれていたか（ローカル実データ・2026/08・全社）

| | KPI行 | ⚠️ 旧の分母 | 結果 |
|---|---|---|---|
| 実来場 | ⚠️ **381件** | ⚠️ **87件** | ⚠️ **単価が約4.4倍**に出ていた |
| 契約 | ⚠️ **54件** | ⚠️ **7件** | ⚠️⚠️ **単価が約7.7倍**に出ていた |

⚠️ 旧の分母を来場月で割ると、⚠️ **2024/10 が1件・2026/07 が1件・2026/09 が6件**混ざっていた。

### ⚠️ なぜ注文だけだったか

⚠️ ⚠️ **`ShopTrendKaeru.tsx` と `ShopTrendResale.tsx` は、上のKPI行で作った
`total` / `interview` / `contract` をそのまま `budgetMapping` に渡している。**

```ts
// ShopTrendKaeru.tsx（既存・変更していない）
const budgetMapping: Record<number, number> = {
    1: total.length,
    2: interview.length,
    3: contract.length
};
```

⚠️ **注文だけが、広告費の行で顧客を絞り直す古い書き方のまま残っていた。**

### ⚠️ 直した関数（`ShopTrendOrder.tsx`・そのまま）

⚠️ ⚠️ **変更前**（広告費の行の中）:

```ts
const base = customerList.filter(item => (monthIndex >= 1 ? item.register.includes(month) : monthArray.includes(item.register.slice(0, 7))));
const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
const sectionShops = originalShopArray.filter(o => o.section === target.shop).map(o => o.shop);
const total = isMerged
    ? base.filter(item => mergeShops.includes(item.shop))
    : setSection(base, targetSection, target.section, target.shop, targetIndex, sectionShops);
const baseLastYear = customerList.filter(item => (monthIndex >= 1 ? item.register.includes(lastYear) : monthArray.includes(item.register.slice(0, 7))));
const totalLastYear = isMerged
    ? baseLastYear.filter(item => mergeShops.includes(item.shop))
    : setSection(baseLastYear, targetSection, target.section, target.shop, targetIndex);
```

```ts
const filteredLength = total.filter(t => index === 1 ? true : index === 2 ? (t.interview || t.appointment || t.screening || t.contract) : t.contract).length;
const formattedBudget = Number.isFinite(Math.ceil(formattedValue / filteredLength)) ? Math.ceil(formattedValue / filteredLength) : 0;
const lastYearFilteredLength = totalLastYear.filter(t => index === 1 ? true : index === 2 ? (t.interview || t.appointment || t.screening || t.contract) : t.contract).length;
const lastYearFormattedBudget = Number.isFinite(Math.ceil(formattedLastYearValue / lastYearFilteredLength)) ? Math.ceil(formattedLastYearValue / lastYearFilteredLength) : 0;
```

⚠️ ⚠️ **変更後**:

```ts
const lastYear = `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`
const lastYearMonthArray = monthArray.map(month => `${String(Number(month.split('/')[0]) - 1)}/${month.split('/')[1]}`);
const sectionShops = originalShopArray.filter(o => o.section === target.shop).map(o => o.shop);
/**
 * ⚠️⚠️ **単価の分母は、上のKPI行に出ている件数そのものにすること。**
 *
 *   ⚠️ 2026-09-21 まで、ここは
 *     ⚠️ **「反響日がその月」で絞ってからフラグの有無を見ていた。**
 *   ⚠️ ⚠️ **上の歩留まりは「来場日／契約日がその月」で数えている**ので、
 *     ⚠️ **同じ月なのに分母が別物**になっていた。
 *
 *   ⚠️ ローカル実データ（2026/08・全社）での差:
 *     ⚠️ 実来場 **381件** に対し、旧の分母は **87件**（⚠️ 単価が約4.4倍）
 *     ⚠️ 契約   **54件** に対し、旧の分母は  **7件**（⚠️ 単価が約7.7倍）
 *   ⚠️ ⚠️ **8月の単価なのに 2024/10 に来場した人まで混ざっていた。**
 *   ⚠️ 旧の契約の分母は ⚠️ **status（契約済み/解約）も見ていなかった。**
 *
 *   ⚠️ ShopTrendKaeru.tsx / ShopTrendResale.tsx は元から
 *     ⚠️ **KPI行の件数をそのまま分母にしている。** ⚠️ **注文だけが古かった。**
 *   ⚠️ ⚠️ **`getValue()` を通すこと。** ⚠️ 自前で絞り直すと再発する。
 */
const base = isMerged
    ? customerList.filter(c => mergeShops.includes(c.shop))
    : setSection(customerList, targetSection, target.section, target.shop, targetIndex, sectionShops);
const total = getValue(base, monthIndex, month, 'register');
const interview = getValue(base, monthIndex, month, 'interview');
const contract = getValue(base, monthIndex, month, 'contract');
const totalLastYear = getValue(base, monthIndex, lastYear, 'register', lastYearMonthArray);
const interviewLastYear = getValue(base, monthIndex, lastYear, 'interview', lastYearMonthArray);
const contractLastYear = getValue(base, monthIndex, lastYear, 'contract', lastYearMonthArray);
```

```ts
// ⚠️ index は上のラベルの並び。1=反響単価 / 2=来場単価 / 3=契約単価
const filteredLength = index === 1 ? total.length : index === 2 ? interview.length : contract.length;
const formattedBudget = Number.isFinite(Math.ceil(formattedValue / filteredLength)) ? Math.ceil(formattedValue / filteredLength) : 0;
const lastYearFilteredLength = index === 1 ? totalLastYear.length : index === 2 ? interviewLastYear.length : contractLastYear.length;
const lastYearFormattedBudget = Number.isFinite(Math.ceil(formattedLastYearValue / lastYearFilteredLength)) ? Math.ceil(formattedLastYearValue / lastYearFilteredLength) : 0;
```

⚠️ ⚠️ **「総額」（`formattedValue`）と広告費の絞り込み（`budgetFilter` / 子店舗の合算）には手を入れていない。**

⚠️ `base` を ⚠️ **KPI行とまったく同じ作り方**にしたので、
⚠️ **まとめ表示（`isMerged`）のときも上下で同じ顧客を見る。**

---

## ⚠️ 2. サジェストが隠れて「実装されていないように見えた」

### ⚠️ 原因

⚠️⚠️ **z-index ではなく、親の切り抜き（`overflow`）だった。**

- `.cm_entries` … ⚠️ **`max-height: 260px; overflow: auto;`**
- さらに全画面モーダルの `Modal.Body` … ⚠️ **`overflow: hidden`**

⚠️ `position: absolute` の要素は ⚠️ **親の `overflow` で切り落とされる。**
⚠️ ⚠️ **z-index をいくつ上げても直らない**（重なりの問題ではないため）。

### 直した内容

⚠️ 入力欄の画面座標を測り、⚠️ **`position: fixed` で最前面に出す**ようにした。

```ts
/**
 * サジェストを出す位置（画面座標）。
 *
 * ⚠️⚠️ **`position: absolute` では出せない。**
 *   ⚠️ 親の `.cm_entries` が `overflow: auto` なので、
 *     ⚠️ **はみ出した候補が切り落とされて見えない。**
 *   ⚠️ ⚠️ **z-index を上げても直らない**（重なりではなく切り抜きのため）。
 *   ⚠️ そこで入力欄の画面座標を測り、⚠️ **`position: fixed` で最前面に出す。**
 */
const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0, width: 0 });

/** 入力欄の真下に出すための座標を測る。⚠️ `fixed` なので画面座標でよい */
const openSuggest = (index: number, input: HTMLInputElement) => {
    const r = input.getBoundingClientRect();
    setSuggestPos({ top: r.bottom + 2, left: r.left, width: r.width });
    setSuggestRow(index);
};
```

```tsx
<input
    type="text"
    className="cm_input"
    placeholder="他社名（任意）"
    value={entry.company}
    onFocus={(e) => openSuggest(index, e.currentTarget)}
    onBlur={() => setSuggestRow(-1)}
    onChange={(e) => {
        updateEntry(index, { company: e.target.value });
        openSuggest(index, e.currentTarget);
    }}
/>
{suggestRow === index && suggestFor(entry.company).length > 0 && (
    <div
        className="cm_sug"
        style={{
            top: suggestPos.top,
            left: suggestPos.left,
            width: suggestPos.width,
        }}
    >
```

CSS:

```css
.cm_entry_company { flex: 1 1 200px; }
/**
 * ⚠️⚠️ **position: fixed にすること。**
 *   ⚠️ ⚠️ **この <style> はテンプレートリテラルなので、
 *     コメントにもバッククォートを書かないこと**（文字列が閉じる）。
 *   ⚠️ 親の .cm_entries が overflow:auto、さらに全画面モーダルの
 *     Modal.Body も overflow:hidden なので、
 *     ⚠️ **absolute だと候補が切り落とされて見えない。**
 *   ⚠️ ⚠️ **「サジェストが出ない」ように見える不具合の正体がこれ。**
 *   ⚠️ 位置は JSX 側（openSuggest）で入力欄の座標から入れる。
 * ⚠️ モーダル（z-index 1055 前後）より上に出すため 2000 にしてある。
 */
.cm_sug { position: fixed; background: #fff; border: 1px solid #e5e7eb;
          border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.16);
          max-height: 220px; overflow-y: auto; z-index: 2000; }
```

### ⚠️ 作業中にやらかしたこと

⚠️⚠️ **CSS のコメントにバッククォートを書いて、`<style>{\`...\`}` のテンプレートリテラルを途中で閉じてしまった。**
⚠️ ビルドが構文エラーで落ちた。⚠️ **コメント自体にその注意を書き足してある。**

---

## ⚠️ 検証

| 確認 | 結果 |
|---|---|
| ⚠️ **旧・新の分母の差**（2026/08・全社） | ⚠️ **実来場 87 → 381 / 契約 7 → 54**（SQLで実測） |
| ⚠️ 旧の分母に混ざっていた月 | ⚠️ **2024/10・2026/07・2026/09** |
| `npm run build` | ⚠️ **成功** |
| ⚠️ `ShopTrendOrder.tsx` の警告 | ⚠️ **増えていない**（既存の8件のみ。`axios` 未使用など、今回とは無関係） |
| ⚠️ `CompetitorMaterials.tsx` の警告 | ⚠️ **0件** |

---

## ⚠️ 未実施（ブラウザでの確認）

- [ ] 店舗別推移（注文）で ⚠️ **広告費 ON** にしたとき、⚠️ **来場単価・契約単価が下がる**こと
- [ ] ⚠️ **上の「実来場」「契約」の件数で総額を割った値**と一致すること（⚠️ **電卓で1セル検算**）
- [ ] ⚠️ **昨対**の単価も同様に合うこと
- [ ] ⚠️ **まとめ表示（親店舗）**でも上下の数が合うこと
- [ ] 他社資料 → チラシを登録 → 社名欄で ⚠️ **サジェストが手前に出るか**
- [ ] ⚠️ **行を下までスクロールした状態**でもサジェストが入力欄の真下に出るか
