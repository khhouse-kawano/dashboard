# デプロイ手順 v2.2.238　アクセス解析の「業者別」を Google リスティング広告だけに

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 業者別の判定（vendors.ts）・サマリー（summary.ts）・歩留まり（vendorFunnel.ts）・CV の帰属（conversions.ts） | ⚠️ **② VPS（再ビルド）** |
| 2 | 業者別の説明文・版の番号 | ① フロント |
| 3 | 更新履歴・業務ガイド「アクセス解析」 | ① DB `backend/scripts/sql/2026-11-02_update_log_2.2.238.sql` |

⚠️ 表の変更は**ありません**。⚠️ 新しい request も**ありません**（express_proxy.php は触っていない）。

## 順序
```
0. GitHub で v2.2.238 を main → production へマージ
1. ② 再ビルド                ← ⚠️ 実行中の Claudeによる分析が無いときに
2. ① フロント
3. ① SQL（更新履歴・業務ガイド）  ← ⚠️ 1回だけ
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
確認（トークンなし）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"tracking_vendor_funnel"}'
```
⚠️ `認証が必要です。`（401）ならよい。

### 手順2　【① フロント】いつもの手順

### 手順3　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-02_update_log_2.2.238.sql` を1回流す。

## 終わったら（動作確認）
アクセス解析 → 国分ハウジング（または DAY JUST HOUSE・かえるホーム）→ 流入元 → 業者別:
- 説明に「2026-10-22 以降の Google リスティング広告の訪問だけ」と出る
- PURE GROWTH と Bander の帯が出る（ローカルでは国分ハウジングで PURE GROWTH 59.1%・Bander 40.9%）
- 社名を押すと店舗別の歩留まりが開く

## 注意
- ⚠️ Google ディスプレイ・Yahoo の広告に付いた _pt2 は、Bander に数えない（ローカルで1,125件が外れた）
- ⚠️ 2026-10-22 より前の訪問は、業者別に入らない

## ついでに（v2.2.238 とは別）
- `backend/scripts/sql/2026-11-02_building_202609.sql`（建築着工 2026/09 分）を ① の phpMyAdmin で流す。何度流しても二重には入らない
