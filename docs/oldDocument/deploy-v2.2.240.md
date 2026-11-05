# デプロイ手順 v2.2.240　金利データ（プラン別金利・毎月の分析レポート）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい表 `loan_plan_rate` | ① DB `backend/scripts/sql/2026-11-03_loan_plan_rate.sql` |
| 2 | 10月・11月の初期データ（1,079行・1,104行） | ① DB `backend/scripts/sql/2026-11-03_loan_plan_rate_seed.sql` |
| 3 | 金利データの読み出しと登録（新しい `features/loanPlanRate.ts`・`gateway/registry.ts`） | ⚠️ **② VPS（再ビルド）** |
| 4 | 許可リストに `loan_plan_rate_list`・`loan_plan_rate_upload`（`expressProxyRequests()` と `expressProxyExclusive()` の両方） | ① `backend/src/core/express_proxy.php` |
| 5 | 画面（ヘッダーの「金利データ」・`header/LoanRates.tsx`・`header/LoanRateUpload.tsx`・業務ガイドの画面の登録）・架電キューの初期表示（全員）・版の番号 | ① フロント |
| 6 | 更新履歴・業務ガイド「金利データ」（新規）・「業務ガイドの使い方」「今日の架電キュー（中古リノベ）」（上書き） | ① DB `backend/scripts/sql/2026-11-03_update_log_2.2.240.sql` |
| 7 | 10月・11月の分析レポート（HTML） | ① 画面から登録（手順6） |

⚠️ 新しい request が**あります**。① の express_proxy.php を上げ忘れると「該当する処理がありません」（404）になります。
⚠️ 既存の表は変えません（資金計画書の金利 `loan_product` / `loan_rate` にも触りません）。

## 順序
```
0. GitHub で v2.2.240 を main → production へマージ
1. ① SQL（表 → 初期データ）
2. ② 再ビルド                    ← ⚠️ 実行中の Claudeによる分析が無いときに
3. ① express_proxy.php
4. ① フロント
5. ① SQL（更新履歴・業務ガイド）    ← ⚠️ 1回だけ
6. ① 画面からレポート2本を登録      ← ⚠️ マスター権限で
```

### 手順1　【① SQL】表と初期データ
phpMyAdmin で次の順に流す:
1. `2026-11-03_loan_plan_rate.sql`（最後の確認で 0 が出ればよい）
2. `2026-11-03_loan_plan_rate_seed.sql`（最後の確認で 2026-10 = 1079・2026-11 = 1104 ならよい。何度流しても二重にはならない）

⚠️ seed は約660KB あります。phpMyAdmin の「インポート」から流してください（SQL 欄への貼り付けでは重いことがあります）。

### 手順2　【② VPS で実行】再ビルド
実行中の分析が無いことを ① の phpMyAdmin で確かめる（0行ならよい）:
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
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"loan_plan_rate_list"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ 404 なら production に v2.2.240 が入っていない（手順0を確かめる）。

### 手順3　【① FTP】PHP 1ファイル
`/dashboard/api/gateway/core/express_proxy.php` を上書き。

確認（トークンなし。① を通す）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"loan_plan_rate_list"}'
```
⚠️ `認証が必要です。`（401）ならよい。`該当する処理がありません`（404）なら express_proxy.php が古い。

### 手順4　【① フロント】いつもの手順

### 手順5　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-03_update_log_2.2.240.sql` を1回流す。

### 手順6　【① 画面】レポート2本の登録（マスター権限）
ヘッダーの「金利データ」→ 上の「月のデータを登録」で、Downloads の ReadMeClaud フォルダにある次のファイルを**1本ずつ**登録する（CSV は選ばない。プラン別金利は手順1で入っている）:
1. `rate_analysis_2026-10_dashboard.html`（対象月は自動で 2026-10 になる）→「登録」
2. `rate_analysis_2026-11_dashboard.html`（対象月は自動で 2026-11 になる）→「登録」

## 終わったら（動作確認）
ヘッダーの「マーケット情報」の右に、シアン色の「金利データ」が出る → 押す:
- 対象月が「2026年11月（1104件）」、上の数字が プラン数 1,104件・変動の最も低い金利 1.050%（九州労働金庫）・前月から上がった 332件・下がった 460件
- 絞り込み・見出しでの並べ替え・「前月から動いたものだけ」が動く
- 「分析レポート」で11月のレポートが出て、上のリンクで各項目へ移動できる。対象月を10月にすると10月のレポートになる
- 左のメニューは、ログインしている事業区分のまま
- 中古リノベの「今日の架電キュー」で、「自分の担当のみ」がはじめは外れている（チーム全員の分が出る）

## 注意
- ⚠️ 12月以降は、Claude デスクトップが作った `plan_rates_YYYY-MM.csv` と `rate_analysis_YYYY-MM.html` を手順6の画面から登録する（SQL は作らない）。同じ月の CSV を登録し直すと、その月は丸ごと入れ替わる
- ⚠️ 前月比は CSV の `prev` 列（Claude デスクトップが照合した前月の値）。11月分には、15年固定などで前月比 +1.35% のように大きく動いたプランがある。照合の誤りの可能性もあるので、気になるときは Claude デスクトップに確認する

## 切り戻し
- 登録だけ止める：① の express_proxy.php から `loan_plan_rate_upload` の2行を消す
- 画面ごと止める：① のフロントを前の版に戻す（表と行は残してよい）
