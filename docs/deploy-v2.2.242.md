# デプロイ手順 v2.2.242　セキュリティログ・ログアウトボタン

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい表 `security_log`、staff に `last_login_at`・`last_logout_at` | ① DB `backend/scripts/sql/2026-11-04_security_log.sql` |
| 2 | 記録（401・403・ループ検知・500・存在しないパス）と一覧 `security_log_list`（`features/securityLog.ts` ほか5ファイル） | ⚠️ **② VPS（再ビルド）** |
| 3 | 記録（ログイン・ログアウト・401・403・400・404・502・致命的エラー）、新しい `logout`、② へ接続元を渡す、許可リストに `security_log_list` | ① PHP 6ファイル |
| 4 | 右上のパネルのログアウト、ログイン画面、「システム管理 → セキュリティログ」、版の番号 | ① フロント |
| 5 | 更新履歴・業務ガイド「セキュリティログ」（新規）・「アクティブユーザー（右上のパネル）」「ヘッダーのメニュー」（上書き） | ① DB `backend/scripts/sql/2026-11-04_update_log_2.2.242.sql` |

⚠️ 新しい request が**2つ**あります。
- `security_log_list`（② だけ）：① の express_proxy.php を上げ忘れると「該当する処理がありません」（404）になります。
- `logout`（① だけ）：① の handlers/logout.php が必要です。

## 順序
```
0. GitHub で v2.2.242 を production へマージ（PR）
1. ① SQL（表と列）                    ← ⚠️ 先に。PHP が書き込む先
2. ② 再ビルド                         ← ⚠️ 実行中の Claude による分析が無いときに
3. ① PHP 6ファイル                    ← ⚠️⚠️ security_log.php を最初に上げる
4. ① フロント
5. ① SQL（更新履歴・業務ガイド）       ← ⚠️ 1回だけ
```

### 手順1　【① SQL】表と列
phpMyAdmin（または SSH の mysql）で `2026-11-04_security_log.sql` を流す。何度流しても同じ結果です。
- 最後の確認で `security_log_rows` が 0、`last_login_at`・`last_logout_at` の2行が出ればよい

SSH で流すとき（`-p` だけにして、パスワードは聞かれてから入力）:
```bash
mysql --default-character-set=utf8mb4 -h MYSQLホスト名 -u MYSQLユーザー名 -p DB名 < 2026-11-04_security_log.sql
```

### 手順2　【② VPS で実行】再ビルド
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
dcp build express-api
```
```bash
dcp up -d express-api
```
確認（トークンなし。② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"security_log_list"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ 404 なら production に v2.2.242 が入っていない（手順0を確かめる）。

### 手順3　【① FTP】PHP 6ファイル（⚠️ この順で）
⚠️⚠️ **`core/security_log.php` を必ず最初に上げてください。** ほかの5ファイルはこれを読み込むので、先にほかのファイルを上げると、**すべての画面が止まります**（PHP の致命的エラー）。

| 順 | ① の場所 | 元のファイル |
|---|---|---|
| 1 | `/dashboard/api/gateway/core/security_log.php`（新規） | `backend/src/core/security_log.php` |
| 2 | `/dashboard/api/gateway/core/authz.php` | `backend/src/core/authz.php` |
| 3 | `/dashboard/api/gateway/core/express_proxy.php` | `backend/src/core/express_proxy.php` |
| 4 | `/dashboard/api/gateway/handlers/login.php` | `backend/src/handlers/login.php` |
| 5 | `/dashboard/api/gateway/handlers/logout.php`（新規） | `backend/src/handlers/logout.php` |
| 6 | `/dashboard/api/gateway/index.php` | `backend/src/index.php` |

確認（トークンなし。① を通す）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"security_log_list"}'
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"logout"}'
```
⚠️ どちらも `認証が必要です。`（401）ならよいです。
- `security_log_list` が `該当する処理がありません`（404）なら、express_proxy.php が古いです。
- `logout` が 404 なら、logout.php が上がっていません。
- 何も返らない（真っ白・500）なら、security_log.php が上がっていません。すぐに上げてください。

### 手順4　【① フロント】いつもの手順

### 手順5　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-04_update_log_2.2.242.sql` を **1回だけ**流す。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.242 で1行だけならよい。

## 終わったら（動作確認）
PC で、マスター権限で:
1. ヘッダーの「システム管理 → セキュリティログ」を開く
   - 手順3の確認で送った2件が「認証の失敗」として出ていればよいです（IP はコマンドを打ったパソコンの IP）。
   - ⚠️ **IP が全部同じ値（レンタルサーバー自身の IP）になっていないか**も見てください。そうなっていたら、① で本当の接続元が取れていないので連絡してください。
2. 右上のパネルの名前の右に、ログアウトのアイコンが出る
   - 押して「OK」でログイン画面に戻り、「ログアウトしました。」と出る。
   - もう一度「Google でログイン」から入れる。
   - セキュリティログに「ログアウト」と「ログイン」が出る。
3. マネージャーなど管理者でない人では、「システム管理」に「セキュリティログ」が出ない
4. 版の表示が ver2.2.242

## 注意
- ⚠️ ログアウトすると、**同じ人がほかの端末で開いている Dashboard も**、次に画面を移ったときにログイン画面に戻ります（ログインしている状態は1人に1つのため。今までの「別の端末でログインすると前の端末が落ちる」と同じ仕組みです）。
- ⚠️ スマホにはログアウトのボタンがありません（右上のパネルは PC だけ）。
- 記録は180日で自動的に消えます。

## 切り戻し
- 画面だけ戻す：① のフロントを v2.2.241 に戻す
- 記録を止める：① の PHP 6ファイルと ② を v2.2.241 に戻す
  - v2.2.241 の PHP は security_log.php を読み込まないので、戻す順番は問いません。security_log.php と logout.php は残しておいても問題ありません。
- 表と列は残してかまいません（使われなくなるだけ）。
