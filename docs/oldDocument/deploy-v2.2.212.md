# デプロイ手順 v2.2.212　土地新着ネットの取り込みを作り直す

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 取り込みの受け口 `tochishinchaku_entry`（合い言葉は会員登録と同じ MEMBER_ENTRY_KEY） | ⚠️ **② VPS（再ビルド）**。⚠️ .env.prod の変更は**なし** |
| 2 | ② に届かないときの予備 `tochishinchaku_entry.php`・① から ② への転送 | ① PHP `backend/src/handlers/tochishinchaku_entry.php`（新規）・`backend/src/core/express_proxy.php` |
| 3 | GAS の TochishinchakuToDashboard を差し替える | ⚠️ Google Apps Script（スクリプト プロパティ MEMBER_ENTRY_KEY） |
| 4 | 版の表示（2.2.212） | ① フロント（ビルドしてアップロード。いつもの手順） |
| 5 | 更新履歴 | ① DB |

- ⚠️ ブランド・店舗は「KHG・ブランド・店舗未設定」で入る（指示どおり未設定）。

## 順序
```
0. GitHub で v2.2.212 を main → production へマージ
1. ② 再ビルド
2. ① PHP（tochishinchaku_entry.php・express_proxy.php）   ← ⚠️ 1 の後
3. GAS：スクリプト プロパティ → コードを差し替え → 手で1回実行   ← ⚠️ 1・2 の後
4. ① フロント
5. ① SQL（更新履歴）
```
- ⚠️ GAS は過去3日分のメールを毎回読む（以前と同じ）。php が消えていた間の会員登録は、3日より前の分は入らない。
  - 入れたいときは、3 の前に GAS の `TOCHI_QUERY` の `newer_than:3d` を一時的に広げて（例 `newer_than:30d`）1回実行し、元に戻す。
  - ⚠️ 広げても二重には入らない（同じ通番・同じ日の同じ人は「登録済み」で飛ばす）。

## 手順1　【② VPS で実行】再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/tochishinchaku/entry.ts
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
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"tochishinchaku_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。

## 手順2　【① FTP】PHP
アップロードする2ファイル（`/dashboard/api/gateway/` の下）:
- `handlers/tochishinchaku_entry.php`（新規）
- `core/express_proxy.php`（`expressProxyRequests()` に `tochishinchaku_entry` を1行足した）

⚠️ 合い言葉（SetEnv MEMBER_ENTRY_KEY）は会員登録のときに設定済み。追加の設定は無い。

確認:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"tochishinchaku_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい。

## 手順3　【GAS】TochishinchakuToDashboard の差し替え
土地新着ネットの GAS（関数 `TochishinchakuToDashboard` があるプロジェクト）で:
1. ⚠️ 今のコードを全部コピーして手元に残す（戻すとき用）。
2. 「プロジェクトの設定」→「スクリプト プロパティ」→ `MEMBER_ENTRY_KEY` に合い言葉（会員登録の GAS と同じ値）。
   - ⚠️ 会員登録・ハウジングバザール・カゴスマの GAS と**同じプロジェクト**なら設定済み。
3. `TochishinchakuToDashboard` と `getStrValue` があるファイルの中身を、`backend/scripts/gas/TochishinchakuToDashboard.gs` に**丸ごと**置き換えて保存（⚠️ トリガーはそのまま）。
   - ⚠️ 関数名・定数名は `tochi` / `TOCHI_` で始まるので、同じプロジェクトの他のファイルとぶつからない。
   - ⚠️ `getStrValue` を**他のファイルが使っている**なら、`getStrValue` だけ残す（今回の GAS は使わない）。
   - ⚠️ 以前のコードにあった Authorization の合い言葉は、新しいコードには無い（使わなくなる）。
4. `TochishinchakuToDashboard` を手で1回実行 → 実行ログ:
   - `② 200 tochishinchaku_… : {"status":"exists",…}` … 取り込み済み
   - `② 200 … {"status":"success",…}` … 新しく入った
   - `② 401` → 合い言葉が違う
5. 反響一覧で、新しく入った土地新着ネットの反響（ブランド・店舗未設定）の住所・電話・希望エリア・備考を確認する。

## 手順4　【① フロント】
いつもの手順でビルドしてアップロード（版の表示が 2.2.212 になる）。

## 手順5　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-23_update_log_2.2.212.sql`
