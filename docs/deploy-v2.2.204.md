# デプロイ手順 v2.2.204（顧客情報の HP閲覧履歴・閉じた欄のフェード表示・土地コーディネートの削除）

⚠️ v2.2.203 は main にマージ済み。このブランチは main から切ってある。
⚠️ v2.2.203 のデプロイ（表 `tracking_pageviews` の作成・② の再ビルド）が**済んでいること**。今回の ② は、その表を読む。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | request `customer_pageviews`（顧客1人の閲覧履歴） | ⚠️ **② VPS（再ビルド）** |
| 2 | ① の転送リストに `customer_pageviews` | ① PHP（`backend/src/core/express_proxy.php`） |
| 3 | 顧客情報（注文）の HP閲覧履歴・3事業の閉じた欄・土地コーディネートの削除・FormBuilder の HTML が流入の情報も送る・キャンペーン画面のロゴ（/dashboard/img/）・画面の版 | ① フロント（dashboard） |
| 4 | 更新履歴 ＋ 記事3本（顧客DB・建売・中古） | ① DB |

- ⚠️ 表の追加・変更は**なし**。`.env.prod` の変更も**なし**。

## 順序
```
0. GitHub で v2.2.204 を main → production へマージ
1. ② 再ビルド
2. ① PHP
3. ① フロント          ← ⚠️ 1・2 の後
4. ① SQL（更新履歴 ＋ 記事）
```
- ⚠️ 3 を 1・2 より先にすると、HP閲覧履歴の欄が「閲覧履歴を読み込めませんでした」になる（ほかの欄には影響しない）。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/tracking/customerPageviews.ts
```
⚠️ ファイル名が出れば v2.2.204 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認:
```bash
dcp logs express-api | grep "customer_pageviews"
```
⚠️ 「🔒 customer_pageviews」の1行が出ればよい（`--tail` で先に切らない）。

## 手順2　【① FTP】PHP
`backend/src/core/express_proxy.php` を上書き（2つのリストに `customer_pageviews`）
- 確認: トークン無しで ① に `{"request":"customer_pageviews"}` → **401**。404 なら手順2の漏れ。

## 手順3　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.c48b4c6f.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること
- ⚠️ ロゴ画像 `build/img/`（8ファイル）も一緒に上がること。確認: `https://khg-marketing.info/dashboard/img/kh.png` が画像で出る（ダッシュボードの画面が出たら上がっていない）

## 手順4　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-21_update_log_2.2.204.sql`
- 中身の順：update_log の1行 → 記事3本（顧客DB・顧客DB（建売営業）・顧客DB（中古リノベ））
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT id, title, updated_at FROM guide_article WHERE title LIKE '顧客DB%';
```
⚠️ 2.2.204 が1行、記事3本の updated_at が今日ならよい（id は前と同じ）。

## 確認（ログインした状態で）
1. 注文の顧客情報：下のボタンに「土地コーディネート」が無い。
2. 閉じた欄（商談ステップ・架電状況など）が、上の数行が見えて下へ薄く消える。薄い部分を押すと開く。
3. 流入情報つきの反響から取り込んだお客様：商談ステップの上に「HP閲覧履歴」。閉じたままでも訪問の回数とページ数が見える。「閲覧」で全部開く。
   - ⚠️ 記録は v2.2.203 のデプロイ以後の閲覧だけ。デプロイ直後は、ほとんどのお客様が「閲覧の記録はまだありません」になる。
4. 建売・中古の顧客情報：閉じた欄が同じフェード表示（HP閲覧履歴の欄は無い）。
5. キャンペーン管理の「フォーム作成（FormBuilder）」：HTML を作ると、送信処理に `landing_params` と `url_params` が入っている。
   - ⚠️ **すでに LP に貼ってある HTML は古いまま。** 作り直して貼り替える（アクセス解析のタグがあるページだけ流入の情報が送られる）。
6. キャンペーン管理：ブランドを選ぶカードに8ブランドのロゴが出る。キャンペーン作成の見出しのロゴ・プレビューの国分ハウジンググループのロゴも出る。
