# デプロイ手順 v2.2.311　建売営業のメニューに「土地仕入」（仕入KPI管理 v7.3 の移行）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 土地仕入のテーブル16個（land_*）と初期値（エリア・KPI の定義・選択肢・設定） | ① DB `backend/scripts/sql/2026-11-27_land_acquisition_tables.sql` |
| 2 | 更新履歴1行・業務ガイド9本（土地仕入の流れ／仕入ダッシュボード／日次・アプローチ／仕入案件一覧／業者マスタ／仕入設定／仕入分析／個人別実績／目標・月次入力。すべて（建売営業））・テーブル定義書16テーブル | ① DB `backend/scripts/sql/2026-11-27_update_log_2.2.311.sql` |
| 3 | 新しい request：読み込み（GET）13個 `land_master` `land_summary` `land_analysis` `land_targets` `land_review` `land_settings_data` `land_deal_list` `land_deal_get` `land_vendor_list` `land_vendor_get` `land_approach_list` `land_daily` `land_staff_candidates`、書き込み（POST）`land:` の `deal_save` `deal_delete` `vendor_save` `vendor_delete` `approach_save` `approach_delete` `daily_save` `report_save` `member_save` `target_save` `manual_save` `review_save` `setting_save` `stock_save` `option_save` `source_save` `kpi_save` `import`（import だけ Master）。担当事業が spec・all の人だけ | ② VPS（features/landAcquisition/（新規）・gateway/registry.ts） |
| 4 | GET の許可リストと、② へ送るリスト2つに上の request | ① PHP `backend/src/core/db.php`・`backend/src/core/express_proxy.php` |
| 5 | 建売営業のメニューを「建売営業」「土地仕入」に分ける。土地仕入：仕入ダッシュボード・日次・アプローチ・仕入案件一覧・業者マスタ・仕入分析・個人別実績・目標・月次入力・仕入設定（PC だけ）。案件・業者・アプローチの CSV の書き出し、業者のテキストからの自動抜き出し、ダッシュボード・分析の印刷 | Dashboard（frontend の build） |

- 移していないもの：資料（図面などの添付）・Excel／CSV の取り込み（過去データの一括読み込み）。資料は仕入KPI管理に残ります。

- ⚠️ v2.2.310 を先に済ませてください。
- ⚠️ 手順2（テーブル）を手順3（update_log の SQL）より先に。update_log の SQL の末尾にテーブル定義書の SQL が入っていて、テーブルが無いと説明が付きません。
- ⚠️ ① PHP（手順5）は ② のあとに。先に上げると、② に無い request を転送して 502 になります（メニューの画面が「読み込めませんでした」になるだけで、ほかの画面には影響しません）。
- ⚠️ 移行元（仕入KPI管理）のデータは、デプロイしただけでは入りません。手順7で Master が取り込みます。

## 順序
```
1. GitHub で v2.2.311 を production へマージ（PR）
2. ① SQL：2026-11-27_land_acquisition_tables.sql   ← 何度流しても壊れない
3. ① SQL：2026-11-27_update_log_2.2.311.sql         ← ⚠️ 1回だけ
4. ② VPS
5. ① PHP：db.php・express_proxy.php をアップロード
6. Dashboard の画面を build してアップロード
7. 仕入KPI管理のデータを取り込む（Master）
```

### 手順2・3　【① SQL】
```bash
mysql < 2026-11-27_land_acquisition_tables.sql
mysql < 2026-11-27_update_log_2.2.311.sql
```
```sql
SHOW TABLES LIKE 'land%';
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT COUNT(*) FROM land_option;
```
- `land%` が16個、`land_option` が62件ならよいです。

### 手順4　【② VPS】
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
- `git log` が v2.2.311 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順5　【① PHP】
`backend/src/core/db.php`・`backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで 401 なら ② まで届いています。400 なら db.php、404 なら express_proxy.php が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=land_master'
```

### 手順6　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 新しいファイル：`src/components/landAcquisition/`（LandMenu・LandRoute・LandDashboard・LandAnalysis・LandMember・LandTargets・LandDaily・LandDeals・LandDealModal・LandVendors・LandVendorModal・LandSettings・LandSettingsMore・LandParts・landApi・landLogic・landStyle・landCsv・vendorExtract）
- 変えたファイル：`src/App.tsx`・`src/components/Menu.tsx`・`src/components/guide/guideScreens.ts`・`src/utils/version.ts`

### 手順7　【仕入KPI管理のデータを取り込む】（Master）
1. 仕入KPI管理（https://khf-shiire-kpi.netlify.app/ ）を開き、「設定・データ → 書き出し・バックアップ」で JSON を書き出す
2. Dashboard で建売営業に入り、「土地仕入 → 仕入設定」の「移行元（仕入KPI管理）から取り込む」でその JSON を選ぶ
3. 件数（案件・業者・アプローチなど）が仕入KPI管理と合っているかを見てから「取り込む」を押す
4. 「担当者」の表で、Dashboard のスタッフとの結び付けを確かめる（名前で1人に決まる人は自動で結び付く。決まらない人は選ぶ）
- ⚠️ 取り込むと、土地仕入の記録はそのファイルの内容に入れ替わります。Dashboard で記録を始める前に1回だけにしてください。
- ⚠️ 資料（図面など）は取り込みません（v2.2.313 で移す予定）。

## 終わったら（動作確認）
1. 建売営業のメニューに「建売営業」「土地仕入」の見出しが出る。注文営業・中古リノベには出ない
2. 仕入ダッシュボード：カード6枚の実績が、仕入KPI管理の同じ月・同じ担当と同じ数になる（チーム全員・1人・エリアの合算で1つずつ）
3. 仕入案件一覧：30件出て、下までスクロールすると次の30件。件数が仕入KPI管理の案件一覧と同じ
4. 業者マスタ：社数が仕入KPI管理と同じ
5. 日次・アプローチ：自分が選ばれて開く（結び付けたスタッフでログインしたとき）
6. 仕入分析：ボトルネック診断・ヒートマップの色が、仕入KPI管理のダッシュボードと同じ月で同じになる
7. 目標・月次入力：取り込んだ月間目標・年間目標が出る

## 切り戻し
- 画面：前の build に戻せば、メニューから消えます。
- ② ：前のコミットに戻せば、land_* の request が無くなるだけです（ほかの画面に影響しません）。
- ① PHP：足しただけなので、戻さなくても影響はありません。
- テーブル：残しても影響はありません（消すときは、取り込んだ記録が消えることを確かめてから）。
