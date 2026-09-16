# 指示⑧　`FormBuilder.tsx` — 必須項目なのに必須にチェックが入らない

⚠️ 依頼（要旨）: 「必須項目の質問にもかかわらず必須にチェックがない」

---

## ⚠️ 原因

⚠️ **`form_table` の設定 JSON は `bool` と `required` を別々に持っている。**

```json
{"bool":true,"required":true,"text":"来場希望場所を選択してください。","shopName":[...]}
```

⚠️ ところが `usedFromSettings()` は **`bool` しか読んでいなかった**。
⚠️ 必須かどうかは `BUILDER_FIELDS` の**ベタ書き**（姓・名・電話・メールだけ `true`）のままだった。

⚠️ そのため ⚠️ **キャンペーン側で必須にしている来場希望場所・ふりがな・住所・来場希望日などが、生成した HTML では必須にならなかった**。

⚠️ 公開フォーム（`react/form_get` の `Form.tsx`）は `parsed.required === true && parsed.bool === true` で判定している。⚠️ **読み方が食い違っていた**。

---

## 変更したファイル

| ディレクトリ | ファイル |
|---|---|
| `frontend/src/components/campaign/` | `formBuilderUtils.ts` |
| `frontend/src/components/campaign/` | `FormBuilder.tsx` |

## 追加・変更した関数と型

| 名前 | 内容 |
|---|---|
| `readSettings()` | ⚠️ **新規**。`usedFromSettings()` を置き換え。`{ used, required }` を返す |
| `SettingFlags` | ⚠️ **新規**の型。`used` / `required` の2つの対応表 |
| `usedFromSettings()` | ⚠️ **削除**（`readSettings` に統合） |

⚠️ `must = on && parsed.required === true` としている。⚠️ **聞いていない項目を必須にはできない**ため。

⚠️ `FormBuilder.tsx` 側はキャンペーン選択時に `setFields(...)` で `required` も設定から入れるようにした。⚠️ **手で変えられる点は今までどおり**。

---

## 検証（ローカルDB `form_table` 340件）

| 確認 | 結果 |
|---|---|
| 「聞いていないのに必須」 | ⚠️ **0件** |
| ⚠️ 修正前は必須にならなかった項目 | ⚠️ **延べ 3,148 件** |
| 壊れた JSON を無視して継続 | 6件（落ちない） |

⚠️ 内訳（延べ）:

| 項目 | 件数 |
|---|---|
| ふりがな（せい/めい） | 各 272 |
| 郵便番号〜番地 | 各 272 |
| 年齢 | 271 |
| 来場希望日・時間 | 各 262 |
| きっかけ | 262 |
| 来場希望場所 | 183 |
| ご要望・ご質問 | 4 |

⚠️ **ほぼ全キャンペーンで取りこぼしていた**ことになる。
