# デプロイ手順 v2.2.259　sync の実行結果を DB に残し、システム管理で見る

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 実行結果の表 `sync_run_log` を作る | ① DB `backend/scripts/sql/2026-11-10_sync_run_log.sql` |
| 2 | 合い言葉 `SYNC_LOG_SECRET` を決めて入れる | ② VPS `.env.prod`・Heroku の Config Vars（**同じ値**） |
| 3 | 実行結果の受け口・一覧の口・180日の削除 | ② VPS（backend-express。`docker-compose.prod.yml` も変わる） |
| 4 | 一覧の口を ② へ転送する許可リスト | ① PHP `backend/src/core/express_proxy.php` |
| 5 | システム管理 →「同期の実行結果」 | ① フロント（Dashboard） |
| 6 | 更新履歴・業務ガイドの記事2本 | ① DB `backend/scripts/sql/2026-11-10_update_log_2.2.259.sql` |
| 7 | 実行結果を送る・エラーのメールをやめる・ielove のコンソール | Heroku（`projects/sync` のブランチ `sync-log`） |

## 順序
```
0. GitHub で v2.2.259 を production へマージ（PR）。sync は sync-log を main へマージ
1. ① SQL：2026-11-10_sync_run_log.sql                 ← ⚠️ 先（② が書く表）
2. 合い言葉を決めて、② VPS の .env.prod に入れる       ← ⚠️ ② の再起動より前
3. ② VPS（backend-express）を更新して再起動
4. ① PHP：express_proxy.php
5. ① Dashboard のフロント
6. ① SQL：2026-11-10_update_log_2.2.259.sql           ← ⚠️ 1回だけ
7. Heroku：Config Vars に SYNC_LOG_SECRET（2 と同じ値）を入れてから、sync をデプロイ
```
⚠️ 7 を 3 より先に行うと、sync の送信がすべて断られます。取り込みの処理そのものは止まりません。断られた結果は残りません。

### 手順1　【① SQL】表を作る
phpMyAdmin で `2026-11-10_sync_run_log.sql` を流します（何回流しても同じです）。最後の `SHOW CREATE TABLE` が出ればよいです。

### 手順2　【合い言葉】決めて ② に入れる
長いランダムな文字を1つ決めます。例えば、② VPS で次を流します。
```bash
openssl rand -hex 32
```
出た値を、② VPS の `~/dashboard/.env.prod` に1行で足します（値はリポジトリ・チャットに書かないでください）。
```
SYNC_LOG_SECRET=<出た値>
```
⚠️ 同じ値を、手順7で Heroku にも入れます。控えておいてください。

### 手順3　【② VPS】backend-express を更新
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
⚠️ `docker-compose.prod.yml` が変わります（`SYNC_LOG_SECRET` を渡す行が増える）。`up -d` で作り直されます。

確認（② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"sync_log","roll":"write","key":"x","rows":[]}'
```
- `合い言葉が正しくありません`（401）ならよいです。
```bash
dcp exec express-api sh -c 'test -n "$SYNC_LOG_SECRET" && echo SET || echo EMPTY'
```
- `SET` ならよいです。`EMPTY` なら、`.env.prod` の行と、`dcp up -d express-api` を確かめてください。

### 手順4　【① PHP】express_proxy.php
`backend/src/core/express_proxy.php` を、サーバーの `dashboard/api/gateway/core/express_proxy.php` に上げます（上書き）。
確認（トークンなし。① 経由）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"sync_log_list"}'
```
- `認証が必要です。`（401）ならよいです。404 なら express_proxy.php が古いままです。

### 手順5　【① Dashboard のフロント】いつもの手順
v2.2.259 のブランチで `npm run build` をし直してから上げてください。

### 手順6　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-10_update_log_2.2.259.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.259 で、1行だけならよいです。

### 手順7　【Heroku】sync
1. Heroku のダッシュボード → アプリ → Settings → Config Vars で、次の2つを足します。
   - `SYNC_LOG_SECRET`：手順2と**同じ値**
   - 送り先 `SYNC_LOG_URL` は入れなくてよいです（既定が `https://api.khg-marketing.info/api/gateway`）
2. sync の `sync-log` ブランチを main へマージし、いつもの手順で Heroku へデプロイします。

確認：取り込みを1回動かします（例：`targetTasks: ['property']`）。Heroku のログに次が出ればよいです。
- `[ielove] ✅ ログイン成功`、または `ログイン画面のままです`
- 店舗ごとの `物件一覧を開きました（HTTP 200）`、または `物件一覧が HTTP 403`
- `[実行結果] property: success`（または partial）
- `[実行結果] Dashboard への送信に失敗しました` が出たら、合い言葉の不一致か、② が古い可能性があります。

## 終わったら（動作確認）
1. Master で Dashboard に入り、ヘッダーの「システム管理 → **同期の実行結果**」を開く
2. 手順7で動かしたタスクが「タスクごとの最新」と「履歴」に出る
3. 一部失敗・失敗の行で「理由を見る」を押すと、理由が出る
4. Dashboard の版の表示が ver2.2.259

## 知っておくこと
- **エラーのメールは送られなくなります**（利用者の決定）。失敗は、この画面で確かめてください。
- 平日来場キャンペーンの**反響のメール**（業務のメール）は、今までどおり送ります。
  - ⚠️ 送り元の Gmail（`GMAIL`・`GMAIL_PASS`）の認証が切れていると、反響のメールも届きません。
  - ⚠️ HOME'S・会員登録などの、メールからの取り込みも同じ認証を使っています。
  - 2026-11-10 のログでは `535 Username and Password not accepted` が出ていたので、アプリパスワードを作り直し、Heroku の `GMAIL_PASS` を入れ替えてください。
- ⚠️ `runMyHomeRobo.ts` にあった Gmail のアプリパスワードは、ソースから消しました。ただし git の履歴（GitHub）に残っているので、**そのアプリパスワードは Google アカウントで無効にしてください**。
- 記録は180日分です。② が毎日、古い行を消します。

## 切り戻し
- sync を前の版に戻すと、エラーのメールに戻ります（Gmail の認証が直っていなければ、届きません）。
- ② を前の版に戻すと、sync の送信は断られます。取り込みの処理は止まりません。
- 表 `sync_run_log` は残しても害はありません。
