# デプロイ手順 v2.2.210（追加）ハウジングバザールの取り込みを作り直す

⚠️ v2.2.210（4半期サマリー）は main にマージ済み。この追加分も同じ v2.2.210 のブランチから2つ目の PR で出す。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 取り込みの受け口 `housing_bazar_entry`（合い言葉は会員登録と同じ MEMBER_ENTRY_KEY） | ⚠️ **② VPS（再ビルド）**。⚠️ .env.prod の変更は**なし** |
| 2 | ② に届かないときの予備 `housing_bazar_entry.php`・① から ② への転送 | ① PHP `backend/src/handlers/housing_bazar_entry.php`（新規）・`backend/src/core/express_proxy.php` |
| 3 | GAS の HousingBtoDashboard を差し替える | ⚠️ Google Apps Script（スクリプト プロパティ MEMBER_ENTRY_KEY） |
| 4 | 更新履歴に1文足す | ① DB |

- ⚠️ ブランド・店舗は「KHG・ブランド・店舗未設定」で入る（指示どおり未設定）。⚠️ 以前の「KHG店舗未設定」は店舗一覧に無い値だった。
- ⚠️ フロントの変更は**なし**。

## 順序
```
0. GitHub で v2.2.210 を main → production へマージ
1. ② 再ビルド
2. ① PHP（housing_bazar_entry.php・express_proxy.php）   ← ⚠️ 1 の後
3. GAS：スクリプト プロパティ → コードを差し替え → 手で1回実行   ← ⚠️ 1・2 の後
4. ① SQL（更新履歴）
```
- ⚠️ GAS は過去7日分のメールを毎回読む。portal.php が消えていた間の問い合わせも、3 で入る（取り込み済みのものは「登録済み」で飛ばす）。

## 手順1　【② VPS で実行】再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/housingBazar/entry.ts
```
⚠️ ファイル名が出れば取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認（合い言葉なし。保存されない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"housing_bazar_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。

## 手順2　【① FTP】PHP
アップロードする2ファイル（`/dashboard/api/gateway/` の下）:
- `handlers/housing_bazar_entry.php`（新規）
- `core/express_proxy.php`（`expressProxyRequests()` に `housing_bazar_entry` を1行足した）

⚠️ 合い言葉（SetEnv MEMBER_ENTRY_KEY）は会員登録のときに設定済み。追加の設定は無い。

確認:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"housing_bazar_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい。

## 手順3　【GAS】HousingBtoDashboard の差し替え
ハウジングバザールの GAS（関数 `HousingBtoDashboard` があるプロジェクト）で:
1. ⚠️ 今のコードを全部コピーして手元に残す（戻すとき用）。
2. 「プロジェクトの設定」→「スクリプト プロパティ」→ `MEMBER_ENTRY_KEY` に合い言葉（会員登録の GAS と同じ値）。
   - ⚠️ 会員登録の GAS と**同じプロジェクト**なら設定済み。別のプロジェクトならここで入れる。
3. コードを `backend/scripts/gas/HousingBtoDashboard.gs` の中身に**丸ごと**置き換えて保存（⚠️ トリガーはそのまま。⚠️ 会員登録の GAS と同じプロジェクトなら、**別のファイル**として足す。関数名・定数名はぶつからない）。
   - ⚠️ Parser ライブラリ・ラベル「反響管理_ハウジングバザール」は使わなくなった（件名で探す）。
4. `HousingBtoDashboard` を手で1回実行 → 実行ログ:
   - `② 200 housingBazar… : {"status":"exists",…}` … 取り込み済み
   - `② 200 … {"status":"success",…}` … 新しく入った（portal.php が消えていた間の分など）
   - `② 401` → 合い言葉が違う
5. 反響一覧で、新しく入ったハウジングバザールの反響の住所（頭の文字が欠けていない）・郵便番号・建築予定地・備考を確認する。

## 手順4　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-22_update_log_2.2.210_housing_bazar.sql`（⚠️ 2026-10-22_update_log_2.2.210.sql のあと。⚠️ 2回流しても文は1回しか付かない）
