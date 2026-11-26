# デプロイ手順 v2.2.301　物件DB・SUUMO物件サマリーを GET（②）で・物件DB をポータルで補う

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「物件DB」「テーブル定義書」・**新しい表 `table_definition`・`column_definition` と、その中身（全テーブルの説明）** | ① DB `backend/scripts/sql/2026-11-25_update_log_2.2.301.sql` |
| 2 | 新しい request：`property_list`・`property_detail`・`property_suumo_latest`（GET。画面用。スタッフ）、`property_db_portal`（sync 用。合い言葉 SYNC_LOG_SECRET）、**`table_definition`（GET。テーブル定義書。Master だけ）** | ② VPS（features/propertyGet.ts・features/propertyPortal.ts・**features/tableDefinition.ts**（新規）・gateway/registry.ts・middlewares/publicFormRateLimit.ts） |
| 3 | 上の画面用の4つを GET で受けて ② へ転送する。予備の `property:list` が、画面の使っていない架電記録・家族情報・媒体の全件を返すのをやめる（① のメモリ不足の原因） | ① PHP `backend/src/core/db.php`・`backend/src/core/express_proxy.php`・`backend/src/handlers/propertyAction/property_list.php` |
| 4 | 物件DB・詳細・SUUMO物件サマリーを GET で読む（② に届かないときは今までの POST）。見た目を顧客DB のカードに。ページ数の不具合を直す。SUUMO の取得日を URL（?date=）に。**システム管理に「テーブル定義書」（Master だけ・閲覧のみ）** | Dashboard（frontend の build） |
| 5 | summary の6つの処理が、① への送信のあとに ② の property_db_portal へも送る | sync（Heroku）ブランチ `away/20261125-property-db` |

- ⚠️ v2.2.300 までを先に済ませてください。表の変更はありません。
- ⚠️ ① PHP（手順4）は ② のあとに上げてください。先に上げると ② に無い request を転送して 502 になります（画面は今までの POST に切り替わるので開けます）。
- ⚠️ sync（手順6）は ② のあとに上げてください。先に上げると ② が property_db_portal を知らず、summary のたびに「物件DB を補えませんでした」のエラーメールが届きます（summary 自体は今までどおり更新されます）。
- 物件DB の考え方（ポータルだけで代われるか・列の対応・書き換えの決まり）は `docs/property-db-portal.md`。
- テーブル定義書の原稿は `backend/scripts/tabledef/tables/*.md`（1テーブル1ファイル）。SQL は `build-tabledef-sql.cjs` で作り、手順2の SQL の末尾に入っています。これからはテーブルを変える版ごとに、その版の SQL に定義書の分が入ります（CLAUDE.md「テーブル定義書」）。

## 先に（夜間モードの解除）
この版は夜間モード（離席モード）で作りました。夜間モードのままだと push・設定の書き換えが断られるので、デプロイの前に解除します。
1. `C:\Users\shinji-kawano\.claude\settings.json` から次の2つを手で消す（ほかの設定は残す。その前の行 `"theme": "auto",` の最後のカンマも消す）
   ```json
     "permissions": {
       "denyInsteadOfPrompting": true
     },
     "autoContinueAtUsageLimit": true
   ```
2. VS Code を再読み込みする（コマンドパレット →「ウィンドウの再読み込み」）。⚠️ 同じセッションでは、一度断られた操作は断られ続ける
3. 2つのブランチを push する
   ```bash
   git -C /c/Users/shinji-kawano/react/dashboard push -u origin v2.2.301
   git -C /c/Users/shinji-kawano/projects/sync push -u origin away/20261125-property-db
   ```

