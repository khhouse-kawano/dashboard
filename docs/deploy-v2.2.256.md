# デプロイ手順 v2.2.256　不動産企画係：買い反響の問合せ物件を媒介獲得台帳に紐づける

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 買い反響の保存で、媒介物件（propertyId）も書けるようにする | ② VPS（backend-express） |
| 2 | 買い反響の編集画面に「問合せ物件（媒介獲得台帳）」の検索・「問合せ物件名」、一覧に台帳 No. の札 | ① フロント |
| 3 | 更新履歴・業務ガイドの記事「反響から商談案件へのつながり（不動産企画係）」 | ① DB `backend/scripts/sql/2026-11-06_update_log_2.2.256.sql` |

- ⚠️ **DB の表は変わりません**（使う列はすでにあります）。① の PHP、`projects/sync`、GAS も変わりません。
- ② の新しい request はありません（`express_proxy.php` の変更なし）。

## 順序
```
0. GitHub で v2.2.256 を production へマージ（PR）
1. ② VPS（backend-express）を更新して再起動   ← ⚠️ フロントより先に
2. ① フロント（v2.2.256 のブランチでビルドしたもの）
3. ① SQL：2026-11-06_update_log_2.2.256.sql   ← ⚠️ 1回だけ
```
⚠️ ② を先にします。フロントを先に上げると、紐づけた台帳は保存されますが、媒介物件（propertyId）だけが保存されません。

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
確認（トークンなし。② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"broker","roll":"update"}'
```
- `認証が必要です。`（401）ならよいです。

### 手順2　【① フロント】いつもの手順
⚠️ v2.2.256 のブランチで `npm run build` をし直してから上げてください。

### 手順3　【① SQL】
phpMyAdmin で `2026-11-06_update_log_2.2.256.sql` を **1回だけ**流します（更新履歴と業務ガイドの記事）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.256 で、1行だけならよいです。

## 終わったら（動作確認）
1. 不動産企画係の「買い反響（ポータル）」で、顧客名を押して編集画面を開く
2. 「次回アクション(メモ)」の下に「問合せ物件（媒介獲得台帳）」「問合せ物件名」がある
3. 「問合せ物件（媒介獲得台帳）」に、媒介獲得台帳にある所在地の一部か台帳 No. を入れると、候補が出る
4. 候補を押すと「📝 No.〇／売主…」の札が出る。「保存する」を押す
5. 一覧の「問合せ物件」に「📝No.〇」が出る
6. 試した反響を元に戻すときは、編集画面で「解除」→「保存する」
7. 版の表示が ver2.2.256

確認用（任意。phpMyAdmin）：
```sql
SELECT id, name, ledgerNo, propertyId, targetProperty FROM brokerage_listings
WHERE kind = 'buyLeads' AND ledgerNo IS NOT NULL ORDER BY updated_at DESC LIMIT 5;
```
試した反響の propertyId が入っていれば、② の更新も効いています。

## 切り戻し
- フロントを v2.2.255 に戻すと、検索欄と札が消えます。紐づけた値（台帳 No. など）は残りますが、害はありません
- ② を v2.2.255 に戻すと、propertyId が書けなくなるだけです
