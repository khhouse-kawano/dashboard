# デプロイ手順 v2.2.261　セキュリティログの要注意 IP の開閉・集客サマリーの総予算

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 総予算の明細の口（`event_summary:budget`） | ② VPS（backend-express） |
| 2 | セキュリティログの札の開閉・集客サマリーの「総予算」の列と明細のモーダル | ① フロント（Dashboard） |
| 3 | 更新履歴・業務ガイドの記事2本（「集客サマリー」新規・「セキュリティログ」） | ① DB `backend/scripts/sql/2026-11-10_update_log_2.2.261.sql` |

- ⚠️ **DB の表は変わりません。**
- ⚠️ **① の `express_proxy.php` は変わりません**（`event_summary` は request の単位で ② へ転送しているので、新しい roll も届きます）。
- `projects/sync`・GAS は変わりません。

## 順序
```
0. GitHub で v2.2.261 を production へマージ（PR）
1. ② VPS（backend-express）を更新して再起動     ← ⚠️ フロントより先（総予算のモーダルが ② の新しい口を呼ぶ）
2. ① Dashboard のフロント
3. ① SQL：2026-11-10_update_log_2.2.261.sql    ← ⚠️ 1回だけ
```

### 手順1　【② VPS】backend-express を更新
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
確認（① 経由。トークン無し）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"event_summary","roll":"budget","title":"x"}'
```
- `認証が必要です。`（401）ならよいです。

### 手順2　【① Dashboard のフロント】いつもの手順
v2.2.261 のブランチで `npm run build` をし直してから上げてください。

### 手順3　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-10_update_log_2.2.261.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.261 で、1行だけならよいです。

## 終わったら（動作確認）
1. Master で「システム管理 → セキュリティログ」を開く
   - 要注意の IP の札が10個まで出て、「残り N件を表示 ▼」がある
   - 押すと全部、もう一度押すと10個に戻る
2. 「集客イベント → 集客サマリー」を開く
   - 「反響数」の右に「総予算」がある
   - 金額を押すと明細が開き、合計が押した金額と同じ
3. Dashboard の版の表示が ver2.2.261

## 切り戻し
- フロントを前の版に戻すと、札の開閉と総予算の列が消えます。② の新しい口は残っていても害はありません。
