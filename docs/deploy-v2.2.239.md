# デプロイ手順 v2.2.239　中古リノベの「今日の架電キュー」

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 架電キューの一覧と記録（新しい `features/callq/usedQueue.ts`・`gateway/registry.ts`） | ⚠️ **② VPS（再ビルド）** |
| 2 | 許可リストに `callq_used:list`・`callq_used:mark`（`expressProxyRequests()` と `expressProxyExclusive()` の両方） | ① `backend/src/core/express_proxy.php` |
| 3 | 画面（メニュー・`callq/UsedCallQueue.tsx`・業務ガイドの画面の登録）・版の番号 | ① フロント |
| 4 | 更新履歴・業務ガイド「今日の架電キュー（中古リノベ）」 | ① DB `backend/scripts/sql/2026-11-03_update_log_2.2.239.sql` |

⚠️ 表の変更は**ありません**（架電記録は今までどおり `call_sheet.call_log` に足す）。
⚠️ 新しい request が**あります**。① の express_proxy.php を上げ忘れると、画面が「該当する処理がありません」（404）になります。

## 順序
```
0. GitHub で v2.2.239 を main → production へマージ
1. ② 再ビルド                    ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① express_proxy.php
3. ① フロント
4. ① SQL（更新履歴・業務ガイド）    ← ⚠️ 1回だけ
```
⚠️ ② を先に上げる。① の許可リストだけ先に入ると、② に処理が無く 502 になります。

### 手順1　【② VPS で実行】再ビルド
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
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"callq_used","roll":"list"}'
```
⚠️ `認証が必要です。`（401）ならよい。

### 手順2　【① FTP】PHP 1ファイル
`/dashboard/api/gateway/core/express_proxy.php` を上書き。

確認（トークンなし。① を通す）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"callq_used","roll":"list"}'
```
⚠️ `認証が必要です。`（401）ならよい。`該当する処理がありません`（404）なら許可リストが上がっていない。

### 手順3　【① フロント】いつもの手順

### 手順4　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-03_update_log_2.2.239.sql` を1回流す。

## 終わったら（動作確認）
中古リノベでログイン → 左のメニュー「全社報告用フォーマット」の下の「今日の架電キュー」:
- 上に「今日の架電」「今週の架電」「今月の架電」の数が出る（ローカルでは今月 142件＝11月の通電・未通電・SMS送信の数）
- 次回架電日が今日以前で、その日以降にまだ架電していないお客様のカードが並ぶ（ローカルでは2件）
- アクションを選んでメモを書き「記録」→ カードが「記録済」になり、今週・今月の数が1つ増える
- 「開く」でお客様の詳細が開き、架電記録に今の記録が出ている
- 業務ガイドの「今日の架電キュー（中古リノベ）」の記事から画面が開く

## 注意
- ⚠️ 今は次回架電日がほとんど入っていない（ローカルでは全期間で14件）。キューに並ぶお客様は少ない。現場に「かけ直す予定には次回架電日を入れる」ことを伝える
- ⚠️ お客様の詳細を開いたまま、ほかの人がこの画面で同じお客様に記録すると、詳細の保存でその記録が消えることがある（詳細の画面が架電記録を丸ごと書き戻すため。以前からの動き）。業務ガイドに書いてある

## 切り戻し
- 記録だけ止める：① の express_proxy.php から `callq_used:mark` の2行を消す（① に PHP は無いので 404 になる）
- 画面ごと止める：① のフロントを前の版に戻す
