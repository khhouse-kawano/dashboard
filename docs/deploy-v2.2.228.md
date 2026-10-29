# デプロイ手順 v2.2.228　担当事業の入れる範囲を「注文／建売／中古・不動産企画係」に（estate をなくす）

| 担当事業 | 入れる事業 |
|---|---|
| order | 注文 |
| spec | 建売 |
| used・realty | 中古リノベ・不動産企画係（どちらの値でも両方） |
| all | すべて（変わらない） |

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | estate（v2.2.227 で足した「建売・中古・不動産企画係」）の人が残っていれば元に戻す | ⚠️ **① DB** `backend/scripts/sql/2026-10-29_staff_shop_estate_cleanup.sql`（**最初に**） |
| 2 | 不動産企画係のデータに used の人も入れる・estate を権限編集で保存できる値から外す | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 3 | ① の不動産企画係の権限に used・estate を外す | ① PHP `core/authz.php` |
| 4 | 事業を選ぶ画面・不動産企画係の入口・業務ガイド・権限編集・日報（realty の人は中古リノベの分） | ① フロント（いつもの手順） |
| 5 | 更新履歴・業務ガイドの記事1本 | ① DB `backend/scripts/sql/2026-10-29_update_log_2.2.228.sql` |

⚠️ `2026-10-29_staff_shop_estate.sql` と `_restore.sql`（v2.2.227）は**もう流さない**（ファイルの先頭に書いた）。

## 順序
```
0. GitHub で v2.2.228 を main → production へマージ
1. ① SQL（estate の後始末）            ← ⚠️ 最初に（estate の人が残っていると 2〜4 のあとどこにも入れなくなる）
2. ② 再ビルド                          ← ⚠️ 実行中の Claudeによる分析が無いときに
3. ① PHP（authz.php）                  ← ⚠️ 2 より後
4. ① フロント
5. ① SQL（更新履歴・ガイド）
```

### 手順1　【① phpMyAdmin】estate の後始末
ファイル: `backend/scripts/sql/2026-10-29_staff_shop_estate_cleanup.sql`
- 本番は 2026-10-29 に estate の SQL を流してから戻したので、**ふつうは 1) が0行で、何も変わらない**（念のための確かめ）
- 1) に人が出たら 2) で控え（staff_shop_bk_227）から元の担当事業に戻る
- 3) は0行ならよい。出たら権限編集で order / spec / used / realty / all のどれかに直す
- 4) の担当事業ごとの人数に estate が出なければよい
- 2回流しても壊れない

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

### 手順3　【① FTP】PHP 1ファイル
アップロード（`/dashboard/api/gateway/` の下）:
- `core/authz.php`

確認（トークン無し）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"lead"}'
```
⚠️ `認証が必要です。`（401）ならよい。

### 手順4　【① フロント】いつもの手順

### 手順5　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-29_update_log_2.2.228.sql`

## 終わったら（動作確認）
- 中古の人で入ると、事業を選ぶ画面で中古リノベと不動産企画係に入れる（注文・建売は「閲覧権限がありません」）
- 不動産企画係の人で入ると、中古リノベと不動産企画係に入れる。業務ガイドのボタンが出る
- 建売の人は建売だけ
- 権限編集の担当事業の選択肢に「建売・中古・不動産企画係」が無い
