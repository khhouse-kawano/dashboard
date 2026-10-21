# デプロイ手順 v2.2.203（アクセス解析：詳細のモーダル・Meta 広告の取り込み・ページの閲覧の記録）

⚠️ v2.2.202 は main にマージ済み。このブランチは main から切ってある。
⚠️ このブランチには、中古住宅専門店の資料請求の GAS（`backend/scripts/gas/runCatalogResale.gs`）の改修も入っている（アプリのデプロイとは別。GAS のエディタに貼る）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `meta_ad_items`・`meta_ad_daily`・`tracking_pageviews`・`tracking_keep_visitors`（新規） | ① DB |
| 2 | `.env.prod` に `META_ACCESS_TOKEN`・`META_AD_ACCOUNTS` を足す | ⚠️ **② VPS（手作業）** |
| 3 | Meta の取り込み（6時間ごと）・閲覧の受け口・整理（6時間ごと）・詳細の request・tracker.js | ⚠️ **② VPS（再ビルド）** |
| 4 | ① の転送リストに `tracking_detail`・`meta_ads_import` | ① PHP（`backend/src/core/express_proxy.php`） |
| 5 | メニュー名「アクセス解析」・詳細のモーダル・Meta の行・画面の版 | ① フロント（dashboard） |
| 6 | 更新履歴 ＋ 記事のタイトル変更 ＋ 記事2本 | ① DB |

- ⚠️ 各サイトのタグ・GTM は**変更なし**（tracker.js は ② から配信。1時間以内に行き渡る）。
- ⚠️ tracker.js が新しくなると、ページを開くたびに `/api/track/pv` へ送り始める。**表（手順1）を先に作ること。**

## 順序
```
0. GitHub で v2.2.203 を main → production へマージ
1. ① DB：表を作る（2つのファイル）
2. ② .env.prod に2行足す
3. ② 再ビルド          ← ⚠️ 1・2 の後
4. ① PHP
5. ① フロント          ← ⚠️ 3・4 の後
6. ① SQL（更新履歴 ＋ 記事）
```
- ⚠️ 3 を 1 より先にすると、閲覧の受け口と整理・Meta の取り込みがログに失敗を出す（サイトの表示には影響しない）。
- ⚠️ 5 を 4 より先にすると、詳細を開いたとき「詳細を読み込めませんでした」になる。

## 手順1　【① phpMyAdmin】表を作る
ファイル（どちらも何度流しても安全）:
1. `backend/scripts/sql/2026-10-21_meta_ad_tables.sql` → 最後に `meta_ad_items`・`meta_ad_daily` が出れば成功
2. `backend/scripts/sql/2026-10-21_tracking_pageviews.sql` → 最後に `tracking_pageviews`・`tracking_keep_visitors` が出れば成功
- 戻すとき：それぞれの `_rollback.sql`（⚠️ 記録が消える）

## 手順2　【② VPS で実行】.env.prod に2行足す
⚠️ **作り直さない。** 今ある `~/dashboard/.env.prod` の末尾に足すだけ。
```bash
cd ~/dashboard
nano .env.prod
```
末尾に足す（開発の `backend-express/.env.local` と同じ値でよい）:
```
META_ACCESS_TOKEN=<システムユーザーのトークン（権限 ads_read）>
META_AD_ACCOUNTS=khf:120210854608200198,pg:120221065383360198,kh:120202114039520198,nagomi:120228563817220198,djh:120242527269730489
```
- ⚠️ トークンは画面・チャットに出さないこと。
- ⚠️ 2026-10-20 に貼り付けで漏れたトークンは使わない（無効化して再発行したもの）。
確認（値は出さない）:
```bash
grep -c '^META_ACCESS_TOKEN=.\+' .env.prod
grep -c '^META_AD_ACCOUNTS=.\+' .env.prod
```
⚠️ どちらも `1` が出ればよい。

## 手順3　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/metaAds/importer.ts backend-express/src/features/tracking/pageview.ts
grep -n "META_ACCESS_TOKEN" docker-compose.prod.yml
```
⚠️ ファイル名が2つ出て、grep が1行出れば v2.2.203 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認:
```bash
dcp exec express-api sh -c 'test -n "$META_ACCESS_TOKEN" && echo SET || echo EMPTY'
```
⚠️ `SET` が出ればよい（値は出ない）。
```bash
dcp logs express-api | grep -E "tracking_detail|meta_ads_import|metaAds:|tracking: 整理" | tail -6
```
⚠️ request の2行と「metaAds: 自動取り込みを始めます」が出ればよい（`--tail` で先に切らない）。
⚠️ 起動から約1分後に「metaAds: 取り込み 完了（広告 …件・日別 …行…）」、約1分半後に「tracking: 整理しました」が出る（取り込みは数分かかる。本番は DB が遠いので、ローカルの4分半より長いことがある）。
```bash
curl -s https://api.khg-marketing.info/t/v1/tracker.js | grep -c "api/track/pv"
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.khg-marketing.info/api/track/pv -d '{}'
```
⚠️ `1` と `204` が出ればよい。

## 手順4　【① FTP】PHP
`backend/src/core/express_proxy.php` を上書き（2つのリストに `tracking_detail`・`meta_ads_import`）
- 確認: トークン無しで ① に `{"request":"tracking_detail"}` → **401**。404 なら手順4の漏れ。

## 手順5　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.d3b6bae7.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順6　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-20_update_log_2.2.203.sql`
- 中身の順：update_log の1行 → 記事のタイトル変更（`UPDATE guide_article SET title = 'アクセス解析' WHERE title = 'トラッキング設定'`）→ 記事2本（アクセス解析・反響一覧）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT id, title, updated_at FROM guide_article WHERE title IN ('アクセス解析', 'トラッキング設定', '反響一覧');
```
⚠️ 「トラッキング設定」が出ず、「アクセス解析」が1行（前と同じ id）ならよい。

## 確認（ログインした状態で）
1. 「反響管理」に「アクセス解析」（旧「トラッキング設定」）。上に「Meta 広告：最後の取り込み 日時」と「Meta から取り込む」。
2. サイト名 → サマリー → 着地ページの文字を押す → 大きいモーダル（日別・ページの前後・流入元別・端末・時間帯・CV）。右のアイコンでそのページが別タブで開く。
3. 流入元の meta を押す → 「Meta 広告」に広告ごとの費用・表示・クリック・着地・CV・CPA。
4. 数日後、閲覧の記録が貯まっているか（① phpMyAdmin）:
```sql
SELECT site_id, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors FROM tracking_pageviews WHERE created_at >= CURDATE() GROUP BY site_id;
SELECT reason, COUNT(*) FROM tracking_keep_visitors GROUP BY reason;
SELECT COUNT(*) AS total, SUM(visitor_id IN (SELECT visitor_id FROM tracking_keep_visitors)) AS kept FROM tracking_pageviews;
```
⚠️ 3つ目の kept（消さない人の行）は上限（50万行）に関係なく増え続ける。大きくなりすぎたら相談。
