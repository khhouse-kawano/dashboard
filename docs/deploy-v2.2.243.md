# デプロイ手順 v2.2.243　広告費の「詳細」・予算テーブル

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | budget に `remarks` を足し、請求先の括弧書き（例 `フルキャスト(派遣スタッフ)`）を remarks へ分ける | ① DB `backend/scripts/sql/2026-11-04_budget_remarks.sql` |
| 2 | 広告費入力で remarks を読み書きする（`eventBudget.ts`）。新しい `budget_table_list`・`budget_table_upload`（`budgetTable.ts`・`registry.ts`） | ⚠️ **② VPS（再ビルド）** |
| 3 | 許可リストに `budget_table_list`・`budget_table_upload` を入れる | ① PHP 1ファイル（`core/express_proxy.php`） |
| 4 | 広告費入力の「詳細」の列、「システム管理 → 予算テーブル」、版の番号 | ① フロント |
| 5 | 更新履歴・業務ガイド「予算テーブル」「イベントの広告費入力」（新規）・「ヘッダーのメニュー」（上書き） | ① DB `backend/scripts/sql/2026-11-04_update_log_2.2.243.sql` |

⚠️ 新しい request が2つあり、どちらも ② だけにあります。① の express_proxy.php を上げ忘れると、「該当する処理がありません」（404）になります。

## 順序
```
0. GitHub で v2.2.243 を production へマージ（PR）
1. ① SQL（列の追加と請求先の分割）   ← ⚠️ 先に。② が remarks を読むため、列が無いと広告費入力がエラーになる
2. ② 再ビルド                         ← ⚠️ 実行中の Claude による分析が無いときに
3. ① PHP 1ファイル
4. ① フロント
5. ① SQL（更新履歴・業務ガイド）       ← ⚠️ 1回だけ
```

### 手順1　【① SQL】列の追加と請求先の分割
phpMyAdmin（または SSH の mysql）で `2026-11-04_budget_remarks.sql` を流します。何度流しても同じ結果になります。
- 途中の SELECT に、分ける行の一覧が出ます。ローカルでは129行でした。本番では、ローカルにない新しい行の分だけ増えることがあります
- 最後の SELECT で、`company_with_paren` が 0 になり、`rows_with_remarks` が分けた行の数と同じならよいです

SSH で流すとき（`-p` だけにして、パスワードは聞かれてから入力）:
```bash
mysql --default-character-set=utf8mb4 -h MYSQLホスト名 -u MYSQLユーザー名 -p DB名 < 2026-11-04_budget_remarks.sql
```

> ⚠️ `Downloads/budget_formatted.csv`（整形した CSV）を使って表を丸ごと入れ直す場合は、この SQL は要りません。ただし、入れ直す前の表の内容と同じかどうかは、オーナーが確かめてください。CSV を作ったあとに登録された行は入っていません。**どちらか一方だけ**にしてください。

### 手順2　【② VPS で実行】再ビルド
実行中の分析が無いことを ① の phpMyAdmin で確かめます（0行ならよい）:
```sql
SELECT id, staff_name, status FROM ai_analysis_job WHERE status IN ('queued','running') AND deleted_at IS NULL;
```
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
確認（トークンなし。② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"budget_table_list"}'
```
⚠️ `認証が必要です。`（401）ならよいです。⚠️ 404 なら、production に v2.2.243 が入っていません（手順0を確かめる）。

### 手順3　【① FTP】PHP 1ファイル
| ① の場所 | 元のファイル |
|---|---|
| `/dashboard/api/gateway/core/express_proxy.php` | `backend/src/core/express_proxy.php` |

確認（トークンなし。① を通す）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"budget_table_list"}'
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"budget_table_upload"}'
```
⚠️ どちらも `認証が必要です。`（401）ならよいです。`該当する処理がありません`（404）なら、express_proxy.php が古いです。

### 手順4　【① フロント】いつもの手順

### 手順5　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-04_update_log_2.2.243.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.243 で、1行だけならよいです。

## 終わったら（動作確認）
1. 管理者で「集客イベント → 広告費入力」を開く
   - 請求先の右に「詳細」の列が出て、「派遣スタッフ」などが入っていればよいです
2. 「システム管理 → 予算テーブル」を開く（管理者・ブランド管理者）
   - 一覧と合計が出て、表をスクロールしても上の絞り込みが動かなければよいです
   - 「広告費の登録」→ CSV を選ぶと、確かめた結果が出ます（まだ登録はされません）。本番で試すときは、登録まで押さないでください
3. マネージャーなどでは、「システム管理」に「予算テーブル」が出ない
4. 版の表示が ver2.2.243

## 注意
- ⚠️ 予算テーブルから同じ CSV を2回登録すると、広告費が2重になります（budget に重複を防ぐ仕組みがないため）。確かめた結果の「同じ内容がすでにある行」を見てから登録してください。
- 予算テーブルでは、行の修正・削除はできません。
- budget の id 1 の行は、中身が見出しの文字になっています。前からある行で、今回は触っていません。

## 切り戻し
- 画面だけ戻す：① のフロントを v2.2.242 に戻す
- ② を v2.2.242 に戻すと、広告費入力は詳細を読み書きしなくなります。列と値は残ります。⚠️ ただし、その間に請求先を直すと、詳細の内容は請求先に戻りません
- 列は残してかまいません。請求先を元の `会社名(詳細)` に戻す必要があるときは、次を流します:
```sql
UPDATE budget SET company = CONCAT(company, '(', remarks, ')'), remarks = NULL WHERE remarks IS NOT NULL;
```
