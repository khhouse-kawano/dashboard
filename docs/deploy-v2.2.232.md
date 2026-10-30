# デプロイ手順 v2.2.232　アクセス解析の帯グラフ・業者別（PURE GROWTH／Bander）の歩留まり

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | サマリーに `vendors`（業者別の PV・CV）を追加・`request: 'tracking_vendor_funnel'`（新規） | ⚠️ **② VPS（再ビルド）** |
| 2 | `tracking_vendor_funnel` を許可リスト2か所に追加 | ① PHP `core/express_proxy.php` |
| 3 | サマリーの帯グラフ・業者別・歩留まりのモーダル | ① フロント |
| 4 | 更新履歴・業務ガイド「アクセス解析」 | ① DB `backend/scripts/sql/2026-10-30_update_log_2.2.232.sql` |

⚠️ 表の変更は**ありません**。

## 順序
```
0. GitHub で v2.2.232 を main → production へマージ
1. ② 再ビルド                ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① PHP（express_proxy.php） ← ⚠️ 1 より後（先に入れると、② が古いうちは「該当する処理がありません」になる）
3. ① フロント                 ← ⚠️ 1・2 より後（先に上げると、業者別が空・歩留まりが開けない）
4. ① SQL（更新履歴・業務ガイド）
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
確認（トークン無し）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"tracking_vendor_funnel"}'
```
⚠️ `認証が必要です。`（401）ならよい。

### 手順2　【① FTP】PHP 1ファイル
`/dashboard/api/gateway/core/express_proxy.php` を上書き。

確認（トークン無し）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"tracking_vendor_funnel"}'
```
⚠️ `認証が必要です。`（401）ならよい。⚠️ `該当する処理がありません`（404）なら express_proxy.php が古い。

### 手順3　【① フロント】いつもの手順

### 手順4　【① phpMyAdmin】更新履歴・業務ガイド
ファイル: `backend/scripts/sql/2026-10-30_update_log_2.2.232.sql`（末尾に業務ガイド「アクセス解析」の上書きが入っている）

## 終わったら（動作確認）
- 反響管理 → アクセス解析 → 国分ハウジングを開き、表の上に帯グラフが出る。「PV」「CV」で切り替わる
- 「流入元」タブで「業者別」が出て、PURE GROWTH と Bander の2社の帯（PV・CV）が出る
- 社名を押すと「業者別の歩留まり」が開き、1行目が「ブランド総計」
