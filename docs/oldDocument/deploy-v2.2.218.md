# デプロイ手順 v2.2.218　紹介キャンペーンサマリーの担当別・Claudeによる分析を1日1回・権限の表示を自動で更新

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 紹介キャンペーンサマリーに「担当別」を返す・Claudeによる分析の上限を1人1日1回に | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | 画面（担当別の表・上限の表示・権限の表示を自動で更新） | ① フロント（いつもの手順） |
| 3 | 更新履歴・業務ガイドの記事2本 | ① DB `backend/scripts/sql/2026-10-26_update_log_2.2.218.sql` |

⚠️ ① の PHP の変更は**ない**。
⚠️ **v2.2.217 のデプロイが済んでいること**（Claudeによる分析の表・API キー）。まだなら先に deploy-v2.2.217.md を終える。

## 順序
```
0. GitHub で v2.2.218 を main → production へマージ
1. ② 再ビルド                ← ⚠️ 実行中の Claudeによる分析が無いときに（作り直すと中断で失敗になる）
2. ① フロント
3. ① SQL（更新履歴・ガイド）
```

## 手順1　【② VPS で実行】再ビルド
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
確認（受け口が動いているか。保存も課金もされない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"introductory_summary"}'
```
⚠️ `認証が必要です。`（401）が返ればよい。

## 手順2　【① フロント】いつもの手順

## 手順3　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-26_update_log_2.2.218.sql`（更新履歴1行と、記事「紹介キャンペーンサマリー」「Claudeによる分析」の上書き）

## 終わったら（動作確認）
1. ヘッダー → 紹介キャンペーン → 紹介キャンペーンサマリー を開き、いちばん下（店舗別の下）に「担当別」が出ること
   - 1人の数字を、営業別契約率や顧客DBと見比べる（⚠️ 担当別は「担当営業」と「商談シートに記録した人」の両方で数えるので、営業別契約率とは数え方が違う）
2. Claudeによる分析を開き、「1人1日 1 回まで」と出ること
3. 権限編集で誰かの権限を変え、その人が**再ログインせずに**画面を移ると、メニュー（Claudeによる分析のボタンなど）が変わること
   - ⚠️ 反映されるのは、次に画面を移ったとき（ページの再読み込みでもよい）
