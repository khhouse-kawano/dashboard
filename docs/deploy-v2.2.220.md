# デプロイ手順 v2.2.220　紹介キャンペーンサマリーを紹介元で絞る

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `introductory_summary` が紹介元（`source`）で絞れるようになり、紹介元の選択肢（`sources`）を返す | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | 画面の絞り込みに「紹介元」 | ① フロント（いつもの手順） |
| 3 | 更新履歴・業務ガイドの記事「紹介キャンペーンサマリー」 | ① DB `backend/scripts/sql/2026-10-26_update_log_2.2.220.sql` |

⚠️ ① の PHP の変更は**ない**。⚠️ v2.2.217〜219 のデプロイが済んでいること。

## 順序
```
0. GitHub で v2.2.220 を main → production へマージ
1. ② 再ビルド                ← ⚠️ 実行中の Claudeによる分析が無いときに（作り直すと中断で失敗になる）
2. ① フロント                ← ⚠️ 1 の後（先にすると紹介元の選択肢が空のまま）
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

## 手順2　【① フロント】いつもの手順
## 手順3　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-26_update_log_2.2.220.sql`

## 終わったら（動作確認）
1. 紹介キャンペーンサマリーを開き、絞り込みのいちばん左に「紹介元」があること（選択肢に件数が付く）
2. 「オーナー様」などを選ぶと、上の数字と、店舗別・担当別などの表がその紹介元だけになること。紹介元別の表の数字と、選んだときの全体の数字が同じになること
3. 「絞り込みを外す」で紹介元も「すべて」に戻ること
