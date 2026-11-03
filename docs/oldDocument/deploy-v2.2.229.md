# デプロイ手順 v2.2.229　個人情報削除を「削除済み」の印に（顧客DB から外し、集計には残す）／タブの名前

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 顧客の表 3つに `delete_dashboard` 列を追加。v2.2.227〜228 で削除した顧客を「削除済み・集計に数える」に直す | ① DB `backend/scripts/sql/2026-10-29_master_delete_dashboard.sql` |
| 2 | 個人情報削除が `delete_dashboard = 1` に。顧客DB（注文・建売）・顧客詳細・保存・媒介の顧客選びで削除済みを除く。集計の行に `delete_dashboard` を付ける | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 3 | 中古の顧客DB・過去の顧客・媒介の顧客選び・顧客詳細（控え）・保存（ファイル付き）で削除済みを除く | ① PHP 9ファイル（下） |
| 4 | 集計の一覧で「削除済み顧客」、店舗別反響推移の一覧を共通の部品に、タブの名前「Dashboard - KHG」 | ① フロント（いつもの手順） |
| 5 | 更新履歴・業務ガイドの記事10本（修正） | ① DB `backend/scripts/sql/2026-10-29_update_log_2.2.229.sql` |

## 順序
```
0. GitHub で v2.2.229 を main → production へマージ
1. ① SQL（列の追加）              ← ⚠️ 最初に。② が delete_dashboard を読むので、先に ② を上げると顧客DB・集計が 500 になる
2. ② 再ビルド                      ← ⚠️ 実行中の Claudeによる分析が無いときに
3. ① PHP（9ファイル）              ← ⚠️ 1 より後（列が無いと中古の顧客DB が落ちる）
4. ① フロント
5. ① SQL（更新履歴・ガイド）
```

### 手順1　【① phpMyAdmin】列の追加と、削除済みの直し
ファイル: `backend/scripts/sql/2026-10-29_master_delete_dashboard.sql`
- ⚠️ 大きい表に列を足すので、流し終わるまで少し時間がかかる（ローカルでは約2分）
- 途中の確認（2)）で、直す顧客の数が表ごとに出る（v2.2.227〜228 で個人情報削除をした数）
- 最後の確認（4)）で、`deleted` が 2) の数と同じならよい
- ⚠️ 2回流しても壊れない（列は IF NOT EXISTS、直すのは まだ非表示で印の無い顧客だけ）

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

### 手順3　【① FTP】PHP 9ファイル
アップロード（`/dashboard/api/gateway/` の下）:
- `handlers/databaseAction/database_order.php`・`database_spec.php`・`database_used.php`
- `handlers/informationAction/information_order.php`・`information_spec.php`・`information_used.php`・`customer_info.php`
- `handlers/brokerAction/broker_customer.php`
- `handlers/past_customer.php`

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"database","category":"spec"}'
```
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"shopTrend","category":"spec"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ 502・500 なら手順1 か 2 が済んでいない。

### 手順4　【① フロント】いつもの手順
⚠️ `index.html` も上がること（タブの名前）。

### 手順5　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-29_update_log_2.2.229.sql`

## 終わったら（動作確認）
- ブラウザのタブの名前が「Dashboard - KHG」（キャッシュで古いときは Ctrl+F5）
- 顧客DB に「********」の顧客が出ない
- 店舗別反響推移・店舗・担当別反響・全社報告用フォーマットで数を押した一覧に、削除済みの顧客が「削除済み顧客」と灰色で出て、押しても開かない
- 削除済みの顧客がいる月の数が、v2.2.228 のときより増えている（削除で減っていた分が戻る）

## 注意
- ⚠️ 個人情報削除は元に戻せない（v2.2.227 から変わらない）
- ⚠️ ② が落ちて ① が代わりに応答している間は、集計の一覧で削除済みの顧客の名前の欄が「********」のまま出る（押すと「開けません」と出る）。② が戻れば直る
