# デプロイ手順 v2.2.225　不動産企画係: 以前のアプリと同じメニュー・集計・分析／歩留まりを以前のアプリと同じに／取り込みの全面差し替え

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `planner:records`（種類を指定して行と設定を読む。新しい画面用）・`planner:lead` が設定も返す・取り込みの全面差し替え・販売報告の取り込みの直し（v2.2.224 のマージに入っていなかった分） | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | `planner:records` を ① から ② へ転送 | ① PHP `core/express_proxy.php` |
| 3 | `planner_lead.php`（① の予備。設定も返す） | ① PHP `handlers/plannerAction/planner_lead.php` |
| 4 | 不動産企画係のメニュー（以前のアプリと同じ見出し・順番。未移行は「移行中」）、月次売上管理・月次媒介管理・失注・他決の分析、チームサマリーを以前のダッシュボードの並びに（営業司令塔は最下段・買取再販の期限アラート）、売り反響・買い反響の歩留まりを以前のアプリと同じに、取り込みの範囲の選択 | ① フロント（いつもの手順） |
| 5 | 更新履歴・業務ガイドの記事7本（新規4本・修正3本） | ① DB `backend/scripts/sql/2026-10-28_update_log_2.2.225.sql` |

⚠️ DB の表の変更は**ありません**。

## 順序
```
0. GitHub で v2.2.225 を main → production へマージ
1. ② 再ビルド                         ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① PHP（express_proxy.php・planner_lead.php）  ← ⚠️ 1 より後
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

### 手順2　【① FTP】PHP 2ファイル
アップロード（`/dashboard/api/gateway/` の下）:
- `core/express_proxy.php`（`planner:records` を ② へ転送。② だけ）
- `handlers/plannerAction/planner_lead.php`（設定も返す）

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"records","kinds":["deals"]}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。

### 手順3　【① フロント】いつもの手順
### 手順4　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-28_update_log_2.2.225.sql`

## B. 本番のデータを差し替える（docs/deploy-v2.2.224.md の B と同じ。違いは範囲の選択だけ）
1. ① phpMyAdmin: `backend/scripts/sql/2026-10-28_realty_import_1_backup.sql`（控え）
2. 以前のアプリ: 「🔄 サーバーから再取得」→「📥 バックアップを保存（JSON・書類除く）」
3. Dashboard（マスター）: 不動産企画係の「設定・データ管理」→ 一番下でファイルを選ぶ
   - 範囲は **「全面差し替え」**（はじめから選ばれている）。ファイルに無い行はすべて非表示になる（Dashboard のポータル取り込みで二重になっていた反響も消える）
   - ローカルで今日のファイルを流したとき: 非表示 118件（売り47・買い62・変更履歴7・通知2）
4. ① phpMyAdmin: `backend/scripts/sql/2026-10-28_realty_import_2_check.sql`（確認。「うち以前のアプリに無い行」の列が増えた）

## 終わったら（動作確認）
- 不動産企画係の左のメニューが「日々の行動／集計・分析／入力・台帳／点検・管理／Dashboard」の見出しで並ぶ。未移行の5つに「移行中」
- チームサマリーの並びが以前のアプリのダッシュボードと同じ（最下段に営業司令塔）
- 月次売上管理・月次媒介管理・失注・他決の分析の数字が、以前のアプリの同じ画面と同じ
- 売り反響・買い反響の画面の期間「2026年10月」のタイルと担当者別ファネルが、以前のアプリと同じ
- ⚠️ 件数が同じ行の並び（反響元別・失注の理由など）は、以前のアプリと違うことがある（以前のアプリでも決まった順ではない）

## まだ移していない画面（メニューに「移行中」。以前のアプリを使う）
今日の架電キュー・架電ナビ（一括査定）・売主への販売報告・媒介更新履歴・データ品質チェック。
商談案件管理・買取再販案件・媒介獲得台帳・売り反響／買い反響の一覧部分は Dashboard の画面のまま（以前のアプリと同じ画面にするのは次の版から）。
