# デプロイ手順 v2.2.188（LINE ID ／ キャンペーン設定・公開フォームのデザイン変更）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | LINE ID の列（フォーム設定2テーブル＋反響3・顧客3テーブル） | ⚠️ **① DB**（`2026-10-12_line_id_columns.sql`） |
| 2 | フォーム設定の保存・公開フォームへの設定・送信の保存・メールに LINE ID ／ 反響一覧が line_id を返す ／ 顧客へ保存できる | ⚠️ **② VPS**（campaignForm 4ファイル・list/queries.ts・masterDataColumns.ts） |
| 3 | 反響一覧（フォールバック）が line_id を返す ／ 顧客へ保存できる ／ 中古の取り込み ／ 顧客の統合で LINE ID を引き継ぐ | ⚠️ **① PHP**（allowed_columns.php・list_order/spec/used.php・list_resale_sync.php・integrate_spec/used.php） |
| 4 | キャンペーン設定に LINE ID の行 ＋ ⚠️ **画面を作り直し（設定カード＋右にプレビュー）** ／ 取り込みで LINE ID を送る ／ 顧客の編集画面に LINE ID とアイコン | ① フロント（dashboard） |
| 5 | 公開フォームに LINE ID の入力欄・確認画面 ＋ ⚠️ **見た目を作り直し（ブランド色の差し色）** ／ ⚠️ **289件すべてのフォームに一度に効く** | ⚠️ **公開フォーム**（react/form_get の build → 各ブランドの /form/ と /khg/form/ へ） |
| 6 | 更新履歴 | ① DB |

## 順序（⚠️ この順を守る）
```
0. GitHub で v2.2.188 を main → production へマージ
1. ① DB（2026-10-12_line_id_columns.sql）   ← ⚠️ 必ず最初
2. ② Express（build）
3. ① PHP（7ファイル）
4. ① フロント（build）
5. 公開フォーム（form_get の build）
6. ① SQL（update_log）
```
- ⚠️⚠️ **1 より先に 2 を出さないこと。** ② の送信処理が `inquiry_customer.line_id` に書くので、列が無いと ⚠️ **フォームからの反響がまるごと保存できなくなる**。
- ⚠️ 1 を先に出すのは安全（⚠️ 列が増えるだけ。既定値付きなので古い保存処理も落ちない）。
- ⚠️ 5 は 2 の後（⚠️ ② が古いと設定に line_id が来ないので LINE ID の欄が出ないだけ。壊れはしない）。
- ⚠️ ② が落ちたときの退避先（① `khg-marketing.info/api/` の form_register）は**このリポジトリに無く、今回は直していない**。退避で受けた反響は LINE ID が保存されず、メールにも載らない（下書き `backend/forms/khg-api-form-register.snippet.php` だけ直した）。

## 手順1　【① phpMyAdmin】列の追加
⚠️ ファイル: `backend/scripts/sql/2026-10-12_line_id_columns.sql`（何度流しても壊れない。⚠️ 既存の全フォームは列を足したときに既定値「表示・任意・LINE IDをご入力ください」で埋まる。⚠️ 2回目以降に流しても、スタッフが変えた設定は上書きしない）
⚠️ この1本で **8テーブル**に `line_id` 列を足す:
| テーブル | 位置 | 型 |
|---|---|---|
| `form_table` / `form_database` | `mail` の次 | JSON（項目の設定。既定値「表示・任意・LINE IDをご入力ください」） |
| `inquiry_customer` / `inquiry_customer_kaeru` / `inquiry_customer_resale` | `mail` の次 | TEXT（空は NULL） |
| `master_data` / `master_data_kaeru` / `master_data_resale` | `customer_contacts_email` の次 | TEXT（空は NULL） |

⚠️ 最後の確認の結果:
- form_database / form_table の `rows_all` と `line_on` が同じ数
- 反響3・顧客3テーブルの `filled` が 0（まだ値が無い）

