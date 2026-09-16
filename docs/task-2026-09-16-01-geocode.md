# 指示①　経緯度取得の無駄打ちを止める

⚠️ 依頼（要旨）: 「経緯度のない顧客データを返して、取得した経緯度を渡す。取得できない顧客データには *取得不可* を渡して二度と API を叩かないロジックに」

⚠️ 背景: Geocoding の請求が **¥150,000 超過**。

---

## ディレクトリ・ファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `projects/sync/src/services/` | `runGeocode.ts` | ⚠️ **全面書き直し** |
| `backend/src/handlers/` | `customer_address.php` | 更新行数（`rowCount()`）を返す |
| `backend/src/handlers/` | `geoCode.php` | ⚠️ コメントのみ追加（**呼ばれなくなった**旨） |

## 追加した関数（`runGeocode.ts`）

- `fetchLatLng()` — ⚠️ 戻り値を `ok` / `nohit` / `error` / `fatal` の4種に分けた
- `save()` — ⚠️ **更新行数と `mode` を検証**して「黙って0行」を検知

## 追加した定数

`NOHIT_STATUS` / `FATAL_STATUS` / `MAX_PER_RUN`（既定500）/ `MAX_CONSECUTIVE_ERRORS`（10）/ `GATEWAY_URL`

---

## ⚠️ 原因

「物件データの処理」が**毎回 `property_db` の全1,031件**を Geocoding に投げ、⚠️ **1件も保存できていなかった**。

- 絞り込みが `latitude`/`longitude` を見ていたが、⚠️ **`property_db` にその列が無い**
- 送信キーが `property_number` だが、⚠️ **`property_db` のキーは `property_id`**
- 保存先の `geoCode.php` が ⚠️ **別テーブル `property_list_kaeru`** を更新

⚠️ さらにこの処理は**丸ごと不要**だった（同じ物件を `customer_address` 側が既に取得済み）。

## 検証（ローカルDB）

- 住所なし1,360件を ⚠️ **API 0回**で解消（3,814 → 2,455）
- 3件叩いて3件保存（2,455 → 2,452）
- ⚠️ **キー不正のときは「取得不可」を1件も書かない**ことを確認

## ⚠️ 残課題

- ⚠️ `master_data_resale` に **`id` が NULL の行**が1件。構造的に更新できない
- ⚠️ 毎回500件の上限に張り付くなら、保存できていない疑い

## ⚠️ 未デプロイ

- ⚠️ `projects/sync` の `git push heroku main`（commit `3bc9e67`。⚠️ **push＝即デプロイ**、`dist/` のコミット必須）
- ⚠️ `customer_address.php` を ① レンタルサーバーへアップロード
