# デプロイ手順 v2.2.223　不動産企画係アプリの移植（第3段：週次行動計画・コンプライアンス・設定）＋ 再読み込みで真っ白になる不具合

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 設定・週次行動計画・コンプライアンスの読み書き（`planner:state` / `settings` / `weekly` / `compliance`）を新しく作った | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | 上の4つを ① から ② へ転送する（① に PHP の処理は無い） | ① PHP 1ファイル `core/express_proxy.php` |
| 3 | 3画面の追加。⚠️ **不動産企画係の画面の URL を1段（/summary など）に戻した**（`/realty/summary` で再読み込みすると真っ白になっていた）。キャンペーン登録のあとの移動先の `/campaign/?…` も同じ理由で直した | ① フロント（いつもの手順） |
| 4 | 更新履歴・業務ガイドの記事5本（新規3本・修正2本） | ① DB `backend/scripts/sql/2026-10-28_update_log_2.2.223.sql` |

⚠️ DB の表の変更は**ありません**（保存先は今ある `app_state` の3行）。

## 順序
```
0. GitHub で v2.2.223 を main → production へマージ
1. ② 再ビルド                  ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① PHP（express_proxy.php）  ← ⚠️ 1 より後（先に上げると、② に無い処理へ転送して 404 になる）
3. ① フロント                  ← ⚠️ 不具合（真っ白）の直しもここ。早めに
4. ① SQL（更新履歴・ガイド）
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
確認（トークン無し。保存も変更もされない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"planner","roll":"state"}'
```
⚠️ `認証が必要です。`（401）ならよい。

## 手順2　【① FTP】PHP
アップロード（`/dashboard/api/gateway/` の下）:
- `core/express_proxy.php`（`planner:state` / `planner:settings` / `planner:weekly` / `planner:compliance` を ② へ転送。⚠️ 4つとも ② だけ）

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"weekly"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。

## 手順3　【① フロント】いつもの手順

## 手順4　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-28_update_log_2.2.223.sql`

## 終わったら（動作確認）
1. 不動産企画係でチームサマリーを開き、**ブラウザの再読み込み（F5）をしても真っ白にならない**（アドレスが `/dashboard/summary`）
2. 左のメニューに「週次行動計画」「コンプライアンス」「設定」が増えている
3. 設定：以前のアプリと同じ担当者・予算・反響元・単価・テンプレート・宅建業者情報が出る（⚠️ **値は直さない**。下の注意）
4. 週次行動計画：今月の表が出て、架電実績（灰色のマス）に数字が入っている
5. コンプライアンス：15項目が出る

⚠️ 切り替え（以前のアプリから全データを取り込む日）までは、**設定・週次・コンプライアンスを Dashboard で直しても、取り込みで以前のアプリの値に上書きされます。** 試しに直した場合も同じです。

⚠️ v2.2.221〜222 のあいだに `/realty/summary` のような形でブックマークした人は、そのブックマークでは真っ白になります。左のメニューから開き直して付け直してもらってください（業務ガイド「不動産企画係の画面（入口と権限）」にも書いた）。
