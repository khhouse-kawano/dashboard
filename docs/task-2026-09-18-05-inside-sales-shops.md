# 指示（2026-09-18）　インサイドセールスに PGH霧島店 を追加し、合計行の表記を変える

⚠️ 依頼:
> CallStatusList.tsx
> targetShop==='inside_sales'のとき 'PGH霧島店' も追加したい
> また先頭行の次は熊本営業課としてではなくインサイドセールス全体という表記にしたい

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `frontend/src/components/` | ⚠️ `CallStatusList.tsx` | ⚠️ **3か所**（＋定数3つ・関数1つを追加） |

⚠️ ⚠️ **バックエンドの改修はない。** 店舗の一覧は `shop_list` をそのまま使っており、
`PGH霧島店` は ⚠️ **すでに `division = '注文事業'` / `show_flag = 1`** で入っている。

---

## ⚠️ なぜ2か所を同時に直す必要があるか

⚠️ インサイドセールスの店舗の集合は、⚠️ **もともと2か所に別々に書かれていた。**

| 箇所 | 用途 | 改修前の式 |
|---|---|---|
| `targetShopList` | ⚠️ **数字の絞り込み** | `s.section === '熊本営業課'` |
| `renderInsideSalesList()` の `displayShops` | ⚠️ **表に出す行** | `s.section === '熊本営業課'` |

⚠️⚠️ **片方だけ直すと次のように壊れる。**

- 行だけ足す → ⚠️ **PGH霧島店の行は出るが数字が全部0**（`targetCallLog` が素通りしない）
- 絞り込みだけ直す → ⚠️ **合計には乗るのに PGH霧島店の行が出ない**（内訳の合計が合わなくなる）

⚠️ そのため ⚠️ **判定を関数 `isInsideSalesShop()` に一本化した。**

---

## ⚠️ 追加した定数・関数

⚠️ ファイル冒頭（コンポーネントの外・`dateFormate` の下）に置いた。

```ts
/**
 * インサイドセールスの対象店舗。
 *
 * ⚠️ 基本は `section === '熊本営業課'` だが、2026-09-18 の指示で
 *   `PGH霧島店`（section は熊本営業課ではない）も対象に加えた。
 * ⚠️ 絞り込み（targetShopList）と表の行（displayShops）の2か所で使う。
 *   片方だけ直すと「表には出るのに数字が0」「数字はあるのに行が出ない」になる。
 */
const INSIDE_SALES_SECTION = '熊本営業課';
const INSIDE_SALES_EXTRA_SHOPS = ['PGH霧島店'];
const isInsideSalesShop = (s: shopList): boolean =>
    s.section === INSIDE_SALES_SECTION || INSIDE_SALES_EXTRA_SHOPS.includes(s.shop);

/** 合計行の見出し。⚠️ 熊本営業課以外も含むため「熊本営業課」とは書かない。 */
const INSIDE_SALES_TOTAL_LABEL = 'インサイドセールス全体';
```

⚠️ ⚠️ **今後さらに店舗を足すときは `INSIDE_SALES_EXTRA_SHOPS` に足すだけでよい。**
⚠️ ⚠️ **`section` を書き換えて対応しないこと。** `section` は
`RankOrder.tsx` / `CompetitorSummary.tsx` / `setStaffLength.ts` など**別画面でも使われている。**

---

## ⚠️ 変更の中身

### 1. 絞り込み（`targetShopList`）

改修前:

```tsx
    const targetShopList = useMemo(() => {
        if (categoryValue === 'order') {
            if (targetShop === 'inside_sales') {
                return shopArray.filter(s => s.section === '熊本営業課').map(s => s.shop);
            }
```

⚠️ 改修後:

```tsx
    const targetShopList = useMemo(() => {
        if (categoryValue === 'order') {
            if (targetShop === 'inside_sales') {
                return shopArray.filter(isInsideSalesShop).map(s => s.shop);
            }
            return shopArray.filter(s => s.shop === targetShop).map(s => s.shop);
        }
        if (categoryValue === 'spec') {
            return shopArray.filter(s => s.shop === targetShop).map(s => s.shop);
        }
        if (categoryValue === 'used') {
            return ['買い:中古リノベ', '買い:ポータル', '売り:ポータル'];
        }
        return [];
    }, [targetShop, shopArray, categoryValue]);
```