## 順序
```
1. GitHub で v2.2.301 を production へマージ（PR）
2. ① SQL：2026-11-25_update_log_2.2.301.sql   ← ⚠️ 1回だけ
3. ② VPS
4. ① PHP：db.php・express_proxy.php・propertyAction/property_list.php をアップロード
5. Dashboard の画面を build してアップロード
6. sync：away/20261125-property-db を main にマージして Heroku へ
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-25_update_log_2.2.301.sql
```
- 表を2つ作り（`CREATE TABLE IF NOT EXISTS`）、全テーブルの説明を入れます。ファイルが大きい（説明が約4,000行）ので、phpMyAdmin で流すときは「インポート」から入れてください。
- 確認：
  ```sql
  SELECT COUNT(*) FROM table_definition;
  SELECT COUNT(*) FROM column_definition;
  ```

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
- `git log` が v2.2.301 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。
- ② の `SYNC_LOG_SECRET` はもう設定済みのはずです（sync の実行ログ・SUUMO の反響と同じ）。確認：
  ```bash
  curl -s -X POST -H 'Content-Type: application/json' -d '{"request":"property_db_portal","key":"x","portal":"homes","account":"spec","rows":[]}' https://api.khg-marketing.info/api/gateway
  ```
  `合い言葉が正しくありません`（401）なら届いています。

### 手順4　【① PHP】
`backend/src/core/db.php`・`backend/src/core/express_proxy.php`・`backend/src/handlers/propertyAction/property_list.php` をアップロードします。

確認（トークン無しで 401 なら ② まで届いています。400 なら db.php、404 なら express_proxy.php が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=property_list&category=spec'
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=property_detail&id=1'
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=property_suumo_latest'
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=table_definition'
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/DatabaseProperty.tsx`
  - `src/components/database/PropertySummary.tsx`
  - `src/components/database/SuumoPropertySummary.tsx`
  - `src/components/header/system/TableDefinition.tsx`（新規）
  - `src/components/header/headerScreens.tsx`
  - `src/components/guide/guideScreens.ts`
  - `src/utils/version.ts`

### 手順6　【sync（Heroku）】
sync のリポジトリで、`away/20261125-property-db` を確かめてから main に入れて Heroku へ送ります（dist もコミット済みです）。
```bash
git switch main
git merge away/20261125-property-db
git push origin main
git push heroku main
```
- ⚠️ Heroku の Config Vars に `SYNC_LOG_SECRET` があること（sync の実行ログで使っているので、あるはずです）。
- 次の summary の実行のあと、Heroku のログに `[物件DB homes/spec] {"updated":…,"inserted":…}` のような行が出ればよいです。

## 終わったら（動作確認）
1. 建売の「物件DB」を開く。件数・表がこれまでと同じで、開くのが速い（ブラウザの開発者ツールで `request=property_list&category=spec` の GET が出て、`property` の POST が出ない）。
2. 絞り込み（店舗・ランク・住所・自社物件・契約済み）と並べ替えが今までどおり。絞り込むと1ページ目に戻り、ページ数が絞り込んだ件数に合う。
3. 「詳細」を開くと、物件・ポータル・問い合わせたお客様が今までどおり出る。
4. 「SUUMO掲載順位」で最新の日が出る。前の日を選ぶとその日の順位に変わり、アドレスに `?date=` が付く。閉じると消える。
5. 不動産企画係の「掲載物件一覧」でも 1〜4 が同じように動く。
6. Master で「システム管理 → テーブル定義書」を開く。左にテーブルの一覧が出て、押すと右に列（型・説明）が出る。検索に列名（例 `property_name`）を入れると、その列を持つテーブルに絞れる。Master 以外のメニューには出ない。
   - 上の「未記載」が 0 でないときは、本番にだけあるテーブルです（ローカルの写しに無い）。次の版で原稿を足します。

## 切り戻し
- 画面：前の build に戻せば、今までの POST で読みます（① の property_list.php は架電記録などを返さなくなっていますが、画面は使っていないので影響はありません）。
- sync：Heroku で前のリリースに戻す（`heroku releases:rollback`）。物件DB に作った物件・埋めた列は残ります（作った物件は `SELECT property_id FROM property_db WHERE registered = …` などで見分けられます。消すときは相談してください）。
