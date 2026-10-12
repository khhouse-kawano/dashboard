# デプロイ手順 v2.2.188（LINE ID）

⚠️ **作業中の版**。⚠️ NewCampaign.tsx と公開フォーム（form_get）のデザイン変更がこの後に入る予定。⚠️ 本体のファイル名はその後で確定させる。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | LINE ID の列（フォーム設定2テーブル＋反響3・顧客3テーブル） | ⚠️ **① DB**（`2026-10-12_line_id_columns.sql`） |
| 2 | フォーム設定の保存・公開フォームへの設定・送信の保存・メールに LINE ID ／ 反響一覧が line_id を返す ／ 顧客へ保存できる | ⚠️ **② VPS**（campaignForm 4ファイル・list/queries.ts・masterDataColumns.ts） |
| 3 | 反響一覧（フォールバック）が line_id を返す ／ 顧客へ保存できる ／ 中古の取り込み | ⚠️ **① PHP**（allowed_columns.php・list_order/spec/used.php・list_resale_sync.php） |
| 4 | キャンペーン設定に LINE ID の行 ／ 取り込みで LINE ID を送る ／ 顧客の編集画面に LINE ID とアイコン | ① フロント（dashboard） |
| 5 | 公開フォームに LINE ID の入力欄・確認画面 | ⚠️ **公開フォーム**（react/form_get の build → 各ブランドの /form/ へ） |
| 6 | 更新履歴 | ① DB |

## 順序（⚠️ この順を守る）
```
0. GitHub で v2.2.188 を main → production へマージ
1. ① DB（2026-10-12_line_id_columns.sql）   ← ⚠️ 必ず最初
2. ② Express（build）
3. ① PHP（5ファイル）
4. ① フロント（build）
5. 公開フォーム（form_get の build）
6. ① SQL（update_log）
```
- ⚠️⚠️ **1 より先に 2 を出さないこと。** ② の送信処理が `inquiry_customer.line_id` に書くので、列が無いと ⚠️ **フォームからの反響がまるごと保存できなくなる**。
- ⚠️ 1 を先に出すのは安全（⚠️ 列が増えるだけ。既定値付きなので古い保存処理も落ちない）。
- ⚠️ 5 は 2 の後（⚠️ ② が古いと設定に line_id が来ないので欄が出ないだけ。壊れはしない）。

## 手順1　【① phpMyAdmin】列の追加
⚠️ ファイル: `backend/scripts/sql/2026-10-12_line_id_columns.sql`（何度流しても壊れない）
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

## 手順4　【WSL】フロントを ① へアップロード
⚠️ 本体のファイル名はデザイン変更の後で確定させる。
```bash
deploy-dashboard
```

## 手順5　公開フォーム（form_get）
⚠️ デザイン変更の後で手順を確定させる。

## 手順6　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-12_update_log_2.2.188.sql`

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | キャンペーン設定を開く | メールアドレスの下に LINE ID（表示する・任意・既定の文言） |
| 2 | 公開フォーム | メールアドレスの下に LINE ID の欄 |
| 3 | テスト送信（LINE ID あり） | 反響一覧の行に line_id、社内通知メールの内容に `LINE ID：…` |
| 4 | その反響を同期 | 顧客の編集画面の連絡先に LINE ID |
| 5 | LINE のアイコン | LINE ID がコピーされ、LINE WORKS のトークが新しいタブで開く。⚠️ LINE ID が空なら薄く押せない |

## 切り戻し
| 対象 | 方法 |
|---|---|
| ② | v2.2.187 の production で `dcp build` / `up -d`（⚠️ 列は残してよい） |
| ① PHP | 5ファイルを v2.2.187 のものに戻す |
| ① フロント | v2.2.187（`main.13340c4e.js`）の index.html と本体に戻す |
| 公開フォーム | 前の build に戻す |
| DB | ⚠️ 列は消さない（⚠️ 消すと戻した ② 以外が落ちる心配は無いが、入った LINE ID が消える） |