⚠️ ここが `targetCallLog` と `filteredCustomer` の両方の入口なので、
⚠️ **総反響数・対応反響数・アポ取得数・架電数がまとめて PGH霧島店ぶん増える。**

### 2. ⚠️ 表に出す行（`displayShops`）＋合計行の表記

改修前:

```tsx
        const displayShops = [{ brand: '', shop: '熊本営業課', section: '熊本営業課', show_flag: 1 }, ...shopArray]
            .filter(s => s.section === '熊本営業課');
```

⚠️ ⚠️ **合計行を先に足してから `filter` をかけていた**ため、
⚠️ 合計行そのものが「section が熊本営業課だから残っている」という状態だった。
⚠️ 表記を変えると同時に、⚠️ **足す側と絞る側を分けた。**

⚠️ 改修後:

```tsx
    const renderInsideSalesList = () => {
        // ⚠️ 先頭は合計行。sIndex === 0 を isTotalRow として扱うので、並び順を変えないこと。
        const displayShops: shopList[] = [
            { brand: '', shop: INSIDE_SALES_TOTAL_LABEL, section: INSIDE_SALES_SECTION, show_flag: 1 },
            ...shopArray.filter(isInsideSalesShop),
        ];
        const metrics = ['総反響数', '対応反響数', '対応中', 'アポ取得数', '対応反響数からの来場数', '総架電数', '資料郵送数', 'SMS送信数', 'メール送信数'];
```

⚠️⚠️ **合計行の判定は `sIndex === 0`（`isTotalRow`）のまま。**
⚠️ ⚠️ **店舗名では判定していないので、表記を変えても集計は壊れない。**
⚠️ ただし ⚠️ **並び順を変えると合計行が別の店舗になる**ため、先頭に置くことは崩さないこと。

⚠️ 表の左端（`rowSpan={9}` のセル）は `{s.shop}` をそのまま出しているので、
⚠️ **この定数を変えるだけで見出しが変わる。**

---

## ⚠️ 画面に出る行（改修後）

| 行 | 店舗 |
|---|---|
| 1 | ⚠️ **インサイドセールス全体**（旧「熊本営業課」） |
| 2 | KH八代店 |
| 3 | KH熊本店 |
| 4 | JH熊本店 |
| 5 | JH八代店 |
| 6 | ⚠️ **PGH霧島店**（⚠️ 今回追加） |

⚠️ 並び順は `shop_list` の並び順そのまま（⚠️ ソートは入れていない）。

---

## ⚠️ やっていないこと

| # | 内容 | 理由 |
|---|---|---|
| 1 | ⚠️ `shop_list` の `section` の書き換え | ⚠️ **他画面（ランキング・競合サマリー・在籍数）に波及する** |
| 2 | ⚠️ 「担当を選択」の一覧に霧島の担当を足す | ⚠️ 一覧は `staff.inside = 1` が基準。⚠️ **足すならDB側** |
| 3 | ⚠️ 建売・中古への展開 | ⚠️ インサイドセールスは `categoryValue === 'order'` だけの画面 |

---

## 検証

| 確認 | 結果 |
|---|---|
| `PGH霧島店` が `shop_list` にあるか | ⚠️ **あり**（`section = 鹿児島営業3課` / `division = 注文事業` / `show_flag = 1`） |
| ⚠️ `division` と `show_flag` で落ちないか | ⚠️ **落ちない**（`filteredShopList` の条件を満たす） |
| `npm run build` | ⚠️ **成功** |
| ⚠️ `CallStatusList.tsx` の警告 | ⚠️ **0件** |

### ⚠️ 未実施（画面での確認）

| # | 確認 | 期待 |
|---|---|---|
| 1 | 注文 → 架電状況 → インサイドセールス | ⚠️ **先頭行が「インサイドセールス全体」** |
| 2 | 同上 | ⚠️ **最終行に「PGH霧島店」が出る** |
| 3 | 合計行の数字 | ⚠️ **PGH霧島店ぶん増えている**（＝2〜6行目の和） |
| 4 | 「担当を選択」で個人を選ぶ | ⚠️ **PGH霧島店の行も担当で絞られる** |
| 5 | ⚠️ 他の店舗（KH鹿児島店など）を選んだとき | ⚠️ **何も変わっていない** |
