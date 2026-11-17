# デプロイ手順 v2.2.276　反響一覧に事業をまたいだ重複の札／顧客情報（注文）に SUUMO の注意書き

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表を2つ作る（`inquiry_dup_key` 重複判定の表・`inquiry_dup_exclude` 除外の名簿）。名簿に会社のメールのドメインを1件入れる | ① DB `backend/scripts/sql/2026-11-17_update_log_2.2.276.sql` |
| 2 | 重複判定の表を作り直す処理（一覧・詳細を読むたびに指紋で確かめる＋10分ごと）。一覧の各行に `dup_count`。重複の詳細 `inquiryDup`（新しい request・② だけ）。全反響の `dup` はもう返さない | ② VPS（backend-express） |
| 3 | 反響一覧の予備（② が落ちたとき）も `dup_count` を返す。`dup` をやめる。`inquiryDup` を ② へ送る許可・ログイン必須に | ① PHP `backend/src/` の6ファイル |
| 4 | 反響一覧（注文・建売・中古）の「重複」の列に札（件数）。押すと相手の反響の小さな画面。注文の「店舗_媒体重複」の文字はやめる。顧客情報（注文）で反響媒体が SUUMO のとき、成約時の課金の注意書き | ① フロント（Dashboard） |
| 5 | 更新履歴・業務ガイド4本（顧客DB・反響一覧・反響一覧（建売営業）・反響一覧（中古リノベ）） | ① DB（1 と同じ SQL ファイル） |

- `.env.prod` の変更・ライブラリの追加はありません。
- ⚠️ **v2.2.275 までのデプロイを先に済ませてください**（docs/deploy-v2.2.274.md → docs/deploy-v2.2.275.md）。この版は v2.2.275 の上に作っています。
- SUUMO の注意書き（顧客情報・注文）は **4 のフロントに含まれます**（PHP・② の変更はありません）。

## ⚠️ 順序
```
0. v2.2.275 までのデプロイが終わっていること
1. GitHub で v2.2.276 を production へマージ（PR）
2. ① SQL：2026-11-17_update_log_2.2.276.sql   ← ⚠️ 1回だけ。⚠️ 表を作るので ② と ① PHP より先
3. ② VPS：fetch・checkout → 作り直し
4. ① PHP 6ファイル
5. ① Dashboard のフロント（npm run build → アップロード）
```
- ⚠️⚠️ **表（手順1）を ② と ① PHP より先に作ってください。** 新しい ② と ① PHP は反響一覧で表の件数を読むので、表が無いと**反響一覧が開きません**（SQL のエラー）。
- 手順2〜4 のあいだに古い画面（v2.2.275）で反響一覧を開くと、注文の「重複」の文字が出ません（② が全反響を返さなくなるため）。フロントを上げれば札が出ます。
- 更新履歴の1行は手順1で入るので、フロントを上げるまでの少しのあいだ、画面の更新履歴に先に出ます。

### 手順1　【① SQL】
phpMyAdmin で `2026-11-17_update_log_2.2.276.sql` を **1回だけ**流します（更新履歴1行＋表2つ＋名簿1件＋業務ガイド4本）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SHOW TABLES LIKE 'inquiry_dup%';
SELECT kind, note FROM inquiry_dup_exclude;
SELECT title, updated_at FROM guide_article WHERE title IN ('顧客DB', '反響一覧', '反響一覧（建売営業）', '反響一覧（中古リノベ）');
```
- 表は2つ（`inquiry_dup_exclude`・`inquiry_dup_key`）、名簿は `domain` の1行ならよいです。`inquiry_dup_key` はこの時点では空です（手順2の ② が入れます）。

### 手順2　【② VPS】
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
- `git log` が v2.2.276 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- 起動して数秒で、② のログに次の1行が出ます（表に全件が入った印）。
  ```bash
  dcp logs --since 5m express-api | grep inquiryDup
  ```
  `inquiryDup: 重複判定の表を更新しました（書いた 2xxxx 行・消した 0 行・…ms）` が出ればよいです（ローカルでは 24,614 行・約1.6秒）。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順3　【① PHP】
次のファイルをアップロードします（同じ場所へ。上書き）。
1. `backend/src/handlers/listAction/list_order.php`
2. `backend/src/handlers/listAction/list_spec.php`
3. `backend/src/handlers/listAction/list_used.php`
4. `backend/src/handlers/list.php`
5. `backend/src/core/request_auth.php`
6. `backend/src/core/express_proxy.php`

上げ終えたら確かめます（ログインしていないブラウザやターミナルから）。
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"inquiryDup","category":"order","id":1}'
```
- `{"status":"error","message":"認証が必要です。"}`（401）が出ればよいです。⚠️ `該当する処理がありません`（404）なら `express_proxy.php` が古いままです。

### 手順4　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.276 になればよいです。

## 終わったら（動作確認）
- 反響一覧（注文・建売・中古）の「重複」の列に、赤い札「重複 n」が出る。押すと小さな画面が開き、相手の反響の事業・店舗・反響日・媒体・氏名・一致（メール／携帯）・取込が出る。札の数と画面の件数が同じ。
- 注文の「店舗_媒体重複」の文字は出ない。
- 期間を変えると URL が変わる（v2.2.275 のまま）。
- 顧客情報（注文）で反響媒体が SUUMO の顧客を開くと、課金の注意書きが出る。

## 切り戻し
- **反響一覧が開かないとき**：まず手順1の表があるかを確かめます（`SHOW TABLES LIKE 'inquiry_dup%';`）。無ければ SQL の `CREATE TABLE` の2つだけを流します。
- フロントを v2.2.275 に戻すと、札は出ず、注文の「重複」の文字も出ません（新しい ① PHP・② は全反響を返さないため）。重複の表示が要るときは、① PHP・② も v2.2.275 に戻します（② → ① PHP → フロントの順）。表は残しておいてかまいません。

## 知っておくこと
- **重複の決め方**：注文・建売・中古の反響をまたいで、メールアドレス（大文字・小文字と空白を無視）か、携帯番号（070・080・090・050 で始まる11桁）が同じなら重複。氏名は見ません。個人情報削除をした反響は外れます。
- **件数（ローカル）**：重複のある反響は 注文 11,328 件（うち他の事業と 1,022 件）・建売 1,373 件（615 件）・中古 330 件（200 件）。
- **除外の名簿**：`inquiry_dup_exclude` に、値の SHA2 ハッシュで入れます（SQL ファイルに個人のメール・電話番号を書かないため）。名簿のメールを持つ反響の携帯（逆も）も自動で外れます。足し方は SQL ファイルの注記のとおり、phpMyAdmin で1行 INSERT します。次に反響一覧を開いたときに反映されます（② の設定の変更・再起動は要りません）。
- **新しい反響・直した連絡先**：一覧・詳細を開くたびに ② が3つの反響の表の「指紋」を比べ、変わっていれば作り直します（約30ms。作り直すときは1〜2秒）。10分ごとにも作り直します。
- **② が止まっているとき**：反響一覧は ① の予備が、止まった時点の件数で札を出します。札を押した詳細は ② だけの処理なので、画面に「読み込めませんでした」と出ます。
- 注文の反響一覧の応答は、全反響の軽い列（約2万件）を返さなくなったので、初回と「再読み込み」が 5.6MB → 1.5MB（前月〜今月）になります。
