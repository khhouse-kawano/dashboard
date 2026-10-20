# デプロイ手順 v2.2.199（広告流入トラッキング・顧客ID ／ アンバサダー台帳の歩留まりモーダルの影）

⚠️ v2.2.198 は main にマージ済み。このブランチは main（v2.2.198 を含む）から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `tracking_sites`・`tracking_touches`（新規） | ① DB |
| 2 | 着地の受け口・tracker.js の配信・サイト登録/流入履歴の request | ⚠️ **② VPS（再ビルド要）** |
| 3 | `.env` に `TRACKING_IP_SALT`（IP をハッシュにするソルト） | ⚠️ **② VPS の .env（手作業）** |
| 4 | ① の転送リストに3つの request | ① PHP（`backend/src/core/express_proxy.php`） |
| 5 | トラッキング設定・反響一覧の「流入」・歩留まりモーダルの影・画面の版 | ① フロント（dashboard） |
| 6 | 更新履歴 ＋ 記事2本（トラッキング設定・反響一覧） | ① DB |
| 7 | 各ブランドサイトにタグを貼る（7ドメイン） | 各サイト（WordPress など） |

- ⚠️ フォーム（form_get）・各サイトの `form/api/index.php` は**変えない**。
- ⚠️ `inquiry_customer` の構造は変えない（`landing_params` に顧客ID＝`khg_vid` が入るようになるだけ）。

## 順序
```
0. GitHub で v2.2.199 を main → production へマージ
1. ① DB：表を作る（2026-10-20_tracking_tables.sql）
2. ② .env に TRACKING_IP_SALT を足す
3. ② 再ビルド（Dockerfile と新しいファイルがあるため）
4. ① PHP（express_proxy.php）
5. ① フロント（build）
6. ① SQL（update_log ＋ 記事）
7. ダッシュボードで7サイトを登録 → 各サイトにタグを貼る
```
⚠️ 1 → 3 の順を守る（② が先に動いても表が無いだけで、サイトの表示には影響しない。ただしログに失敗が出る）。

## 手順1　【① phpMyAdmin】表を作る
ファイル: `backend/scripts/sql/2026-10-20_tracking_tables.sql`（何度流しても安全）
- 最後に `SHOW TABLES LIKE 'tracking_%'` が `tracking_sites`・`tracking_touches` を返せば成功。
- 戻すとき: `2026-10-20_tracking_tables_rollback.sql`（⚠️ 記録が消える。先に各サイトのタグを外す）

## 手順2　【② SSH】.env に1行足す
```
TRACKING_IP_SALT=<推測されにくい長めのランダムな文字列>
```
- ⚠️ 値は画面・チャットに出さないこと。一度決めたら変えない（変えると同じ IP でも別のハッシュになる）。
- ⚠️ 入れなくても動く（ip_hash が NULL になるだけ）。

## 手順3　【② SSH】再ビルド
```
dcp up -d --build express-api
dcp logs express-api   # ⚠️ --tail と grep を併記しない（登録一覧は約190行・五十音順）
```
- 起動ログのルート一覧に `tracking_site_list` / `tracking_site_save` / `tracking_touches` があること。
- 確認:
```
curl -sI https://api.khg-marketing.info/t/v1/tracker.js     # 200・Cache-Control: public, max-age=3600
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.khg-marketing.info/api/track/touch -d '{}'   # 204
```

## 手順4　【① FTP】PHP
`backend/src/core/express_proxy.php`（`expressProxyRequests()` と `expressProxyExclusive()` に3つ）
- 確認: トークン無しで ① に `{"request":"tracking_site_list"}` → **401**（② まで届いている）。404 なら手順4の漏れ。

## 手順5　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.9bed65f3.js` / `main.b8a7c60b.css`
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順6　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-20_update_log_2.2.199.sql`（前半が update_log、後半が記事2本）
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title IN ('トラッキング設定', '反響一覧');
```

## 手順7　サイトを登録してタグを貼る（Master / BrandAdmin）
1. ヘッダー「反響管理 → トラッキング設定」→「サイトを登録」
2. 7ドメインを登録（許可するオリジンは `https://ドメイン`。www の有り無しが両方あれば2行）
   - https://kh-house.jp（/form/ と /khg/form/ は同じドメインなので1つ）
   - https://day-just-house.com
   - https://www.nagomi-koumuten.jp
   - https://furukomi-home.com
   - https://2lhome.net
   - https://miyazaki.pg-house.jp
   - https://jusfy-home.com
3. 「タグ」→「コピー」→ 各サイトの**全ページのフッター**に1回だけ貼る（WordPress は WPCode の Footer 欄）
4. 確認: サイトを `?utm_source=test&utm_campaign=deploycheck` 付きで開く → トラッキング設定の「直近30日の着地」が増える
5. 確認: そのブラウザでテスト用フォームから送信 → 反響一覧（注文）に「流入：test」の札 → 押すと顧客ID・着地が出る

⚠️ 要確認（リリース前）：顧客ID をブラウザ（localStorage）に保存するため、プライバシーポリシーへ利用目的の記載が必要。担当者に伝えること。

## 確認（ログインした状態で）
1. 「反響管理」に「トラッキング設定」が出る（Master / BrandAdmin だけ）。
2. 「公式アンバサダー → アンバサダー管理」で歩留まり（総反響・初回面談など）の数字を押す → 後ろが暗くなり、モーダルに影が付く。顧客名を押すと顧客情報がその上に開く。
