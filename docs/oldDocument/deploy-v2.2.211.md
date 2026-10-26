# デプロイ手順 v2.2.211　カゴスマ・タテルヤの取り込みを作り直す

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 取り込みの受け口 `kagosuma_entry`（合い言葉は会員登録と同じ MEMBER_ENTRY_KEY） | ⚠️ **② VPS（再ビルド）**。⚠️ .env.prod の変更は**なし** |
| 2 | ② に届かないときの予備 `kagosuma_entry.php`・① から ② への転送 | ① PHP `backend/src/handlers/kagosuma_entry.php`（新規）・`backend/src/core/express_proxy.php` |
| 3 | GAS の KagosumatoDashboard を差し替える | ⚠️ Google Apps Script（スクリプト プロパティ MEMBER_ENTRY_KEY） |
| 4 | 版の表示（2.2.211） | ① フロント（ビルドしてアップロード。いつもの手順） |
| 5 | 更新履歴 | ① DB |

- ⚠️ 店舗の割り当ては sync の portalShopList.ts と同じ表（福岡県 → KH久留米店）。決まらないときは「◯◯店舗未設定」。

## 順序
```
0. GitHub で v2.2.211 を main → production へマージ
1. ② 再ビルド
2. ① PHP（kagosuma_entry.php・express_proxy.php）   ← ⚠️ 1 の後
3. GAS：スクリプト プロパティ → コードを差し替え → 手で1回実行   ← ⚠️ 1・2 の後
4. ① フロント
5. ① SQL（更新履歴）
```
- ⚠️ GAS は過去20日分のメールを毎回読む（以前と同じ）。portal.php が消えていた間の反響も、3 で入る（取り込み済みのものは「登録済み」で飛ばす）。

## 手順1　【② VPS で実行】再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/kagosuma/entry.ts
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
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"kagosuma_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。

## 手順2　【① FTP】PHP
アップロードする2ファイル（`/dashboard/api/gateway/` の下）:
- `handlers/kagosuma_entry.php`（新規）
- `core/express_proxy.php`（`expressProxyRequests()` に `kagosuma_entry` を1行足した）

⚠️ 合い言葉（SetEnv MEMBER_ENTRY_KEY）は会員登録のときに設定済み。追加の設定は無い。

確認:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"kagosuma_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい。

## 手順3　【GAS】KagosumatoDashboard の差し替え
カゴスマの GAS（関数 `KagosumatoDashboard` があるプロジェクト）で:
1. ⚠️ 今のコードを全部コピーして手元に残す（戻すとき用）。
2. 「プロジェクトの設定」→「スクリプト プロパティ」→ `MEMBER_ENTRY_KEY` に合い言葉（会員登録の GAS と同じ値）。
   - ⚠️ 会員登録・ハウジングバザールの GAS と**同じプロジェクト**なら設定済み。別のプロジェクトならここで入れる。
3. `KagosumatoDashboard` と `getStrValue` があるファイルの中身を、`backend/scripts/gas/KagosumatoDashboard.gs` に**丸ごと**置き換えて保存（⚠️ トリガーはそのまま）。
   - ⚠️ 同じプロジェクトに他の取り込みのファイルがあっても、関数名・定数名はぶつからない（すべて `kagosuma` / `KAGOSUMA_` で始まる）。
   - ⚠️ `getStrValue` を**他のファイルが使っている**なら、そのファイルのために `getStrValue` だけ残す（今回の GAS は使わない）。
   - ⚠️ Parser ライブラリ・ラベル「反響管理_カゴスマnew」は使わなくなった（件名で探す）。
4. `KagosumatoDashboard` を手で1回実行 → 実行ログ:
   - `② 200 kagosuma… : {"status":"exists",…}` … 取り込み済み
   - `② 200 … {"status":"success",…}` … 新しく入った（portal.php が消えていた間の分など）
   - `② 401` → 合い言葉が違う
5. 反響一覧で、新しく入ったカゴスマの反響の店舗・エリア（イベントのメールでも入っている）・備考を確認する。

## 手順4　【① フロント】
いつもの手順でビルドしてアップロード（版の表示が 2.2.211 になる）。

## 手順5　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-23_update_log_2.2.211.sql`
