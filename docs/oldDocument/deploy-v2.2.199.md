# デプロイ手順 v2.2.199（広告流入トラッキング・顧客ID ／ アンバサダー台帳の歩留まりモーダルの影）

⚠️ v2.2.198 は main にマージ済み。このブランチは main（v2.2.198 を含む）から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `tracking_sites`・`tracking_touches`（新規） | ① DB |
| 2 | `.env.prod` に `TRACKING_IP_SALT` を1行足す | ⚠️ **② VPS（手作業）** |
| 3 | 着地の受け口・tracker.js の配信・3つの request・`docker-compose.prod.yml` | ⚠️ **② VPS（再ビルド）** |
| 4 | ① の転送リストに3つの request | ① PHP（`backend/src/core/express_proxy.php`） |
| 5 | トラッキング設定・反響一覧の「流入」・歩留まりモーダルの影・画面の版 | ① フロント（dashboard） |
| 6 | 更新履歴 ＋ 記事2本（トラッキング設定・反響一覧） | ① DB |
| 7 | 7サイトを登録して、各サイトにタグを貼る | ダッシュボード ＋ 各サイト |

- ⚠️ フォーム（form_get）・各サイトの `form/api/index.php` は**変えない**。
- ⚠️ `inquiry_customer` の構造は変えない（`landing_params` に顧客ID＝`khg_vid` が入るようになるだけ）。

## 順序
```
0. GitHub で v2.2.199 を main → production へマージ
1. ① DB：表を作る
2. ② .env.prod に1行足す
3. ② 再ビルド          ← ⚠️ 1・2 の後
4. ① PHP
5. ① フロント          ← ⚠️ 3・4 の後
6. ① SQL（更新履歴 ＋ 記事）
7. サイト登録 → タグを貼る   ← ⚠️ 最後
```
- ⚠️ 3 を 1 より先にすると、表が無いので ② のログに失敗が出る（サイトの表示には影響しない）。
- ⚠️ 5 を 4 より先にすると、トラッキング設定を開いたとき「該当する処理がありません」になる。

## 手順1　【① phpMyAdmin】表を作る
ファイル: `backend/scripts/sql/2026-10-20_tracking_tables.sql`（何度流しても安全）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。
- 最後に `SHOW TABLES LIKE 'tracking_%'` が `tracking_sites`・`tracking_touches` の2行を返せば成功。
- 戻すとき: `2026-10-20_tracking_tables_rollback.sql`（⚠️ 記録が消える。先に各サイトのタグを外す）

## 手順2　【② VPS で実行】.env.prod に1行足す
⚠️ **作り直さない。** 今ある `~/dashboard/.env.prod` の末尾に1行足すだけ。今ある行には触れない。
```bash
cd ~/dashboard
nano .env.prod
```
末尾に足す:
```
TRACKING_IP_SALT=<推測されにくい長めのランダムな文字列>
```
- ランダムな文字列は `openssl rand -hex 32` で作れる（出た値をそのまま貼る）。
- ⚠️ 値は画面・チャットに出さないこと。一度決めたら変えない（変えると同じ IP でも別のハッシュになる）。
- ⚠️ 入れなくても動く（IP のハッシュが空になるだけ）。

確認（値は出さず、行があるかだけ見る）:
```bash
grep -c '^TRACKING_IP_SALT=' .env.prod
```
⚠️ `1` が出ればよい。

## 手順3　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "TRACKING_IP_SALT" docker-compose.prod.yml
ls backend-express/public/tracker.js
```
⚠️ 1行目は1行出る、2行目はファイル名が出れば v2.2.199 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
- `dcp` は `docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod` の別名（これまでと同じ）。

確認:
```bash
dcp exec express-api sh -c 'test -n "$TRACKING_IP_SALT" && echo SET || echo EMPTY'
```
⚠️ `SET` が出ればソルトが届いている（値は出ない）。`EMPTY` なら手順2の漏れ。
```bash
curl -sI https://api.khg-marketing.info/t/v1/tracker.js
```
⚠️ `200` と `Cache-Control: public, max-age=3600` が出ればよい。
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.khg-marketing.info/api/track/touch -d '{}'
```
⚠️ `204` が出ればよい（中身がでたらめなので保存はされない）。
```bash
dcp logs express-api | grep -E "tracking_(site_list|site_save|touches)" | tail -3
```
⚠️ 3行（`tracking_site_list` / `tracking_site_save` / `tracking_touches`）出ればよい。
- ⚠️ `dcp logs --tail 80 express-api | grep …` のように `--tail` で先に切らない。起動時の一覧は約190行・五十音順なので、`--tail` の範囲から外れて「無い」ように見える。

## 手順4　【① FTP】PHP
`backend/src/core/express_proxy.php` を上書き（`expressProxyRequests()` と `expressProxyExclusive()` に3つ足してある）
- 確認: トークン無しで ① に `{"request":"tracking_site_list"}` → **401** なら ② まで届いている。404 なら手順4の漏れ。

## 手順5　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.9bed65f3.js` / `main.b8a7c60b.css`
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順6　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-20_update_log_2.2.199.sql`（前半が update_log の1行、後半が記事2本）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。

確認:
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title IN ('トラッキング設定', '反響一覧');
```

## 手順7　【ダッシュボード ＋ 各サイト】サイトを登録してタグを貼る（Master / BrandAdmin）
1. ヘッダー「反響管理 → トラッキング設定」→「サイトを登録」
2. 7ドメインを登録（許可するオリジンは `https://ドメイン`。www の有り無しが両方あれば2行）
   - https://kh-house.jp（/form/ と /khg/form/ は同じドメインなので1つ）
   - https://day-just-house.com
   - https://www.nagomi-koumuten.jp
   - https://furukomi-home.com
   - https://2lhome.net
   - https://miyazaki.pg-house.jp
   - https://jusfy-home.com
3. 表の「タグ」→「コピー」→ そのサイトの**共通フッターに1回だけ**貼る（`</body>` の直前。WordPress は WPCode の Footer 欄）
   - ⚠️ タグはサイトごとに違う。必ずそのサイトの行からコピーする。
   - ⚠️ 共通フッターの外にある LP（単体の HTML など）には、その LP にも貼る。共通フッターに入っている LP に重ねて貼らない（着地が2回記録される）。
   - ⚠️ フォームのあるページにも入っていること（フォームはそのページの情報を読んで送る）。
   - ⚠️ 7ドメイン以外に LP がある場合は、そのドメインも登録する。LP とフォームのドメインが違うと、顧客ID・広告の情報はフォームまで届かない。
4. 確認: サイトを `?utm_source=test&utm_campaign=deploycheck` 付きで開く → トラッキング設定の「直近30日の着地」が増える
5. 確認: そのブラウザでテスト用フォームから送信 → 反響一覧（注文）に「流入：test」の札 → 押すと顧客ID・着地が出る

⚠️ 要確認（リリース前）：顧客ID をブラウザ（localStorage）に保存するため、プライバシーポリシーへ利用目的の記載が必要。担当者に伝えること。

## 確認（ログインした状態で）
1. 「反響管理」に「トラッキング設定」が出る（Master / BrandAdmin だけ）。
2. 「公式アンバサダー → アンバサダー管理」で歩留まり（総反響・初回面談など）の数字を押す → 後ろが暗くなり、モーダルに影が付く。顧客名を押すと顧客情報がその上に開く。
