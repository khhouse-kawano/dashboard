# デプロイ手順 v2.2.225　不動産企画係: 歩留まりを以前のアプリと同じに・取り込みの全面差し替え

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `planner:lead` が設定も返す／取り込みに全面差し替え（`hideScope: 'all'`）／販売報告の取り込みの直し（v2.2.224 のマージに入っていなかった分） | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | `planner_lead.php`（① の予備。設定も返す） | ① PHP 1ファイル |
| 3 | 売り反響・買い反響の画面の歩留まり（タイル・反響元別／ポータル別・担当者別）を以前のアプリと同じに。期間は月別（今期）・通期・全期間。チームサマリーの KPI 表を以前のアプリと同じ列に。取り込みカードに範囲の選択 | ① フロント（いつもの手順） |
| 4 | 更新履歴・業務ガイドの記事2本（新規「売り反響・買い反響の歩留まり（不動産企画係）」、「設定（不動産企画係）」の取り込みの節） | ① DB `backend/scripts/sql/2026-10-28_update_log_2.2.225.sql` |

⚠️ DB の表の変更は**ありません**。⚠️ `express_proxy.php` の変更も**ありません**。

## 順序
```
0. GitHub で v2.2.225 を main → production へマージ
1. ② 再ビルド
2. ① PHP（planner_lead.php）
3. ① フロント
4. ① SQL（更新履歴・ガイド）
5. 本番のデータを差し替える（下の B。明日の利用開始の前に）
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

### 手順2　【① FTP】PHP
アップロード（`/dashboard/api/gateway/` の下）:
- `handlers/plannerAction/planner_lead.php`

### 手順3　【① フロント】いつもの手順
### 手順4　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-28_update_log_2.2.225.sql`

## B. 本番のデータを差し替える（docs/deploy-v2.2.224.md の B と同じ。違いは範囲の選択だけ）
1. ① phpMyAdmin: `backend/scripts/sql/2026-10-28_realty_import_1_backup.sql`（控え）
2. 以前のアプリ: 「🔄 サーバーから再取得」→「📥 バックアップを保存（JSON・書類除く）」
3. Dashboard（マスター）: 不動産企画係の設定 → 一番下でファイルを選ぶ
   - 範囲は **「全面差し替え」**（はじめから選ばれている）。ファイルに無い行はすべて非表示になる（Dashboard のポータル取り込みで二重になっていた反響も消える）
   - ローカルで今日のファイルを流したとき: 非表示 118件（売り47・買い62・変更履歴7・通知2）
4. ① phpMyAdmin: `backend/scripts/sql/2026-10-28_realty_import_2_check.sql`（確認。「うち以前のアプリに無い行」の列が増えた）

## 終わったら（動作確認）
- 売り反響の画面で、期間「2026年10月」のタイルと担当者別ファネルが、以前のアプリの「📨 反響リード管理」と同じ数字
- 買い反響の画面で、同じく以前のアプリの「🏠 買い反響（ポータル）管理」と同じ数字
- 期間の選択に「通期（期ごと）」「全期間」がある
- ⚠️ 反響元別の表で件数が同じ行の並びは、以前のアプリと違うことがある（以前のアプリでも決まった順ではない）
