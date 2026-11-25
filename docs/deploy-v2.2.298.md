# デプロイ手順 v2.2.298　集客イベント：フォーム作成（イベントの予約フォーム）・反響一覧の見た目

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `event_form`（作ったフォーム）を作り、`event_db` に `site`（建築予定地）を足す。更新履歴1行・業務ガイド「集客イベントの反響一覧」「イベントのフォーム作成」（どちらも新規） | ① DB `backend/scripts/sql/2026-11-25_update_log_2.2.298.sql` |
| 2 | 新しい request を足す。`event_form`（roll `list`・`save`。社内の画面・スタッフ全員）、`event_form_public`・`event_form_entry`（公開フォーム。認証なし。申し込みは 10分に5回まで） | ② VPS（features/eventForm/、gateway/registry.ts、middlewares/publicFormRateLimit.ts） |
| 3 | `event_form:list`・`event_form:save` を ② へ転送する（転送リストと転送専用リストの両方） | ① PHP `backend/src/core/express_proxy.php` |
| 4 | 公開フォーム（`https://khg-marketing.info/form/<番号>/`）。1つの HTML を `.htaccess` で番号ごとの URL に向ける | ① `public_html/form/`（`backend/forms/event/index.html`・`.htaccess`） |
| 5 | ヘッダー「集客イベント」に「フォーム作成」を足す。反響一覧をカードの見た目にし、「特設URLはこちら」を外し、「建築予定地」の列を足す | Dashboard（frontend の build） |

- ⚠️ v2.2.297 までを先に済ませてください。
- ⚠️ SQL（手順2）を ② より先に流してください。表が無いまま ② を上げると、フォーム作成の画面がエラーになります。
- ⚠️ ① PHP（手順4）は ② のあとに上げてください。先に上げると ② に無い request を転送して 502 になります。
- 申し込みのメール（本人宛の受付完了・社内の通知）は、② の今の SMTP の設定で送ります（イベント予約・キャンペーンフォームと同じ）。

## 順序
```
1. GitHub で v2.2.298 を production へマージ（PR）
2. ① SQL：2026-11-25_update_log_2.2.298.sql   ← ⚠️ 1回だけ（表の部分は何度流しても安全。更新履歴の行だけ増える）
3. ② VPS（＋ CORS の確認）
4. ① PHP：backend/src/core/express_proxy.php をアップロード
5. ① 公開フォーム：public_html/form/ に index.html と .htaccess を置く
6. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-25_update_log_2.2.298.sql
```
確認：
```sql
SHOW COLUMNS FROM event_form;
SHOW COLUMNS FROM event_db LIKE 'site';
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```
- `event_form` の列（id・title・mail_to・mail_cc・fields・active・created_by・created_at・updated_by・updated_at）、`site` の1行、`2.2.298` の行が出ればよいです。

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
- `git log` が v2.2.298 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

CORS の確認（公開フォームは khg-marketing.info から ② へ直接送ります。事前アンケート `survey_*` と同じ）：
```bash
curl -s -i -X POST -H 'Content-Type: application/json' -H 'Origin: https://khg-marketing.info' \
  -d '{"request":"event_form_public","id":999999}' https://api.khg-marketing.info/api/gateway | grep -i -E '^HTTP|access-control-allow-origin'
```
- `HTTP/… 404` と `access-control-allow-origin: https://khg-marketing.info` が出ればよいです（番号 999999 のフォームは無いので 404 で正しい）。
- ⚠️ `access-control-allow-origin` が出ないときは、② の `CORS_ORIGINS` に `https://khg-marketing.info` がありません。足して `dcp up -d express-api` してください。

### 手順4　【① PHP】
`backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで送って 401 なら ② まで届いています。404 なら ① PHP が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"request":"event_form","roll":"list"}' 'https://khg-marketing.info/dashboard/api/gateway/'
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"request":"event_form","roll":"save"}' 'https://khg-marketing.info/dashboard/api/gateway/'
```

### 手順5　【① 公開フォーム】
⚠️ 先に、`public_html/form/` が無いこと（または空であること）を確かめてください。ほかのものが置かれていたら、上書きせずに止めて相談してください（2026-11-25 にアクセスログを見た範囲では、`/form/` は使われていませんでした）。
```bash
ls -la ~/khg-marketing.info/public_html/form/ 2>&1 | head
```
- `No such file or directory` ならよいです。

置くもの（FTP でも可）：
- `backend/forms/event/index.html` → `public_html/form/index.html`
- `backend/forms/event/.htaccess` → `public_html/form/.htaccess`（⚠️ ファイル名の先頭の `.` を落とさない）

確認：
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://khg-marketing.info/form/1/
curl -s -I https://khg-marketing.info/form/1/ | grep -i cache-control
```
- `200` と `cache-control: no-cache, must-revalidate` が出ればよいです（番号のフォルダは無くても、`.htaccess` で index.html が返ります）。

### 手順6　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/header/event/EventFormBuilder.tsx`（新規）
  - `src/components/header/event/EventList.tsx`
  - `src/components/header/headerScreens.tsx`
  - `src/components/guide/guideScreens.ts`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. ヘッダー「集客イベント → フォーム作成」を開き、「新しいフォームを作る」→「新しく追加する」で、開催日と「テスト（削除予定）」などの名前、通知先に自分のアドレスを入れて保存します。`https://khg-marketing.info/form/1/` のような URL が出ます。
2. その URL をスマホで開き、自分の情報で申し込みます。
   - 郵便番号を入れて「住所を検索」で住所が入る。
   - 送ると「お申し込みを受け付けました」が出る。
   - 自分宛に「お申し込みありがとうございます」と、通知先に「フォーム予約」のメールが届く（迷惑メールのフォルダも確かめる）。
3. 「集客イベント → 反響一覧」で、そのイベント名を選ぶと申し込みが1件出る。「特設URLはこちら」が無く、絞り込みと一覧がカードになっている。
4. フォーム作成の「編集」で「受付中」を外して保存し、URL を開き直すと「このイベントの受付は終了しました」と出る。
5. 試した申し込みは、反響一覧で同期（顧客DBに取り込み）しないでください。テストのフォームは「受付中」を外したままにしておきます（フォームは消せません）。
   - ⚠️ 消したいときは ① の DB で `DELETE FROM event_db WHERE id LIKE 'ef<番号>\_%';`（番号はフォームの番号）と、`DELETE FROM event_form WHERE id = <番号>;` です。

うまくいかないとき：
```bash
dcp logs --since 30m express-api | grep -iE "event_form|error"
```

## 切り戻し
- 画面：前の build に戻すと、「フォーム作成」が消え、反響一覧が前の見た目に戻ります（「特設URLはこちら」も戻ります）。
- 公開フォーム：`public_html/form/` を消すか名前を変えると、URL は開けなくなります。
- ② と ① PHP：前の版に戻すと、フォーム作成と公開フォームが動かなくなります（そのほかは今までどおり）。
- 表と列はそのままで構いません。消すときは `DROP TABLE event_form; ALTER TABLE event_db DROP COLUMN site;` です（⚠️ フォームからの申し込みの建築予定地も消えます）。
