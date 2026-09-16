# 指示⑰　来場希望場所が空のとき「店舗未設定」を残す

⚠️ 依頼（要旨）: 「`shop` が空文字や NULL になることがある。`inquiry_customer` に空で入ると営業が困る。
`form_table` の `shop.bool === false` のときは、マッピングしたブランド名を残してほしい（`KH店舗未設定` など）」

---

## ⚠️ 調べて分かったこと

⚠️⚠️ **これは私が入れた後退だった。**

⚠️ 移植前（① の PHP）は `brand_value . shop` と**連結するだけ**で、空のときは
⚠️ **`KH` のように接頭辞だけが入っていた。**

| 実データ（`inquiry_customer`） | 件数 |
|---|---|
| `KH` | 119 |
| `2L` | 61 |
| `DJH` | 44 |
| `なごみ` / `JH` / `PGH` | 計7 |

⚠️ ところが ② は `a.shop === '' ? '' : …` としていたため、⚠️ **接頭辞すら入らず完全に空**になっていた。

⚠️ 来場希望場所を**聞かない**フォームは **89件**（kh 49／djh 28／pg 6／2l 2／jh 2／なごみ 2）。
⚠️ **既定値（`shop.default`）が入っているものは0件**だった。

---

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend-express/src/features/campaignForm/` | `entry.ts` | 空のとき `店舗未設定` を付ける |
| `backend/forms/` | `khg-api-form-register.snippet.php` | ⚠️ `khgShopValue()` を追加（① 用の下書き） |
| `frontend/src/utils/` | `version.ts` | `2.2.135` |

## 追加した定数・関数

| 名前 | ファイル |
|---|---|
| `UNSET_SHOP`（`'店舗未設定'`） | `campaignForm/entry.ts` |
| `khgShopValue()` | `khg-api-form-register.snippet.php` |

---

## ⚠️ 実装の考え方

```ts
const shopValue = `${spec?.shopPrefix ?? ''}${a.shop === '' ? UNSET_SHOP : a.shop}`;
```

⚠️⚠️ **`form_table.shop` の `bool` は見ていない。**
⚠️ 公開フォームは「聞かない かつ 既定値なし」のとき**必ず空**を送るので、
⚠️ **`shop` が空かどうかで同じ判定になる。**
⚠️ JSON 列を1つ増やして解釈するより壊れにくい。

⚠️⚠️ **新しい対応表を作っていない。** ⚠️ `shopPrefix` をそのまま使う。
⚠️ ブランドの対応表は過去に4か所へ写されて中身が食い違った。

⚠️ ブランドも分からないときは `店舗未設定` だけになる。
⚠️ **空よりは一覧で見つけられる**ので、これでよい（利用者と確認済み）。

---

## 検証

### 実際に ② へ送って保存された値（ローカルDB）

| 送った brand | 保存された shop |
|---|---|
| kh | ⚠️ **KH店舗未設定** |
| djh | ⚠️ **DJH店舗未設定** |
| なごみ | ⚠️ **なごみ店舗未設定** |
| 2l | ⚠️ **2L店舗未設定** |
| fh | ⚠️ **FH店舗未設定** |

⚠️ 残り3つ（jh / pg / khg）は ⚠️ **公開受付の流量制限（10分に5件）に掛かった。**
⚠️ **保護は正しく効いている**ので触らず、下の一覧で確認した。

### 全ブランドの組み立て

| 確認 | 結果 |
|---|---|
| 指示書の8ブランドと**完全一致** | ⚠️ OK |
| `なごみ`（かな）/ `nieru` / ⚠️ `khf`→`KHG` | ⚠️ OK |
| ⚠️ 来場希望場所があるときは今までどおり（`KH鹿児島店` / `PGH宮崎店`） | ⚠️ OK |
| ⚠️ ブランド不明でも空文字にならない | ⚠️ OK |
| 「店舗未設定」が実在の接頭辞と衝突しない | ⚠️ OK |
| ① の下書きにも同じ関数がある | ⚠️ OK |

⚠️ 検証で入れた行（`inquiry_customer` / `pgcloud` / `form_cv` / `form_show`）は**削除済み**。

---

## ⚠️ ① 側（退避時）

⚠️ `khg-api-form-register.snippet.php` に `khgShopValue()` を足した。

⚠️⚠️ **既存の bindValue を置き換えること**（`form_register` と `registration:homepage` の**2か所**）。

```php
$stmt->bindValue(':shop', khgShopValue($brand_value, $data['shop'] ?? ''), PDO::PARAM_STR);
```

⚠️ 反映するまでは、⚠️ **② が落ちて ① へ退避したときだけ `KH` のまま**になる。
