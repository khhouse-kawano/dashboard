# デプロイ手順 v2.2.281　顧客台帳にポータル反響の印／顧客DBの「SUUMO(ポータル反響)」を印で絞る

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | master_data・master_data_kaeru に `portal_flag`・`portal_site` を足し、これまでに取り込んだ分を反響一覧の記録から埋める。更新履歴1行・業務ガイド2本 | ① DB `backend/scripts/sql/2026-11-18_update_log_2.2.281.sql` |
| 2 | 反響一覧から取り込むとき、ポータルの反響なら印を付ける。顧客DBが `portal_site` を返す | ② VPS |
| 3 | ② が落ちたときの予備も同じ | ① PHP `backend/src/` の4ファイル |
| 4 | 顧客DB（注文・建売）の「SUUMO(ポータル反響)」が、印が SUUMO のお客様だけを出す（建売にも選択肢を追加） | ① フロント（Dashboard） |

- ⚠️ v2.2.280 までのデプロイを先に済ませてください。
- ⚠️ **SQL を一番先に流してください。** 列が無いまま ② や ① PHP を上げると、反響一覧の取り込みと顧客DBの読み込みが失敗します。

## 順序
```
0. v2.2.280 までのデプロイが終わっていること
1. ① SQL：2026-11-18_update_log_2.2.281.sql   ← ⚠️ 1回だけ・一番先
2. GitHub で v2.2.281 を production へマージ（PR）
3. ② VPS
4. ① PHP 4ファイル
5. ① Dashboard のフロント（npm run build → アップロード）
```

### 手順1　【① SQL】
phpMyAdmin で `2026-11-18_update_log_2.2.281.sql` を **1回だけ**流します。
- 列の追加（ALTER TABLE）が入っているので、2回流すと `Duplicate column name` で止まります。
- ⚠️ 直す前のファイルを流して、埋め戻しの UPDATE で `ERROR 1175 … safe update mode` が出て止まったとき：更新履歴の1行と列の追加は済んでいます。続きの **`2026-11-18_portal_backfill_2.2.281.sql` を1回だけ**流してください（埋め戻し＋業務ガイド2本）。今のファイルは、UPDATE の前に `SET SESSION sql_safe_updates = 0;` を入れてあります。
- ファイルの最後近くの「確かめる」の SELECT で、サイトごとの件数が出ます。ローカルでは、注文の SUUMO が 814件、建売の SUUMO が 139件でした。

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT portal_site, COUNT(*) FROM master_data WHERE portal_flag = 1 GROUP BY portal_site;
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
- `git log` が v2.2.281 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順4　【① PHP】
次の4ファイルを ① の同じ場所へアップロードします（1 は新しいファイル、ほかは上書き）。
1. `backend/src/core/portal.php`
2. `backend/src/handlers/listAction/list_insert.php`
3. `backend/src/handlers/databaseAction/database_order.php`
4. `backend/src/handlers/databaseAction/database_spec.php`

### 手順5　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.281 になればよいです。

## 終わったら（動作確認）
- 顧客DB（注文）で媒体の欄の「SUUMO(ポータル反響)」を選ぶと、件数が減って SUUMO の反響のお客様だけになる（ローカルでは 26,590件 → 808件）。
- 顧客DB（建売）にも同じ選択肢があり、選ぶと SUUMO の反響のお客様だけになる（ローカルでは 8,881件 → 121件）。
- 反響一覧（注文か建売）で SUUMO の反響を1件取り込んだあと、phpMyAdmin で次の結果が `1 / SUUMO` になる。
```sql
SELECT portal_flag, portal_site FROM master_data_kaeru WHERE id = '<取り込んだお客様の id>';
```

## 切り戻し
- フロント・② ・① PHP を前の版に戻せば、今までの動きに戻ります。
- 足した列は残しておいて問題ありません（ほかの処理は読みません）。
