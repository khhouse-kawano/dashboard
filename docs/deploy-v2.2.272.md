# デプロイ手順 v2.2.272　① PHP の入口にログインの確認／顧客DB（注文）の予備を軽くする

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | セキュリティログに「トークン無し（通した）」が出る。K-Snap の写真登録がトークンを付けて送る | ① フロント（Dashboard） |
| 2 | お客様の情報を返す処理（顧客DB・反響一覧・キャンセル集計など21種類）は、ログインしていないと 401。それ以外は通したうえで、トークン無しを記録する。顧客DB（注文）の予備が落ちなくなる | ① PHP `backend/src/` の4ファイル |
| 3 | セキュリティログの一覧で「トークン無し（通した）」に絞れる | ② VPS（backend-express） |
| 4 | 更新履歴・業務ガイド1本（セキュリティログ） | ① DB `backend/scripts/sql/2026-11-16_update_log_2.2.272.sql` |

- 表の変更・`.env.prod` の変更はありません。

## ⚠️ 順序
```
0. GitHub で v2.2.272 を production へマージ（PR）
1. ① Dashboard のフロント（npm run build → アップロード）
2. ① PHP 4ファイル                      ← ⚠️ request_auth.php を index.php より先に
3. ② VPS：fetch・checkout → 作り直し
4. ① SQL：2026-11-16_update_log_2.2.272.sql   ← ⚠️ 1回だけ
```
- ⚠️⚠️ **`core/request_auth.php`（新しいファイル）を、`index.php` より先に上げてください。** 新しい index.php はこのファイルを読み込むので、無いと**すべての処理が 500 で止まります。**
- 顧客DB（注文）の予備の新しい形は、v2.2.271 以降のフロントでないと読めません。v2.2.271 のフロントが本番に出ていれば、順序の問題はありません。

### 手順1　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.272 になればよいです。

### 手順2　【① PHP】
次の順にアップロードします（同じ場所へ。上書き）。
1. `backend/src/core/request_auth.php`（**新規**）
2. `backend/src/core/security_log.php`
3. `backend/src/handlers/databaseAction/database_order.php`
4. `backend/src/index.php`（**最後**）

上げ終えたら、すぐ次の2つを確かめてください。
- 画面を再読み込みして、顧客DB・メニューの件数が出ること（ログインしたままでよい）
- ブラウザのシークレットウィンドウなど、ログインしていない状態でログイン画面が出て、Google でログインできること

### 手順3　【② VPS】
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
git log -1 --oneline
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
dcp ps express-api
```
- `git log` が v2.2.272 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順4　【① SQL】
phpMyAdmin で `2026-11-16_update_log_2.2.272.sql` を **1回だけ**流します（更新履歴1行＋業務ガイド1本）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT title, updated_at FROM guide_article WHERE title = 'セキュリティログ';
```

## 終わったら（動作確認）
- 顧客DB（注文・建売）・反響一覧・店舗・担当別反響・キャンセル集計が、今までどおり開く。
- ヘッダーの「システム管理 → セキュリティログ」で、種類に「トークン無し（通した）」がある。
- 反響の取り込み（GAS・フォーム）が、翌日以降も今までどおり入っている。

## 切り戻し
- **画面が開かない・取り込みが止まったとき**：① の `index.php` だけ前の版に戻せば、ログインの確認は全部外れます（request_auth.php は残っていても使われません）。
- 特定の処理だけ外したいときは、`core/request_auth.php` の `REQUEST_AUTH_REQUIRED` からその行を消して上げ直します。外部から呼ばれていて止まった処理は、`REQUEST_AUTH_PUBLIC` に足します。

## このあと（次の版でやること）
- 1〜2週間たったら、セキュリティログを「トークン無し（通した）」で絞って見てください。
  - 社員の操作ではない呼び出し（GAS・他のシステムからの取り込みなど）の処理名（request）を控えます。
  - その一覧を次の版の依頼に書いてください。それを `REQUEST_AUTH_PUBLIC` に足してから、全体をログイン必須にします（段階2）。

## 知っておくこと
- スタッフのトークンは1人1つです。別の端末でログインし直すと、前の端末のトークンは無効になります。そのあと前の端末でお客様の情報の画面を開くと、読み込めなくなります。② の処理では、もともと同じ動きです。ログインし直せば直ります。
- 顧客DB（注文）の予備は、ローカルの PHP（上限128MB）で 14秒・9.8MB で返せました。② の応答と1バイトまで同じです。
