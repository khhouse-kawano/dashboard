# デプロイ手順 v2.2.237　売り反響の反響元を「HOME'S」にそろえる・反響元が消える不具合の修正

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | HOME'S の査定依頼メールの自動登録の反響元を "HOME's" → **"HOME'S"** | ⚠️ **② VPS（再ビルド）** |
| 2 | 売り反響の一覧の反響元の欄：値が変わったときだけ保存。選択肢に無い反響元もその値を出す | ① フロント |
| 3 | 既存の "HOME's" を "HOME'S" に（売り反響・媒介獲得台帳・買い反響・設定の反響元と反響単価）。空（NULL）に上書きされた売り反響の反響元を戻す。更新履歴・業務ガイド | ① DB `backend/scripts/sql/2026-10-30_update_log_2.2.237.sql` |

⚠️ 表の変更は**ありません**。① の PHP の変更もありません。

## 原因（本番で反響元が NULL だった件）
- 取り込みは反響元 "HOME's" を入れて登録していた（② のログ・処理は正常）
- 売り反響の一覧の反響元の欄は、選択肢（HOME'S など）に無い値だと「反響元」（空）と表示され、**欄を触って離れただけで空のまま保存**していた → source が NULL に上書きされた
- ⚠️ 同じことが、選択肢に無い反響元（営業案件・求むチラシ・問合せ・営業紹介 など）の行でも起きる状態だった

## 順序
```
0. GitHub で v2.2.237 を main → production へマージ
1. ② 再ビルド                ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① SQL                     ← ⚠️ 1回だけ流す（4 の更新履歴は流すたびに1行増える）
3. ① フロント
```

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
確認（合い言葉なし）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"homes_sale_assessment_entry"}'
```
⚠️ `合い言葉が違います。`（401）ならよい。

### 手順2　【① SQL】データの修正・更新履歴・業務ガイド
phpMyAdmin、または ① に SSH で入って:
```bash
mysql --default-character-set=utf8mb4 -h <MySQLホスト名> -u <MySQLユーザー> -p <DB名> < ~/2026-10-30_update_log_2.2.237.sql
```
途中の確認の行（3）:
- `source_lower_left`・`settings_lower_left` が 0、`settings_json_ok` が 1 ならよい
- `leads_source_empty_left` は「戻せなかった売り反響（反響元が空のまま）」の数。0 でなければ、画面で反響元を選び直す

### 手順3　【① フロント】いつもの手順

## 終わったら（動作確認）
- 売り反響の一覧で、HOME'S の反響の反響元の欄が「HOME'S」と出る（空にならない）
- 反響元別の表の「HOME'S」に、反響単価（設定の値）が付いている
- 「営業案件」などの反響の反響元の欄を触っても、反響元が消えない
- 次に届いた HOME'S の査定依頼メールの反響元が「HOME'S」で入る
