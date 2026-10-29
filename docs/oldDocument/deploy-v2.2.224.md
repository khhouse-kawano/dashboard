# デプロイ手順 v2.2.224　不動産企画係: 以前のアプリのデータを取り込む（本番のデータを最新にする）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 取り込みの処理（`planner:import_check` / `import_records` / `import_finish`。マスターだけ） | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | 上の3つを ① から ② へ転送する（① に PHP の処理は無い） | ① PHP 1ファイル `core/express_proxy.php` |
| 3 | 設定画面の一番下に「以前のアプリのデータを取り込む」（マスターだけ） | ① フロント（いつもの手順） |
| 4 | 更新履歴・業務ガイドの記事「設定（不動産企画係）」 | ① DB `backend/scripts/sql/2026-10-28_update_log_2.2.224.sql` |

⚠️ DB の表の変更は**ありません**。

## A. デプロイの順序
```
0. GitHub で v2.2.224 を main → production へマージ
1. ② 再ビルド                  ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① PHP（express_proxy.php）  ← ⚠️ 1 より後
3. ① フロント
4. ① SQL（更新履歴・ガイド）
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
- `core/express_proxy.php`

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"import_check"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。

### 手順3　【① フロント】いつもの手順
### 手順4　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-28_update_log_2.2.224.sql`

---

## B. データを最新にする（デプロイのあと。取り込むたびに）

### 順序
```
1. ① SQL: 控えを作る               backend/scripts/sql/2026-10-28_realty_import_1_backup.sql
2. 以前のアプリ: バックアップを保存
3. Dashboard: 取り込む（マスター）
4. ① SQL: 確かめる                 backend/scripts/sql/2026-10-28_realty_import_2_check.sql
（おかしいときだけ）① SQL: 戻す   backend/scripts/sql/2026-10-28_realty_import_3_restore.sql
```

### 1.【① phpMyAdmin】控えを作る
ファイル: `2026-10-28_realty_import_1_backup.sql`
- `brokerage_listings_bk_import` と `app_state_bk_import` を作り直す（前回の控えは消える。本物の表には触らない）
- 最後の表で「本物」と「控え」の件数が同じならよい

### 2.【以前のアプリ（khf-eigyokanri.netlify.app）】バックアップを保存
1. 「⚙ 設定・データ管理」を開く
2. 「🔄 サーバーから再取得」を押す（⚠️ この端末に古い表示が残っていることがあるため。「最新の状態です」か「最新データを取得しました」が出ればよい）
3. 「📥 バックアップを保存（JSON・書類除く）」を押す → `営業管理バックアップ_YYYYMMDD.json` が保存される
   - ⚠️ 「📦 完全バックアップ（書類込み）」でも読めるが、書類の中身で大きくなるので使わない
   - ⚠️ このファイルには顧客の個人情報が入っている。取り込んだら消す。メール・チャットに貼らない

### 3.【Dashboard（マスターでログイン）】取り込む
1. 事業を「不動産企画係」にして、左のメニュー「設定」を開く
2. 一番下の「以前のアプリのデータを取り込む」で、2 のファイルを選ぶ
3. 下見の表を確かめる
   - **新規**: Dashboard に無い行
   - **更新**: 同じ id の行（中身が同じなら、取り込んでも「変わらない」に数える）
   - **そろえる**: Dashboard のポータル取り込みで入った反響と、反響番号が同じ。Dashboard の行の id を以前のアプリの id に付け替えて、以前のアプリの内容にする
   - **重複**: 同じ反響が Dashboard に2行ある。Dashboard 側の行を非表示にする
   - **非表示**: 以前のアプリで消えた行（前に取り込んだが、今のファイルに無い）
   - ⚠️ ファイルの行が300件未満、または非表示が以前のアプリから取り込んだ行の20%を超えるときは、黄色の注意が出て非表示はしない（違うファイル・古いファイルの事故よけ。行の取り込みはする）
4. 「取り込む」→ 確認で OK。1,500件で数秒
5. 結果の行（新規・更新・変わらない・そろえた・重複を非表示・消えた行を非表示）を控えておく
   - 「直して取り込んだ値」: 日付・数値として読めない値（例: 日付の欄の「最終買取へ」）を空にした行。原本（raw_data）には残っている
   - 「取り込めませんでした」が出たら、その id を開発に知らせる（ほかの行は入っている）
   - 途中で止まったら、同じファイルでもう一度取り込む（何度流しても同じ結果になる）

### 4.【① phpMyAdmin】確かめる
ファイル: `2026-10-28_realty_import_2_check.sql`（読むだけ）
- 1つ目の表: 種類ごとの件数（取り込み前 → 後、表示中、非表示の内訳）
- 2つ目: 中身が変わった行の数
- 3つ目: id をそろえた行（前の id → 今の id）
- 4つ目: 設定・週報・コンプライアンスの更新日時
- 5つ目: 最新の受信日・契約日（以前のアプリの最近の入力が入ったか）

### おかしいときだけ【① phpMyAdmin】戻す
ファイル: `2026-10-28_realty_import_3_restore.sql`
- ⚠️ 控えの時点に丸ごと戻る。**控えのあとに Dashboard で入った内容（ポータルの取り込みを含む）も消える**
- ⚠️ 流す前に開発に相談

## 決めごと（2026-10-28）
- 同じポータル反響が両方にあるときは**以前のアプリを正**にする
- 以前のアプリで消えた案件は**非表示**（論理削除。`deleted_by = '以前のアプリで削除'`）。Dashboard で入った行は対象外
- 設定・週次行動計画・コンプライアンスは丸ごと置き換える
- 書類（docs）は目録だけ入る。ファイルの中身（Supabase Storage）は入らない
