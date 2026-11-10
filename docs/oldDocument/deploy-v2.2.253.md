# デプロイ手順 v2.2.253　アクセス解析：CV を「一度でも来た着地ページ・流入元・広告すべて」に付ける

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | CV の数え方（着地ページ別・流入元別・詳細の内訳と広告別）。合計と業者別は今までどおり | ② VPS（backend-express） |
| 2 | アクセス解析の注記・版の番号 | ① フロント |
| 3 | 更新履歴・業務ガイドの記事「アクセス解析」 | ① DB `backend/scripts/sql/2026-11-06_update_log_2.2.253.sql` |

- ⚠️ **DB の表は変わりません。** ① の PHP、各サイトのタグ（tracker.js）、`projects/sync`、GAS も変わりません。
- ② の新しい request はありません（`express_proxy.php` の変更なし）。

## 順序
```
0. GitHub で v2.2.253 を production へマージ（PR）
1. ② VPS（backend-express）を更新して再起動
2. ① フロント（v2.2.253 のブランチでビルドしたもの）
3. ① SQL：2026-11-06_update_log_2.2.253.sql   ← ⚠️ 1回だけ
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
確認（トークンなし。② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"tracking_site_summary","site_id":1}'
```
- `認証が必要です。`（401）ならよいです。

### 手順2　【① フロント】いつもの手順
⚠️ v2.2.253 のブランチで `npm run build` をし直してから上げてください。

### 手順3　【① SQL】
phpMyAdmin で `2026-11-06_update_log_2.2.253.sql` を **1回だけ**流します（更新履歴と業務ガイドの記事）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.253 で、1行だけならよいです。

## 終わったら（動作確認）
1. ヘッダーの「反響管理 → アクセス解析」で、サイト名を押してサマリーを開く
2. 「着地ページ」の表の上に「CV は、問い合わせの日までに一度でも来た着地ページすべてに1件ずつ付けます」と出る
3. 表の CV を足すと、上の「CV」より多くなっている（離脱して戻ってきた人がいれば）
4. 国分ハウジングなどの「流入元」のタブで「業者別は最後の訪問で数えます」と出る
5. 着地ページを押して詳細を開くと、注記が「このページ（流入元）に一度でも来た反響です」になっている
6. 版の表示が ver2.2.253

## 注意
- 過去30日の分も、新しい数え方ですぐに出直します（数字が増えるのは正常です）。
- 一覧の「直近30日のCV」と、サマリーの上の「CV」は、今までどおり反響の数です（変わりません）。
- 業者別の帯グラフの CV は、今までどおり最後の訪問で数えます（業者ごとの割合の合計を100%にそろえるため）。

## 切り戻し
- ② と フロントを v2.2.252 に戻すと、最後の訪問だけで数える形に戻ります（データは変わらないので、戻すだけで済みます）
