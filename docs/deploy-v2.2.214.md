# デプロイ手順 v2.2.214　マイホームズの取り込みを作り直す

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 取り込みの受け口 `myhomes_entry`（合い言葉は会員登録と同じ MEMBER_ENTRY_KEY） | ⚠️ **② VPS（再ビルド）**。⚠️ .env.prod の変更は**なし** |
| 2 | ② に届かないときの予備 `myhomes_entry.php`・① から ② への転送 | ① PHP `backend/src/handlers/myhomes_entry.php`（新規）・`backend/src/core/express_proxy.php` |
| 3 | GAS の MyhomestoDashboard を差し替える | ⚠️ Google Apps Script（スクリプト プロパティ MEMBER_ENTRY_KEY） |
| 4 | 版の表示（2.2.214） | ① フロント（ビルドしてアップロード。いつもの手順） |
| 5 | 更新履歴 | ① DB |

## 順序
```
0. GitHub で v2.2.214 を main → production へマージ
1. ② 再ビルド
2. ① PHP（myhomes_entry.php・express_proxy.php）   ← ⚠️ 1 の後
3. GAS：スクリプト プロパティ → コードを差し替え → 手で1回実行   ← ⚠️ 1・2 の後
4. ① フロント
5. ① SQL（更新履歴）
```
- ⚠️ GAS は過去3日分のメールを毎回読む（以前と同じ）。php が消えていた間の分で3日より前のものは入らない。
  - 入れたいときは、3 の前に GAS の `MYHOMES_QUERY` の `newer_than:3d` を一時的に広げて（例 `newer_than:60d`）1回実行し、元に戻す。
  - ⚠️ 広げても二重には入らない（同じリードID・同じ日の同じ人は「登録済み」で飛ばす。9/21 の江口様のように以前の php で入った行も飛ばす）。

## 手順1　【② VPS で実行】再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/myhomes/entry.ts
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
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"myhomes_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。

## 手順2　【① FTP】PHP
アップロードする2ファイル（`/dashboard/api/gateway/` の下）:
- `handlers/myhomes_entry.php`（新規）
- `core/express_proxy.php`（`expressProxyRequests()` に `myhomes_entry` を1行足した）

確認:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"myhomes_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい。

## 手順3　【GAS】MyhomestoDashboard の差し替え
マイホームズの GAS（関数 `MyhomestoDashboard` があるプロジェクト）で:
1. ⚠️ 今のコードを全部コピーして手元に残す（戻すとき用）。
2. 「プロジェクトの設定」→「スクリプト プロパティ」→ `MEMBER_ENTRY_KEY`（会員登録の GAS と同じ値）。同じプロジェクトなら設定済み。
3. `MyhomestoDashboard` と `getStrValue` があるファイルの中身を、`backend/scripts/gas/MyhomestoDashboard.gs` に**丸ごと**置き換えて保存（⚠️ トリガーはそのまま）。
   - ⚠️ 関数名・定数名は `myhomes` / `MYHOMES_` で始まるので、同じプロジェクトの他のファイルとぶつからない。
   - ⚠️ `getStrValue` を**他のファイルが使っている**なら、`getStrValue` だけ残す（今回の GAS は使わない）。
4. `MyhomestoDashboard` を手で1回実行 → 実行ログ:
   - `② 200 myhomes_CH-… : {"status":"exists",…}` … 取り込み済み
   - `② 200 … {"status":"success",…}` … 新しく入った
   - `② 401` → 合い言葉が違う
5. 反響一覧で、新しく入ったマイホームズの反響の店舗（希望エリアで決まっている）・住所・備考を確認する。

## 手順4　【① フロント】
いつもの手順でビルドしてアップロード（版の表示が 2.2.214 になる）。

## 手順5　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-23_update_log_2.2.214.sql`