## 手順2　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "OPTIONAL_JSON_COLUMNS = " backend-express/src/features/campaignForm/index.ts
grep -n "const cleanLineId" backend-express/src/features/campaignForm/entry.ts
```
⚠️ それぞれ1行出れば v2.2.188 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順3　【① レンタルサーバー】PHP
| ファイル | |
|---|---|
| `backend/src/core/allowed_columns.php` | 顧客へ保存してよい列に line_id |
| `backend/src/handlers/listAction/list_order.php` / `list_spec.php` / `list_used.php` | 反響一覧に line_id |
| `backend/src/handlers/list_resale_sync.php` | 中古の取り込みに line_id |
| `backend/src/handlers/integrateAction/integrate_spec.php` / `integrate_used.php` | 顧客の統合で、統合先が空なら統合元の LINE ID を入れる |

## 手順4　【WSL】フロントを ① へアップロード
| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.12d99c58.js`** | ⚠️ **この版の本体** |
| ⚠️⚠️ **`static/css/main.b8a7c60b.css`** | ⚠️ **今回は CSS も変わる**（キャンペーン設定の画面）。⚠️ 何度か作り直したので、これ以前の main.*.css ではない |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |
```bash
deploy-dashboard
```

## 手順5　公開フォーム（form_get）
⚠️ `C:\Users\shinji-kawano\react\form_get` は git 管理外。⚠️ 変更前のファイルはスクラッチの `form_get_backup_2026-10-12/`（Form.tsx・Confirm.tsx・brands.ts・App.css）にある（切り戻し用）。
```powershell
cd C:\Users\shinji-kawano\react\form_get
npm run build
```
- ⚠️ できた `dist/` を、いつもの公開フォームの置き場所（7ブランドの `/form/` と KHG の `/khg/form/`）へ、⚠️ **いつもと同じ手順で**差し替える。
- ⚠️ 新しい CSS（publicForm.css）は build の中に入る（別にアップロードする物は無い）。
- ⚠️ 出す前に、1ブランドで「入力 → 確認 → 送信」が通ることを見ること（⚠️ 送信すると本番に反響が1件入るので、テスト用のキャンペーンで）。

## 手順6　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-12_update_log_2.2.188.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```
⚠️ 一番上が `2.2.188` なら完了。

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | キャンペーン設定を開く | 左に設定のカード、右にプレビュー。フォーム項目のメールアドレスの下に LINE ID（表示・任意・既定の文言）。項目の表示・必須・見出しを変えるとプレビューがその場で変わる |
| 2 | キャンペーン設定で保存 → もう一度開く | 保存した内容が出る。⚠️ 項目の表示を外して付け直しても、見出し・必須が残る |
| 3 | 公開フォーム（PC・スマホ） | カードでまとまった見た目、ボタンがブランド色。ご連絡先のメールアドレスの下に LINE ID の欄。必須を空のまま進むと赤枠とメッセージ（お名前・ご住所も） |
| 4 | テスト送信（LINE ID あり） | 反響一覧の行に line_id、社内通知メールとサンクスメールの内容に `LINE ID：…` |
| 5 | その反響を同期 | 顧客の編集画面の連絡先に LINE ID |
| 6 | LINE のアイコン | LINE ID がコピーされ、LINE WORKS のトークが新しいタブで開く。LINE ID が空なら薄く押せない |
| 7 | フォームの HTML を作る画面（FormBuilder） | LINE ID を表示にしたキャンペーンで、LINE ID の欄が選べる |

## 切り戻し
| 対象 | 方法 |
|---|---|
| ② | v2.2.187 の production で `dcp build` / `up -d`（⚠️ 列は残してよい） |
| ① PHP | 7ファイルを v2.2.187 のものに戻す |
| ① フロント | v2.2.187（`main.13340c4e.js`・`main.7c10f266.css`）の index.html と本体・CSS に戻す |
| 公開フォーム | 前の build に戻す（⚠️ ソースは `form_get_backup_2026-10-12/` の4ファイル） |
| DB | ⚠️ 列は消さない（入った LINE ID が消えるため） |
