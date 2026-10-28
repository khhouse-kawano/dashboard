# デプロイ手順 v2.2.222　不動産企画係アプリの移植（第2段：チームサマリーを実データに）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | brokerage_listings に商談の項目を4つ追加（リフォーム受注額・リフォーム粗利・リフォームの内容・商談リストの登録日） | ① DB `backend/scripts/sql/2026-10-28_brokerage_listings_reform.sql` |
| 2 | チームサマリーの元データに商談案件・媒介台帳を足す。保存できる項目に上の4つを足す | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 3 | ① の予備（同じ変更） | ① PHP 2ファイル |
| 4 | チームサマリーの年間予算進捗・月次KPI・架電実績・朝礼用アラートを実データに | ① フロント（いつもの手順） |
| 5 | 更新履歴・業務ガイドの記事「チームサマリー（不動産企画係）」 | ① DB `backend/scripts/sql/2026-10-28_update_log_2.2.222.sql` |

⚠️ v2.2.221 のデプロイが済んでいること。

## 順序
```
0. GitHub で v2.2.222 を main → production へマージ
1. ① SQL（列の追加）           ← ⚠️ 2 より先（② が新しい列を保存するため）
2. ② 再ビルド                  ← ⚠️ 実行中の Claudeによる分析が無いときに
3. ① PHP（2ファイル）
4. ① フロント
5. ① SQL（更新履歴・ガイド）
```

## 手順1　【① phpMyAdmin】列の追加
ファイル: `backend/scripts/sql/2026-10-28_brokerage_listings_reform.sql`（何度流しても同じ）

確認:
```sql
SHOW COLUMNS FROM brokerage_listings WHERE Field IN ('reformPrice','reformGp','reformNote','createdAt');
```
4行出ればよい。

## 手順2　【② VPS で実行】再ビルド
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

## 手順3　【① FTP】PHP
アップロード（`/dashboard/api/gateway/` の下）:
- `handlers/plannerAction/planner_summary.php`（商談案件・媒介台帳も返す）
- `handlers/brokerAction/broker_update.php`（保存できる項目に4つ追加）

## 手順4　【① フロント】いつもの手順
## 手順5　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-28_update_log_2.2.222.sql`

## 終わったら（動作確認）
1. 不動産企画係でチームサマリーを開く。対象月の選択肢が今期の12か月（「全期間」は無い）
2. 年間予算進捗に「累計 ¥… ／ 予算 ¥…」と遅れ・先行の表示が出る
3. 月次KPIサマリーの担当者・目標が以前のアプリの設定と同じで、今月見込の売上・契約件数・媒介獲得が出る
4. **以前のアプリ（khf-eigyokanri.netlify.app）のダッシュボードと、同じ月で見比べる**
   - ⚠️ 商談案件・媒介台帳は 9/2 に移したあとの以前のアプリでの入力が Dashboard に入っていないため、**最近の月はずれてよい**。9/2 より前の月（2026年6〜8月）が一致すること
5. 架電実績・朝礼用アラートが出る（該当が無ければ「該当なし」）
