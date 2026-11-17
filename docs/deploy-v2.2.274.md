# デプロイ手順 v2.2.274　反響一覧を期間の分だけ読む（GET）／使っていない処理にログイン確認

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 反響一覧（注文・建売・中古）を、開始月〜終了月の分だけ GET で読む。月を変えるたびに読み直す（絞り込みは残る）。注文の「重複」は全反響から探す（今までどおり） | ① フロント（Dashboard） |
| 2 | GET を `list` だけ受ける（`Cache-Control: no-store`）。反響一覧の予備（② が落ちたとき）も期間で絞る。使っていない `shopTrend_kaeru`・`shopTrend_resale` をログイン必須に | ① PHP `backend/src/` の6ファイル |
| 3 | 反響一覧の参照が期間（startMonth / endMonth）と dup を受ける | ② VPS（backend-express） |
| 4 | 更新履歴・業務ガイド3本（反響一覧・反響一覧（建売営業）・反響一覧（中古リノベ）） | ① DB `backend/scripts/sql/2026-11-16_update_log_2.2.274.sql` |

- 表の変更・`.env.prod` の変更はありません。
- ⚠️ **v2.2.273 を先にデプロイしてください**（docs/deploy-v2.2.273.md）。この版は v2.2.273 の上に作っています。

## ⚠️ 順序
```
0. v2.2.273 のデプロイが終わっていること
1. GitHub で v2.2.274 を production へマージ（PR）
2. ② VPS：fetch・checkout → 作り直し
3. ① PHP 6ファイル                       ← ⚠️ db.php と handlers/list.php は必ず一緒に
4. ① Dashboard のフロント（npm run build → アップロード）
5. ① SQL：2026-11-16_update_log_2.2.274.sql   ← ⚠️ 1回だけ
```
- ⚠️⚠️ **フロントを ① PHP より先に上げないでください。** 新しい画面は GET で送ります。古い `db.php` は GET を読めないので 400 を返し、**反響一覧が空のまま**になります。
- ② と ① PHP は、期間が無い要求（古い画面）には今までどおり全件を返します。② → ① PHP の順なら、途中で古い画面が開かれても困りません。

### 手順1　【② VPS】
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
- `git log` が v2.2.274 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順2　【① PHP】
次のファイルをアップロードします（同じ場所へ。上書き）。
1. `backend/src/handlers/listAction/list_order.php`
2. `backend/src/handlers/listAction/list_spec.php`
3. `backend/src/handlers/listAction/list_used.php`
4. `backend/src/handlers/list.php`
5. `backend/src/core/request_auth.php`
6. `backend/src/core/db.php`（**最後**）

- ⚠️ 1〜3 は 4 の `listMonthCondition()` を使います。**1〜4 は続けて**上げてください（途中で反響一覧を開くと、② が落ちていたときだけ 500 になります。② が動いていれば ② が返すので画面は止まりません）。

上げ終えたら確かめます（ログインしていないブラウザやターミナルから）。
```
https://khg-marketing.info/dashboard/api/gateway/?request=list&category=order&startMonth=202610&endMonth=202611
```
- `{"status":"error","message":"認証が必要です。"}`（401）が出ればよいです。⚠️ `不正なリクエストです。`（400）なら `db.php` が古いままです。

### 手順3　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.274 になればよいです。

### 手順4　【① SQL】
phpMyAdmin で `2026-11-16_update_log_2.2.274.sql` を **1回だけ**流します（更新履歴1行＋業務ガイド3本）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT title, updated_at FROM guide_article WHERE title LIKE '反響一覧%';
```

## 終わったら（動作確認）
- 反響一覧（注文・建売・中古）が開き、上の集計と件数が前日までと同じ（同じ期間で）。
- 開始月・終了月を変えると、一覧と集計がその期間に変わる。店舗・媒体・取込状況・氏名の絞り込みは残る。
- 注文の「重複」の札が、今までどおり出る。
- ブラウザの開発者ツール（ネットワーク）で、反響一覧の通信が `GET ...?request=list&category=...&startMonth=...&endMonth=...` になっている。

## 切り戻し
- **反響一覧が開かないとき**：① のフロントを v2.2.273 に戻します（古い画面は POST で全件を読むので、新しい ① PHP・② のままで動きます）。
- ① PHP だけを戻すときは、**先にフロントを戻してから** `db.php` を戻してください（逆にすると新しい画面の GET が 400 になります）。
- `shopTrend_kaeru`・`shopTrend_resale` を戻すときは、`core/request_auth.php` の `REQUEST_AUTH_REQUIRED` からその2行を消して上げ直します（画面からは呼ばれていません）。

## 知っておくこと
- 注文の反響一覧は、ローカルで応答が 20.8MB（全件）→ 1.5MB（前月〜今月）になりました。初回と「再読み込み」だけ、重複を探すための全反響の軽い列を足すので 5.6MB です。期間を変えたときは足しません。
- 建売は 10.1MB → 1.0MB、中古は 5.5MB → 0.5MB（前月〜今月）。
- GET を受ける処理は `core/db.php` の `GET_ALLOWED_REQUESTS` だけです（今は `list`）。次の版で `shopTrend` を足す予定です。
