# 指示⑮　建売（spec）でも「販促媒体別広告費」をメニューに出す

⚠️ 依頼（要旨）: 「`category === 'spec'` のときにも Menu.tsx で販促媒体別広告費を表示したい。`CustomerKaeru.tsx` を表示する」

---

## ⚠️ 調べて分かったこと

⚠️⚠️ **画面もサーバー側も、元から揃っていた。**

| | 状態 |
|---|---|
| `customer/CustomerRouter.tsx` | ⚠️ **既に `category === 'spec'` で `CustomerKaeru` を描画** |
| `customer/CustomerKaeru.tsx` | ⚠️ **既に `shop/ShopKaeru.tsx` を踏襲済み**（2026-09-14） |
| ② の登録（`registry.ts`） | ⚠️ `customer` の `order` / `spec` **両方あり** |
| ⚠️ **`Menu.tsx`** | ⚠️ **`category === 'order'` のときしか出していなかった** |

⚠️ つまり ⚠️ **URL を直接開けば spec でも表示されるのに、メニューに無いので誰も辿り着けなかった。**

---

## 変更したファイル

| ディレクトリ | ファイル |
|---|---|
| `frontend/src/components/` | `Menu.tsx` |

⚠️ **1か所のみ。**

```
show: !isSp && category === 'order'
  ↓
show: !isSp && (category === 'order' || category === 'spec')
```

⚠️ 隣の「店舗別広告費」「販促媒体別反響推移」が**既にこの書き方**なので、それに揃えた。
⚠️ `used`（中古）は画面が無いので出さない。

---

## 検証（ローカル ②・実データ）

`{"request":"customer","category":"spec"}` の応答を、画面の前提と突き合わせた。

| 確認 | 結果 |
|---|---|
| HTTP | ⚠️ **200**（3.46MB） |
| `medium`（表の行になる） | ⚠️ **17件** |
| ⚠️ `list_medium` 列が**無い**こと（絞ると空になる） | ⚠️ OK |
| `shop` | 7件 |
| `section` | 2件（不動産営業1課・2課） |
| `customer` | ⚠️ **8,321件**（`CustomerKaeru` の注記と一致） |
| `budget` | 1,684件 |
| 顧客に `status` がある | ⚠️ OK |

⚠️ order 側（24,219件・13.2MB）と比べても形は同じ。

### ⚠️ 型の宣言と実データのずれ（直していない）

⚠️ `CustomerKaeru.tsx` の `type Medium = { id: number; medium: string }` に対し、
⚠️ spec の実データは **`no`** を返す（`id` は無い）。

⚠️ ⚠️ **表示は壊れない。** 画面は `value.id ?? \`medium-${index}\`` と書いてあり、
⚠️ React の key が添字に落ちるだけである。

⚠️ 指示の範囲外なので**触っていない**。⚠️ 直すなら型を `{ id?: number; no?: number; medium: string }` にする。

---

## ⚠️ 出し方

⚠️ この変更は ⚠️ **フロントだけ**。⚠️ ② も ① の PHP も DB も触らない。

⚠️ ブランチは `v2.2.134`。⚠️ なごみの緊急修正（②）と**同じブランチに乗る**が、
⚠️ ② の再ビルドではフロントは変わらないため、⚠️ **互いに干渉しない**。

⚠️ メニューに出すには ⚠️ **① へフロントをアップロードする**必要がある。
