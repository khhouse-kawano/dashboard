# デプロイ手順 v2.2.205（かえるホームの CV の結びつけ・建売の HP閲覧履歴・アンバサダーの反響一覧のアカウント）

⚠️ v2.2.204 は main にマージ済み。このブランチは main から切ってある。
⚠️ v2.2.203（表 `tracking_pageviews`）・v2.2.204 のデプロイが済んでいること。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `tracking_conversions`（新規）・`inquiry_customer_kaeru.landing_params`・`master_data_kaeru.landing_params`（列の追加） | ① DB |
| 2 | cv.js の配信・`POST /api/track/cv`・5分ごとの突き合わせ・アクセス解析の CV にかえる・`customer_pageviews` の division・反響一覧（かえる）の landing_params | ⚠️ **② VPS（再ビルド）** |
| 3 | 反響一覧（かえる）の PHP 版の SQL に landing_params | ① PHP（`backend/src/handlers/listAction/list_spec.php`） |
| 4 | アクセス解析の CV 用タグ・件数／かえるの顧客情報の HP閲覧履歴／反響一覧（かえる）の取込／アンバサダーの反響一覧のアカウントの列と余白／画面の版 | ① フロント（dashboard） |
| 5 | 更新履歴 ＋ 記事3本 | ① DB |
| 6 | かえるホームのサイトの登録 → GTM 担当者への依頼 | ① 画面（アクセス解析）・GTM |

- ⚠️ `.env.prod` の変更は**なし**。`express_proxy.php` の変更も**なし**（新しい受け口はサイトから ② へ直接。`customer_pageviews` は v2.2.204 で登録済み）。

## 順序
```
0. GitHub で v2.2.205 を main → production へマージ
1. ① DB：表と列（2026-10-21_tracking_conversions.sql）
2. ② 再ビルド          ← ⚠️ 1 の後
3. ① PHP（list_spec.php） ← ⚠️ 1 の後
4. ① フロント          ← ⚠️ 2・3 の後
5. ① SQL（更新履歴 ＋ 記事）
6. ① アクセス解析でかえるホームを登録 → GTM 担当者へ依頼
```
- ⚠️⚠️ **2 を 1 より先にしない。** ② のアクセス解析の CV の集計が `inquiry_customer_kaeru.landing_params` を読むので、列が無いと**アクセス解析の一覧・サマリーがエラーになる**。突き合わせ（5分ごと）もログに失敗を出す。
- ⚠️ 3 を 1 より先にすると、② が落ちて ① に回ったときの反響一覧（建売）がエラーになる。

## 手順1　【① phpMyAdmin】表と列
ファイル: `backend/scripts/sql/2026-10-21_tracking_conversions.sql`（何度流しても安全）
- 最後に `tracking_conversions`、`landing_params` の行が2つ（inquiry_customer_kaeru・master_data_kaeru）出れば成功
- 戻すとき：`2026-10-21_tracking_conversions_rollback.sql`（⚠️ 結びつけた記録が消える）

## 手順2　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/public/cv.js backend-express/src/features/tracking/cvMatch.ts
```
⚠️ ファイル名が2つ出れば v2.2.205 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認:
```bash
curl -s https://api.khg-marketing.info/t/v1/cv.js | grep -c "api/track/cv"
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.khg-marketing.info/api/track/cv -d '{}'
```
⚠️ `1` と `204` が出ればよい。
```bash
dcp logs express-api | grep -E "CV の突き合わせに失敗|track/cv: 保存に失敗"
```
⚠️ 起動から2分以上たって、**何も出なければよい**（`--tail` で先に切らない）。出たら手順1の漏れ。

## 手順3　【① FTP】PHP
`backend/src/handlers/listAction/list_spec.php` を上書き（反響一覧（建売）の SQL に landing_params）

## 手順4　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.c468f5d5.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること
- ⚠️ ロゴ画像 `/dashboard/img/kh.png` が画像で出るか確認すること（v2.2.204〜 build に入っている）

## 手順5　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-21_update_log_2.2.205.sql`
- 中身の順：update_log の1行 → 記事3本（アクセス解析・顧客DB（建売営業）・アンバサダーの反響一覧（新規））
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT id, title, updated_at FROM guide_article WHERE title IN ('アクセス解析', '顧客DB（建売営業）', 'アンバサダーの反響一覧');
```
⚠️ 2.2.205 が1行、記事が3本（アンバサダーの反響一覧は新しい id）ならよい。

## 手順6　【① 画面】かえるホームの登録と GTM 担当者への依頼
1. 「反響管理 → アクセス解析」→「サイトを登録」
   - サイト名：かえるホーム ／ ブランド：**かえるホーム**（⚠️ これで CV 用のタグが出る）／ 許可するオリジン：`https://www.kaeruhome.jp`
2. 「タグ」を押して、サイトキー（s_ で始まる16文字）を控える。「CV 用」が出ていることを確認
3. `Downloads/GTM担当者への依頼_かえるホーム_v2.2.205.txt` の **【サイトキー】（2か所）** を、控えたサイトキーに置き換えてから送る
4. GTM 担当者から公開の連絡が来たら、下の「確認」の 3〜5 を行う

## 確認（ログインした状態で）
1. アンバサダーの反響一覧：住所の右に「アカウント」（@ 付き）。表のセルと画面の左右に余白がある。
2. 建売の反響一覧で取込 → その顧客の顧客情報（かえるの反響に流入の情報があるときだけ、備考の下に「HP閲覧履歴」）。
3. GTM 公開後、https://www.kaeruhome.jp/ を開く → アクセス解析のかえるホームの「直近30日の着地」「最後の着地」が増える（広告の URL で開いたとき）・サマリーの PV が増える。
4. 会員登録などで実際に「確認画面へ」まで進む（社内のテスト用のメールアドレスで）→ ① phpMyAdmin:
```sql
SELECT id, site_id, form, created_at, matched_inquiry_id, matched_at FROM tracking_conversions ORDER BY id DESC LIMIT 5;
```
5. そのテストの反響が GAS で入ってから5分ほどで `matched_inquiry_id` が入り、`inquiry_customer_kaeru` のその行の landing_params に `khg_vid=` が入る。アクセス解析のかえるホームの「フォーム送信 ○件（結びつき ○件）」が増える。
   - ⚠️ テストの反響は、確認が終わったら削除フラグを付けておく。
