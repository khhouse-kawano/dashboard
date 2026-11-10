# デプロイ手順 v2.2.260　いえらぶの物件一覧（CSV）を Dashboard で取り込む

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | CSV の取り込みの口（`planner:ielove_import`・`planner:ielove_import_status`） | ② VPS（backend-express） |
| 2 | 上の2つを ② へ転送する許可リスト | ① PHP `backend/src/core/express_proxy.php` |
| 3 | 不動産企画係の「設定・データ管理」に「いえらぶの物件一覧を取り込む（CSV）」 | ① フロント（Dashboard） |
| 4 | 更新履歴・業務ガイドの記事「設定（不動産企画係）」 | ① DB `backend/scripts/sql/2026-11-10_update_log_2.2.260.sql` |

- ⚠️ **DB の表は変わりません**（`property_db` に書くだけ）。
- `projects/sync`・GAS は変わりません。

## 順序
```
0. GitHub で v2.2.260 を production へマージ（PR）
1. ② VPS（backend-express）を更新して再起動
2. ① PHP：backend/src/core/express_proxy.php を上げる
3. ① Dashboard のフロント
4. ① SQL：2026-11-10_update_log_2.2.260.sql      ← ⚠️ 1回だけ
```

### 手順1　【② VPS】backend-express を更新
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
確認（② に直接。トークン無し）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"planner","roll":"ielove_import_status"}'
```
- `認証が必要です。`（401）ならよいです。

### 手順2　【① PHP】express_proxy.php
`backend/src/core/express_proxy.php` を、サーバーの `dashboard/api/gateway/core/express_proxy.php` に上げます（上書き）。
確認（トークンなし。① 経由）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"ielove_import_status"}'
```
- `認証が必要です。`（401）ならよいです。404 なら express_proxy.php が古いままです。

### 手順3　【① Dashboard のフロント】いつもの手順
v2.2.260 のブランチで `npm run build` をし直してから上げてください。

### 手順4　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-10_update_log_2.2.260.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.260 で、1行だけならよいです。

## 終わったら（動作確認）
1. 不動産企画係の左のメニュー「設定・データ管理」を開く → 「いえらぶの物件一覧を取り込む（CSV）」のカードに、今の件数と「最後に取り込んだ日」が出る
2. いえらぶ cloud の「売買物件一覧」で、店舗ごとに「一覧をダウンロード → CSV」をして、ファイルを選ぶ
   - 3店舗（86679・96031・150319）の分を、まとめて選べます
3. 件数（新しい物件・更新・価格の変更）を確かめて「取り込む」→「取り込みました」と、台帳・買い反響の新しいつながりの件数が出る
4. 媒介獲得台帳の「ポータル連携（いえらぶ）」の札が増えている（中古住宅専門店の物件があれば）
5. Dashboard の版の表示が ver2.2.260

## 知っておくこと
- 書き方は、以前の sync（① の `property_db_update.php`）と同じです。物件番号で上書きし、価格が変わったら価格の履歴に足します。
  - ⚠️ ただし、**CSV に無い列は上書きしません**（利用者の決定）。いえらぶで出力の項目を減らしても、ほかの列の値は消えません。
- いえらぶに無くなった物件は消しません。
- ⚠️ sync の `property`（runIeloveProperty.ts）は、Heroku からだと毎回 403 で失敗し、「同期の実行結果」に失敗として残ります。sync を定期に呼んでいる側の `targetTasks` から `property` を外してください。
- 本番の `property_db` の最後の取り込み日（`SELECT MAX(registered) FROM property_db;`）以降の変更は、最初の取り込みでまとめて入ります。

## 切り戻し
- フロントと ② を前の版に戻すと、カードが消えるだけです。取り込んだ物件はそのまま残ります（以前の sync と同じ形の値）。
