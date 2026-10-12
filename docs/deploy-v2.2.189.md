# デプロイ手順 v2.2.189（フォームを埋め込んだページの URL パラメータを保存）

⚠️⚠️ **v2.2.188 を出し終えてから**出すこと（このブランチは v2.2.188 の上に作っている。公開フォームの build にも v2.2.188 の変更が入っている）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `url_params`・`landing_params` の列（inquiry_customer・master_data） | ⚠️ **① DB**（`2026-10-12_url_params_columns.sql`） |
| 2 | 反響の保存に 2 列 ／ 反響一覧（注文）が 2 列を返す ／ 顧客へ保存できる | ⚠️ **② VPS**（campaignForm/entry.ts・list/queries.ts・information/masterDataColumns.ts） |
| 3 | 反響一覧（注文・フォールバック）が 2 列を返す ／ 顧客へ保存できる | ⚠️ **① PHP**（listAction/list_order.php・core/allowed_columns.php） |
| 4 | 注文の同期（handleSync）で 2 列を顧客へ送る | ① フロント（dashboard） |
| 5 | 公開フォームが 2 列を送る | ⚠️ **公開フォーム**（react/form_get の build → 各ブランドの /form/ と /khg/form/ へ） |
| 6 | 更新履歴 | ① DB |

## 順序（⚠️ この順を守る）
```
0. GitHub で v2.2.189 を main → production へマージ
1. ① DB（2026-10-12_url_params_columns.sql）   ← ⚠️ 必ず最初
2. ② Express（build）
3. ① PHP（2ファイル）
4. ① フロント（build）
5. 公開フォーム（form_get の build）
6. ① SQL（update_log）
```
- ⚠️⚠️ **1 より先に 2 を出さないこと。** ② の送信処理が `inquiry_customer.url_params` に書くので、列が無いと ⚠️ **フォームからの反響がまるごと保存できなくなる**。
- ⚠️ 5 は 2 の後（⚠️ ② が古いと送っても保存されないだけ。壊れはしない）。
- ⚠️ 古い公開フォーム（キャッシュ）から送られても、2 列が NULL になるだけで反響は保存される。

## 手順1　【① phpMyAdmin】列の追加
⚠️ ファイル: `backend/scripts/sql/2026-10-12_url_params_columns.sql`（何度流しても壊れない）
| テーブル | 位置 | 列 |
|---|---|---|
| `inquiry_customer` | `hotlead_url` の次 | `url_params`・`landing_params`（TEXT、空は NULL） |
| `master_data` | `line_id` の次 | 同上（⚠️ v2.2.188 の line_id が先に要る） |

⚠️ 最後の確認の結果: 2 テーブルとも `url_params`・`landing_params` が 0（まだ値が無い）

## 手順2　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "landingParams: clean" backend-express/src/features/campaignForm/entry.ts
```
⚠️ 1行出れば v2.2.189 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順3　【① レンタルサーバー】PHP
| ファイル | |
|---|---|
| `backend/src/core/allowed_columns.php` | 顧客へ保存してよい列に 2 列 |
| `backend/src/handlers/listAction/list_order.php` | 反響一覧（注文）に 2 列 |

## 手順4　【WSL】フロントを ① へアップロード
| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.2ce64ef1.js`** | ⚠️ **この版の本体** |
| `static/css/main.b8a7c60b.css` | v2.2.188 と同じ（変わらない） |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |
```bash
deploy-dashboard
```

## 手順5　公開フォーム（form_get）
⚠️ git 管理外。⚠️ 変更前のファイルはスクラッチの `form_get_backup_2026-10-12_v189/`（Form.tsx・Confirm.tsx）。新規は `src/api/pageParams.ts`。
```powershell
cd C:\Users\shinji-kawano\react\form_get
npm run build
```
- ⚠️ できた `dist/` を、いつもの公開フォームの置き場所（7ブランドの `/form/` と KHG の `/khg/form/`）へ、⚠️ **いつもと同じ手順で**差し替える。
- ⚠️ v2.2.188 の公開フォームをまだ出していない場合は、この build で一緒に出る（LINE ID・デザイン変更も含む）。

## 手順6　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-12_update_log_2.2.189.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```
⚠️ 一番上が `2.2.189` なら完了。

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | パラメータ付きのページ（例 `…/event/?utm_source=test`）でテスト送信（⚠️ テスト用のキャンペーンで） | inquiry_customer の `url_params`・`landing_params` が `utm_source=test` |
| 2 | 同じブラウザで、パラメータ無しのフォームのページからもう一度送信 | `url_params` は NULL、`landing_params` は `utm_source=test` |
| 3 | その反響を同期 | master_data の 2 列に同じ値 |

```sql
SELECT inquiry_id, url_params, landing_params FROM inquiry_customer ORDER BY id DESC LIMIT 5;
```

## 切り戻し
| 対象 | 方法 |
|---|---|
| ② | v2.2.188 の production で `dcp build` / `up -d`（⚠️ 列は残してよい） |
| ① PHP | 2ファイルを v2.2.188 のものに戻す |
| ① フロント | v2.2.188 の index.html と本体に戻す |
| 公開フォーム | 前の build に戻す（⚠️ ソースは `form_get_backup_2026-10-12_v189/` の2ファイル。pageParams.ts は残っていても使われない） |
| DB | ⚠️ 列は消さない |
