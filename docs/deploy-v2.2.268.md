# デプロイ手順 v2.2.268　レポートの共有（ログインした人だけが見られるURL）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `shared_report` を作る・更新履歴・業務ガイドの記事（新規「共有レポート」、「Claudeによる分析」「ヘッダーのメニュー」を更新） | ① DB `backend/scripts/sql/2026-11-13_update_log_2.2.268.sql` |
| 2 | 共有の処理 `shared_report_create`・`_get`・`_list`・`_revoke` | ② VPS（backend-express） |
| 3 | 上の4つを ② へ通す許可リスト | ① PHP `backend/src/core/express_proxy.php` |
| 4 | 「Claudeによる分析」の「共有」ボタン、共有URLの画面 `/report?k=…`、「システム管理 → 共有レポート」、版の表示 2.2.268 | ① フロント（Dashboard） |

- ⚠️ `.env.prod` の変更はありません。

## 順序
```
0. GitHub で v2.2.268 を production へマージ（PR）
1. ① SQL：2026-11-13_update_log_2.2.268.sql      ← ⚠️ 1回だけ。⚠️ 表が無いと ② の共有が 500 になるので先に
2. ② VPS：fetch・checkout → 作り直し
3. ① PHP：backend/src/core/express_proxy.php
4. ① Dashboard のフロント（npm run build）
```

### 手順1　【① SQL】
phpMyAdmin で `2026-11-13_update_log_2.2.268.sql` を **1回だけ**流します。
```sql
SHOW TABLES LIKE 'shared_report';
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT id, title, updated_at FROM guide_article WHERE title IN ('共有レポート', 'Claudeによる分析', 'ヘッダーのメニュー');
```
- `shared_report` が1行、`update_log` の先頭が 2.2.268、記事が3行出ればよいです。

### 手順2　【② VPS】
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
dcp logs express-api | grep shared_report
```
- `git log` が v2.2.268 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ログの登録一覧に `shared_report_create`・`shared_report_get`・`shared_report_list`・`shared_report_revoke` の4つが出ればよいです。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順3　【① PHP】
`backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで 401 なら ② まで届いています。404 なら許可リストの漏れ）：
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -H 'Authorization: 4081Kokubu' -d '{"request":"shared_report_get"}'
```

### 手順4　【① フロント】
いつもどおり `npm run build` してアップロードします。

## 終わったら（動作確認）
1. 「Claudeによる分析」で完了したレポートを開き、「HTMLをダウンロード」の右の「共有」を押す → 緑の帯にURLが出る
2. そのURLを、別のブラウザ（ログインしていない）で開く → ログイン画面 → ログインするとレポートが開く
3. 「システム管理 → 共有レポート」に、その共有が出て、開かれた回数が増えている
4. （Master）同じ画面で HTML ファイルを登録 → URL が出る。「止める」を押すと、そのURLは「共有は止められました」になる

## 切り戻し
- フロントを前の版に戻すと、ボタンと画面が消えます（共有URLも開けなくなります）。
- ② を前の版に戻すと、共有の処理は 404 になります。表 `shared_report` は残しておいて問題ありません。

## 知っておくこと
- 共有URLは `https://<Dashboard>/dashboard/report?k=<22文字>`。キーは 128bit の乱数で推測できません。そのうえ、見るにはログインが必要です。
- ログインしていれば、**権限・事業に関係なく誰でも**見られます（2026-11-13 の決定）。
- 共有できる人：Claudeによる分析は実行した本人と Master。HTML の登録は Master だけ（5MB まで）。止められるのは共有した本人と Master。
- 共有した時点の HTML を写して保存します。元の分析を消しても見られます。止めると HTML も消します。
- 期限はありません（止めるまで見られます）。
- レポートは iframe（sandbox="allow-scripts"）の中で表示するので、レポートのスクリプトからログイン情報は読めません。
