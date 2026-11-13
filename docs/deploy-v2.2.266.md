# デプロイ手順 v2.2.266　画面のアクセス記録・「ポータル連携ログ」・広告運用 API の顧客

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `staff_access_log` を作る | ① DB `backend/scripts/sql/2026-11-13_staff_access_log.sql` |
| 2 | `access_log`（画面を開いた記録）・`access_log_list`（一覧。Master）・`heartbeat`（① から移した。staff.log に書かない）・13か月より古い記録を毎日消す | ② VPS（backend-express） |
| 3 | 広告運用 API：`/api/export/tracking/conversions` をやめ、`/api/export/tracking/customers`（注文・建売の顧客のうち landing_params のあるもの）を足す | ② VPS（backend-express） |
| 4 | `express_proxy.php`（access_log・access_log_list・heartbeat を ② へ）、`heartbeat.php`（予備。staff.log に書かない） | ① PHP |
| 5 | 画面を移るたびに記録を送る（ActiveUser）、「システム管理 → アクセス記録」、「同期の実行結果」→「ポータル連携ログ」 | ① フロント（Dashboard） |
| 6 | 更新履歴・業務ガイドの記事3本（ポータル連携ログ〔改名〕・ヘッダーのメニュー・アクセス記録） | ① DB `backend/scripts/sql/2026-11-13_update_log_2.2.266.sql` |

- ⚠️ `staff.log` の今のデータは消しません（次の版で、バックアップを取ってから空にする予定）。
- 広告運用エンジニアに渡す仕様書が変わりました：`docs/api-tracking-export.md`（conversions の代わりに customers。ビジターIDで突き合わせて顧客の KPI を出す手順つき）。

## 順序
```
0. GitHub で v2.2.266 を production へマージ（PR）
1. ① SQL：2026-11-13_staff_access_log.sql            ← ② より先（表が無いと記録が書けない）
2. ② VPS：git pull → 作り直し
3. ① PHP：express_proxy.php・handlers/heartbeat.php
4. ① Dashboard のフロント（npm run build）
5. ① SQL：2026-11-13_update_log_2.2.266.sql           ← ⚠️ 1回だけ
```
- 3 より先に 4 を上げると、① が `access_log` を知らないので記録が 404 になります（画面は止まりません。3 を上げれば直ります）。

### 手順1　【① SQL】
phpMyAdmin で `2026-11-13_staff_access_log.sql` を流します（何度流しても安全）。最後に `staff_access_log` が1行出ればよいです。

### 手順2　【② VPS】
```bash
cd ~/dashboard && git pull
dcp up -d --build express-api
dcp ps express-api
```
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `dcp` を使うこと（`docker compose -f docker-compose.prod.yml` だけだと `.env.prod` が渡らず ② が起動しない）。
```bash
dcp logs express-api | grep -E "access_log|heartbeat"
```
- 起動時のルートの一覧に `access_log:open`・`access_log_list`・`heartbeat` が出ればよいです。

### 手順3　【① PHP】
サーバーパネルのファイルマネージャー（または FTP）で次の2つを上書きします。
- `backend/src/core/express_proxy.php`
- `backend/src/handlers/heartbeat.php`

### 手順5　【① SQL】
phpMyAdmin で `2026-11-13_update_log_2.2.266.sql` を **1回だけ**流します（先頭で「同期の実行結果」の記事のタイトルを変えてから、記事を上書きします）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT id, title FROM guide_article WHERE title IN ('ポータル連携ログ', '同期の実行結果', 'アクセス記録');
```
- 1つ目は一番上が 2.2.266 で1行だけ。2つ目は「ポータル連携ログ」「アクセス記録」の2行で、「同期の実行結果」が無ければよいです。

## 終わったら（動作確認）
1. Dashboard の版の表示が ver2.2.266
2. いくつか画面を移ってから、「システム管理 → アクセス記録」（Master）を開く：自分の名前と、開いた画面が出る。20秒以上いた画面は滞在時間が出る
3. 右上の「アクティブ」に自分が出ている（heartbeat が ② で動いている）
4. 「システム管理」に「ポータル連携ログ」があり、「同期の実行結果」が無い
5. ① の phpMyAdmin で、staff.log が増えていないこと（任意）：
   ```sql
   SELECT id, LENGTH(log) FROM staff WHERE id = <自分の id>;
   ```
   数分おいてもう一度流し、長さが変わらなければよいです。
6. 広告運用 API（鍵は v2.2.265 で入れたもの）：
   ```bash
   read -s KHG_TRACKING_KEY && export KHG_TRACKING_KEY
   curl -s -H "Authorization: Bearer $KHG_TRACKING_KEY" 'https://api.khg-marketing.info/api/export/tracking/customers?category=order&limit=2'
   curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $KHG_TRACKING_KEY" 'https://api.khg-marketing.info/api/export/tracking/conversions'
   ```
   1つ目が `{"data":[…]}`（氏名・電話・メールが無い）、2つ目が `404` ならよいです。

## 切り戻し
- フロントを前の版に戻すと、記録は送られなくなります（heartbeat は ① に戻る。① の heartbeat.php は新しいもののままでよい）。
- ② を前の版に戻すと、`access_log` は 502/404 になります（画面は止まりません）。heartbeat は ① の予備が受けます。広告運用 API は conversions に戻ります（エンジニアに知らせる）。

## 知っておくこと
- 記録は1日に「人数 × 画面を移った回数」行（100人 × 100回で約1万行）。13か月より古い行は ② が毎日消します。
- 滞在時間は「開いてから最後の heartbeat（20秒ごと）まで」のおおよその時間です。
- 広告運用 API の customers の列の決め方（初回来場日・建売の契約日はメモと違う列にした理由）は `docs/task-2026-11-13-03-tracking-export-customers.md` の冒頭。
