# デプロイ手順 v2.2.221　不動産企画係アプリの移植（第1段：入口と安全）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 不動産企画係のデータの読み書き（planner / broker / activity）を ② へ移し、ログインと担当事業を確かめる | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | ① から ② への転送・① の予備にもログインと担当事業の確認・通知を本人宛だけに・取り込み（addTale）を Master だけに | ① PHP 8ファイル |
| 3 | ⚠️ **移植元アプリの顧客データ（data.json・app_state.json）をサーバーから消す** | ① FTP |
| 4 | 画面（category を realty に・画面を components/realty へ・入口の制限・URL を /realty/… に・担当事業に「不動産企画係」） | ① フロント（いつもの手順） |
| 5 | 更新履歴・業務ガイドの記事「不動産企画係の画面（入口と権限）」 | ① DB `backend/scripts/sql/2026-10-28_update_log_2.2.221.sql` |
| 6 | 不動産企画係の人の担当事業を「不動産企画係」に | 画面（権限編集） |

⚠️ v2.2.217〜220 のデプロイが済んでいること。

## 順序
```
0. GitHub で v2.2.221 を main → production へマージ
1. ② 再ビルド                ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① PHP（8ファイル）        ← ⚠️ 1 の後
3. ① FTP で data.json・app_state.json を削除
4. ① フロント                ← ⚠️ 1・2 の後
5. ① SQL（更新履歴・ガイド）
6. 権限編集で不動産企画係の人の担当事業を変える
```

## 手順1　【② VPS で実行】再ビルド
実行中の分析が無いことを ① の phpMyAdmin で確かめる（0行ならよい）:
```sql
SELECT id, staff_name, status FROM ai_analysis_job WHERE status IN ('queued','running') AND deleted_at IS NULL;
```
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/realty/index.ts
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認（トークン無し。保存も変更もされない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"planner","roll":"lead"}'
```
⚠️ `認証が必要です。`（401）が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。

## 手順2　【① FTP】PHP
アップロード（`/dashboard/api/gateway/` の下）:
- `core/authz.php`（`requireShop()`・`AUTHZ_REALTY_SHOPS`・`AUTHZ_BROKER_SHOPS` を追加）
- `core/express_proxy.php`（planner / broker / activity を ② へ転送。書き込み2つは ② だけ）
- `handlers/planner.php`・`handlers/broker.php`・`handlers/activity.php`（ログインと担当事業の確認）
- `handlers/activityAction/activity_notice.php`・`handlers/activityAction/activity_read.php`（本人宛だけ）
- `handlers/addTale.php`（Web からの取り込みは Master だけ）

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"lead"}'
```
⚠️ `認証が必要です。`（401）。⚠️ **以前のように一覧が返ってきたら PHP が古い（危険）。**

## 手順3　【① FTP】移植元アプリのデータを削除する
⚠️⚠️ `/dashboard/api/gateway/handlers/` に次の2つがあれば**削除する**（顧客の氏名・電話・住所を含む。データは DB に移し済みで、画面は使っていない）。
- `handlers/data.json`
- `handlers/app_state.json`

確認（ブラウザで開いて**見えないこと**）:
- `https://khg-marketing.info/dashboard/api/gateway/handlers/data.json` → 404 になること

> 注意：リポジトリ（GitHub）の過去の履歴にはこの2つが残っている。リポジトリは非公開だが、気になる場合は履歴から消す作業を別途行う（履歴を書き換える作業なので、行うかどうかは相談のうえ）。

## 手順4　【① フロント】いつもの手順
## 手順5　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-28_update_log_2.2.221.sql`

## 手順6　【画面】担当事業を「不動産企画係」に
1. 管理者でログインし、ヘッダーの「システム管理 → 権限編集」を開く
2. 不動産企画係の人の「担当事業」を「**不動産企画係**」に変える
   - ⚠️ 今「全事業」の人はそのままでも入れる。不動産企画係の画面だけにしたい人を「不動産企画係」にする
3. 本人が次に画面を移ると反映される（ログインし直す必要はない）

## 終わったら（動作確認）
1. 不動産企画係の人で、事業を選ぶ画面 →「不動産企画係」→ チームサマリーが開くこと（アドレスが `/realty/summary`）
2. 左のメニューから、月次報告書・売り反響・買い反響・商談案件・買取再販案件・媒介獲得台帳がそれぞれ開き、データが出ること
3. 売り反響で1件の担当やフェーズを変えて保存できること
4. 注文・建売の人が `…/dashboard/realty/sell` を直接開くと、事業を選ぶ画面に戻ること
5. 中古リノベの人の顧客DB・顧客詳細で、媒介台帳との紐づけが今までどおり保存できること
