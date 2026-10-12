# デプロイ手順 v2.2.187

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 顧客一覧（注文・建売）の取得で ⚠️ **氏名②（`customer_2`）も返す** | ⚠️ **② VPS**（`features/database/queries.ts`） |
| 2 | 顧客一覧（注文・建売のフォールバック／中古）と、非表示・戻す・中古コピーの後の一覧で ⚠️ **`customer_2` も返す** | ⚠️ **① PHP**（`handlers/databaseAction/` の7ファイル） |
| 3 | 顧客一覧（注文・建売・中古）: 氏名②があれば ⚠️ **顧客名の2行目に表示**、⚠️ **名前検索の対象** | ① フロント |
| 4 | 更新履歴に1行 | ① DB |

⚠️ **DB の列・LP は変更なし**（customer_contacts_name_2 は3テーブルとも既にある）。

## 順序
```
0. GitHub で v2.2.187 を main → production へマージ
1. ② Express（build）
2. ① PHP（7ファイル）
3. ① フロント（build）
4. ① SQL（update_log）
```
- ⚠️ どの順でも壊れない（⚠️ フロントは customer_2 が来なければ1行のまま）。⚠️ ただし 1・2 が済むまで2行目は出ない。
- ⚠️ 注文・建売は ② が応答する。⚠️ 中古は ① だけ。⚠️ ① だけ出すと注文・建売は2行目が出ない。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "AS customer_2" backend-express/src/features/database/queries.ts
```
⚠️ 2行出れば v2.2.187 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順2　【① レンタルサーバー】PHP
| ファイル（`backend/src/handlers/databaseAction/`） | |
|---|---|
| `database_order.php` | 注文（② のフォールバック） |
| `database_spec.php` | 建売（② のフォールバック） |
| `database_used.php` | 中古 |
| `database_order_trash.php` / `database_spec_trash.php` / `database_used_trash.php` | 非表示・戻すの後の一覧 |
| `database_used_copy.php` | 中古コピーの後の一覧 |

## 手順3　【WSL】フロントを ① へアップロード
| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.625b3c40.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |
```bash
deploy-dashboard
```

## 手順4　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-12_update_log_2.2.187.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```
⚠️ 一番上が `2.2.187` なら完了。

## 出したあとの確認
氏名②がある顧客は次の SQL で探せる（⚠️ テーブル名を master_data_kaeru / master_data_resale に変えて建売・中古も）
```sql
SELECT id, customer_contacts_name, customer_contacts_name_2
FROM master_data
WHERE TRIM(COALESCE(customer_contacts_name_2, '')) <> ''
LIMIT 5;
```
| # | 見ること | 期待 |
|---|---|---|
| 1 | ヘッダーの版 | **2.2.187** |
| 2 | 注文・建売・中古の顧客一覧で、上の顧客 | 顧客名の下に氏名②（小さめの灰色） |
| 3 | 氏名②が無い顧客 | 1行のまま |
| 4 | 「顧客名で検索」に氏名②の名前 | その顧客が出る |
| 5 | その顧客を非表示 → 戻す（中古はコピーも） | 操作後も2行目が残る |

## ⚠️ 既知のこと
- ⚠️ ① `database_order.php`（注文のフォールバック）は、ローカルの CLI（memory_limit 128M）ではメモリが足りなかった（ピーク約151MB）。⚠️ 今回の追加は1列で、既存の作りによるもの。⚠️ 注文は通常 ② が応答するので、② が落ちたときだけの話。

## 切り戻し
| 対象 | 方法 |
|---|---|
| ② | v2.2.186 の production で `dcp build` / `up -d` |
| ① PHP | 7ファイルを v2.2.186 のものに戻す（⚠️ 戻しても画面は1行になるだけで壊れない） |
| ① フロント | v2.2.186（`main.d77bae53.js`）の index.html と本体に戻す |
