# デプロイ手順 v2.2.257　面談アンケート（survey）の API を ② へ

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 面談アンケートの新しい口（スタッフ用3つ・お客様用4つ） | ② VPS（backend-express） |
| 2 | スタッフ用の口を ② へ転送する許可リスト | ① PHP `backend/src/core/express_proxy.php` |
| 3 | Dashboard のログイン画面：survey から来たら、ログイン後に survey へ戻す | ① フロント（Dashboard） |
| 4 | survey 本体（通信・入口・QR・お客様の画面） | ① `khg-marketing.info/survey/`（`react/survey/dist`） |
| 5 | 更新履歴・業務ガイドの記事「面談アンケート（面談前・面談後）」 | ① DB `backend/scripts/sql/2026-11-09_update_log_2.2.257.sql` |

- ⚠️ **DB の表は変わりません。**
- ⚠️ **`khg-marketing.info/survey/api/`（旧 PHP）は消さないでください。** projects/sync（before_interview_register）が使っています。survey も ② に届かないときの予備の送り先にしています。
- `projects/sync`・GAS は変わりません。

## 順序
```
0. GitHub で v2.2.257 を production へマージ（PR）
1. ② VPS（backend-express）を更新して再起動        ← ⚠️ いちばん先
2. ① PHP：backend/src/core/express_proxy.php を上げる
3. ① Dashboard のフロント（v2.2.257 のブランチでビルドしたもの）
4. ① survey：react/survey/dist の中身を khg-marketing.info/survey/ に上げる
5. ① SQL：2026-11-09_update_log_2.2.257.sql        ← ⚠️ 1回だけ
```
⚠️ 4 の survey は、1〜3 が終わってから上げてください。先に上げると、スタッフの画面で一覧が読めません（お客様の画面は、予備の旧 /survey/api/ で保存はされます）。

### 手順1　【② VPS】backend-express を更新
（任意）署名の鍵を決めたいときだけ、`.env.prod` に `SURVEY_LINK_SECRET=<長いランダムな文字>` を足します。
- 入れなくても動きます（DB の接続情報から鍵を作ります）。
- 入れた後に値を変えると、それまでに出した QR は「期限切れ」と同じ扱いになります。開けて保存もされますが、お客様情報は入らない状態です。
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
確認（② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"interview_survey","roll":"customers"}'
```
- `認証が必要です。`（401）ならよいです。
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"interview_survey_public","roll":"master"}'
```
- `{"status":"missing"}` ならよいです（署名なしのとき）。
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS https://api.khg-marketing.info/api/gateway -H 'Origin: https://khg-marketing.info' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'
```
- 204 か 200 ならよいです（survey のお客様の画面から ② へ送れる）。

### 手順2　【① PHP】express_proxy.php
`backend/src/core/express_proxy.php` を、サーバーの `dashboard/api/gateway/core/express_proxy.php` に上げます（上書き）。
確認（トークンなし。① 経由）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"interview_survey","roll":"customers"}'
```
- `認証が必要です。`（401）ならよいです。404（該当する処理がありません）なら、express_proxy.php が古いままです。

### 手順3　【① Dashboard のフロント】いつもの手順
⚠️ v2.2.257 のブランチで `npm run build` をし直してから上げてください（ログイン画面の変更）。

### 手順4　【① survey】
`C:\Users\shinji-kawano\react\survey\dist` は、2026-11-09 にビルド済みです（見直しの修正と、① の入口を `/dashboard/api/gateway/` に直したものを含む）。
- 中身（`index.html`・`assets/`・`vite.svg`）を、サーバーの `survey/` に上げます。
- ⚠️ サーバーの `survey/api/` と `survey/.htaccess` は**消さない・上書きしない**でください。
- 古い `survey/assets/` の中のファイルは、残っていても害はありません。
- 控え：直す前の survey のソースは `C:\Users\shinji-kawano\react\survey_backup_20261109.tgz` にあります（node_modules・dist は除く）。

### 手順5　【① SQL】
phpMyAdmin で `2026-11-09_update_log_2.2.257.sql` を **1回だけ**流します。内容は、更新履歴と業務ガイドの記事です。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.257 で、1行だけならよいです。

## 終わったら（動作確認）
1. Dashboard にログインしたブラウザで https://khg-marketing.info/survey/ を開く → 「面談前／面談後」の選択がそのまま出る
2. 「面談前アンケート」→ お客様の一覧が出る → お客様を選んで「面談前アンケート開始」→ QR が出る
3. **ログインしていないスマホ**で QR を読む → アンケートが開き、お客様の連絡先などが最初から入っている
   - 回答して送るとお礼の画面が出る
   - 試すときは、テスト用のお客様で行ってください。お客様の記録が上書きされます
4. シークレットウィンドウ（未ログイン）で https://khg-marketing.info/survey/search_before を開く → Dashboard のログイン画面に移る → Google でログイン → 面談前アンケートの検索に戻る
5. Dashboard の版の表示が ver2.2.257

## 知っておくこと（見直しのあと）
- お客様が送れない事態を避けるため、② に保存できないときは、旧 `/survey/api/` へ送り直します。② が送りすぎで断ったとき（10分に30件/IP）も同じです。
  - ⚠️ 旧 `/survey/api/` は、画面に書いた合い言葉だけで書き込めます（以前からそのまま）。この予備の経路では「QR の期限切れなら、お客様の記録を上書きしない」が効きません。割り切りとして残しています。
- 同じ回答が30分以内にもう一度届いても（再送・連打）、行は1つだけです。
- 既存のお客様の面談前アンケートでは、担当・連絡先などが空なら、今の値を残します。以前は空で上書きしていました。
- 「きっかけ」と「注文住宅に興味を持った理由」が、送るたびに入れ替わっていた以前からの不具合を直しました。すでに入れ替わっている記録は、元に戻していません。

## 切り戻し
- survey の画面だけを戻すときは、以前のビルド `C:\Users\shinji-kawano\react\survey_dist_before_20261109` の中身を上げ直してください。
  - 以前の survey は旧 API（`/dashboard/api/` の demand）を呼んでいました。その旧 API は、今の ① ではすでに動いていません。
- ② を戻すと、新しい survey のスタッフの画面が一覧を読めなくなります。お客様の回答は、予備の旧 /survey/api/ に保存されます。
