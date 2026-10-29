# デプロイ手順 v2.2.226　不動産企画係: 今日の架電キュー・架電ナビ（一括査定）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 通話記録・練習記録の表（`realty_call_logs`・`realty_practice_logs`）を作る | ⚠️ **① DB** `backend/scripts/sql/2026-10-28_realty_call_logs.sql` |
| 2 | `planner:call_mark`・`call_undo`・`navi_save`・`call_logs`・`call_logs_import`・`practice_logs_import`（新規）、設定に架電キューの項目 | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 3 | 上の6つを ① から ② へ転送 | ① PHP `core/express_proxy.php` |
| 4 | メニューの「今日の架電キュー」「架電ナビ（一括査定）」、売り反響の🧭、週次行動計画の「接触の質」、設定の「架電キュー」と通話記録の取り込み | ① フロント（いつもの手順） |
| 5 | 更新履歴・業務ガイドの記事5本（新規2本・修正3本） | ① DB `backend/scripts/sql/2026-10-28_update_log_2.2.226.sql` |
| 6 | 以前のアプリの通話記録・練習記録の取り込み | Dashboard（マスター）。CSV が届いてから |

⚠️ 既存の表の変更は**ありません**（表を2つ足すだけ）。

## 順序
```
0. GitHub で v2.2.226 を main → production へマージ
1. ① SQL（表を作る）               ← ⚠️ 2 より前（② が新しい表を使う）
2. ② 再ビルド                      ← ⚠️ 実行中の Claudeによる分析が無いときに
3. ① PHP（express_proxy.php）       ← ⚠️ 2 より後
4. ① フロント
5. ① SQL（更新履歴・ガイド）
6. 以前の通話記録・練習記録の取り込み（下の B。CSV が届いたら）
```

### 手順1　【① phpMyAdmin】表を作る
ファイル: `backend/scripts/sql/2026-10-28_realty_call_logs.sql`
- 最後の確認で `realty_call_logs`・`realty_practice_logs` の2行が出ればよい（件数は 0）
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
- `core/express_proxy.php`（新しい6つを ② へ転送。② だけ）

確認（トークン無し。① を通して ② まで届くか）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"call_logs"}'
```
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"call_mark"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。⚠️ 502 で「ループ検知」なら ② が古い（手順2）。

### 手順4　【① フロント】いつもの手順

### 手順5　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-28_update_log_2.2.226.sql`

## B. 以前の通話記録・練習記録を取り込む（CSV が届いたら。急ぎではない）
1. Supabase の画面で `call_logs` と `practice_logs` を CSV で書き出す（列名はそのまま。⚠️ 文字起こし・顧客名が入っているので、ファイルの扱いに注意）
2. Dashboard（マスター）: 不動産企画係の「設定・データ管理」の一番下「以前のアプリの通話記録・練習記録を取り込む（CSV）」
   - 「通話記録（call_logs）」を選んでファイルを選ぶ → 件数を確かめて「取り込む」
   - 「練習記録（practice_logs）」も同じ
3. 確認（① phpMyAdmin）:
```sql
SELECT '通話記録' AS 表, COUNT(*) AS 件数, MIN(created_at) AS 最初, MAX(created_at) AS 最後 FROM realty_call_logs WHERE src_id IS NOT NULL
UNION ALL
SELECT '練習記録', COUNT(*), MIN(created_at), MAX(created_at) FROM realty_practice_logs;
```
- 同じファイルを何度流しても増えない（Supabase の id で飛ばす）。途中で止まったら同じファイルをもう一度
- 日時は日本時間に直して入る

## 終わったら（動作確認）
- 不動産企画係の左のメニュー「日々の行動」の2つに「移行中」が付いていない
- 今日の架電キュー: 自分の担当の反響が並ぶ。1件で「📵 不在」→「↩ 直前の記録を取消」で元に戻る
- 架電ナビ: 一覧の「🧭 ナビで架電」で全画面のナビが開く。「✕ 閉じる」で閉じる
- 週次行動計画の表の上に「📞 接触の質」が出る
- 設定・データ管理に「📞 架電キュー（抽出ルールと一言目）」が出る（値は以前のアプリと同じ: 件数15など）

## 注意
- ⚠️ 架電ナビの「不在・不通」で、リード受信・架電中の反響のフェーズが「通電済」になるのは**以前のアプリと同じ動き**（以前のアプリの不具合。直すかは判断待ち）
- ⚠️ 自動聞き取りはブラウザの音声認識（声は Google / Microsoft に送られる）。パソコンの Chrome か Edge で使う
- ⚠️ ロープレ練習・練習の成績は移行中（ボタンは押せない）。以前のアプリを使う
