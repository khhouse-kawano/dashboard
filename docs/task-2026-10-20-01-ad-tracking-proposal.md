# v2.2.199 広告流入トラッキング：§1 の確認結果と実装案（2026-10-20）

指示書: `C:\Users\shinji-kawano\react\ad_tracking_spec.md`
⚠️ この回は**読み取りと提案まで**。コードは version.ts と update_log の SQL 以外まだ変えていない。

## §1 の確認結果

### 1. Express のリポジトリ
- `dashboard/backend-express`（② VPS。`api.khg-marketing.info` は Caddy が**全パス**を `express-api:3001` へ流す → `/t/v1/...`・`/api/track/...` も届く）
- DB: MariaDB（mysql2）。マイグレーションの仕組みは**無い**。`backend/scripts/sql/*.sql` を手で流す運用（① phpMyAdmin・ローカルは docker exec）
- 認証: ダッシュボードは `Token` ヘッダ＋ゲートウェイ（`request`/`roll` を registry に登録）。画面からの通信は ① `express_proxy.php` を経由して ② に届く
- CORS: `app.ts` で全体に `cors({ origin: env.corsOrigins })`（`.env` の `CORS_ORIGINS`）
- レート制限: `express-rate-limit`（`middlewares/publicFormRateLimit.ts` に公開フォーム用の実装あり）

### 2. 反響を保存している既存テーブル
- **`inquiry_customer`**（`features/campaignForm/entry.ts`。`inquiry_id` = `form{日時}_{campaign_id}`）

| フォームが送る値 | 保存先 |
|---|---|
| `landing_params` | ✅ `inquiry_customer.landing_params`（TEXT・2000文字で切る）→ `khg_vid` まで十分入る。**前提は崩れていない** |
| `url_params` | `inquiry_customer.url_params` |
| `source` | ⚠️ `inquiry_customer` には**入らない**。`form_cv.source` だけ（form_cv は inquiry_id を持たず、反響と結びつかない） |
| `campaignName`（utm_campaign） | ⚠️ **どこにも保存されていない**（② は `body.campaign`＝フォームのキャンペーン名を読む。`form_cv.campaignName` にもフォーム名が入る） |
| `url` | `form_cv.url` だけ |

- `inquiry_customer` には `utm_source`〜`utm_content`・`referrer` の列があるが、**常に空文字**で保存されている。
- ⚠️ ① へ退避したとき（`https://khg-marketing.info/api/` の PHP）：本体の index.php はリポジトリに無い。v2.2.189 で `landing_params` に対応したのは ② だけなので、**① 経由の反響には landing_params が入っていない可能性が高い**（要確認）。

### 3. `landing_params` / `source` / `campaign` を使っている既存の処理
- `landing_params`: 反響一覧（注文）の SELECT（② `list/queries.ts`・① `list_order.php`）、Nexus への同期で `master_data` へ写す（`ListOrder.tsx` handleSync・`masterDataColumns.ts`・`allowed_columns.php`）、見学クラウドの予約（`kengakuCloud/entry.ts` が url_params と同じ値を入れる）
- 「`landing_params` が空でなければ広告経由」のような**判定・集計・CSV は無い**
- `source` / `campaignName`: `form_cv`・`form_show` へ書くだけ。ダッシュボードで読む処理は無い
- → §9 の「値の意味が変わる」影響は、**Nexus へ写る値が『サイト内で最後の広告パラメータ』に変わる**ことだけ

### 4. Dashboard
- このリポジトリ（`dashboard/frontend`）。管理画面はヘッダーのメニュー（Header.tsx の menuMapping）か左メニュー。権限は `authority`（Master / BrandAdmin）

### 5. 設置対象（`form_get/src/api/gateway.ts` の FALLBACK_URL）
- kh-house.jp（`/form/` と `/khg/form/`）・day-just-house.com・www.nagomi-koumuten.jp・furukomi-home.com・2lhome.net・miyazaki.pg-house.jp・jusfy-home.com（**オリジンは7つ**）
- `neo-dhome.com` は form_get・② のどこにも出てこない → 対象にするか要確認

### 6. 作法
- ② は features/<機能>/ に処理、gateway/registry.ts に登録。⚠️ 付きで経緯を残すコメント。① 経由の新しい request は express_proxy.php の2つの一覧に入れる

## 実装案

### 指示書と変えたい点
1. **ダッシュボード用 API は REST（`/api/track/sites`）ではなくゲートウェイの request にする**（`tracking:site_list` / `site_save` / `touches`）。認証・① 経由の経路・権限の判定を既存とそろえるため。公開の2つ（tracker.js・touch）は指示書どおりのパス。
2. **`/api/track/touch` は全体の CORS より前に置く**（許可オリジンを DB の `tracking_sites` から引くため。`express.text()` もこのルートだけ）。

### Part B（②・DB）
- `backend/scripts/sql/2026-10-20_tracking_tables.sql`：`tracking_sites`・`tracking_touches`（`CREATE TABLE IF NOT EXISTS`）＋ ロールバック用 `..._rollback.sql`
- `features/tracking/`
  - `params.ts`：対象キー・500文字切り詰め・source の決め方（tracker.js と同じ表）
  - `touch.ts`：検証（site_key・is_active・Origin・UUID・キー）→ INSERT。応答は常に 204、理由はログだけ。IP は SHA-256＋ソルト（⚠️ ソルトは `.env` の `TRACKING_IP_SALT`。**.env はこちらで触らないので設定をお願いする**）
  - `sites.ts`：一覧・登録（`s_`＋16文字）・更新・無効化
  - `touches.ts`：反響の landing_params を解析 → `khg_vid` → 無ければクリックIDで探す
  - `trackerRoute.ts`：`GET /t/v1/tracker.js`（Cache-Control 1時間）・`POST /api/track/touch`（同じIPから1分30件）
- `public/tracker.js`：素の JS（ES2017・依存なし・5KB 以内）。指示書 §5-1 の 1〜10 のとおり

### Part A（ダッシュボード）
- ヘッダーのメニューに「トラッキング設定」（Master / BrandAdmin）：サイトの一覧・登録・編集・無効化、タグの表示とコピー、WordPress の貼り方の注意書き。GoogleReview.tsx の作法
- 反響一覧（注文）の行から「流入履歴」を開く（`khg_vid` で結びついたか・gclid で結びついたかを表示）
- GUIDE_SCREENS に登録し、業務ガイドの記事を足す

### Part C（form_get）
- 変更しない。Playwright でローカルの模擬サイト（LP → フォームのページ）を作り、送信データに `khg_vid` 付きの landing_params・source・campaign が入ることを確かめる

## 確認したいこと
1. ダッシュボード用 API をゲートウェイの request にしてよいか（上の 1）
2. `neo-dhome.com` を対象にするか
3. `source` と utm_campaign が反響に保存されていない件：今回は**表示のときに landing_params から読み取る**（保存処理は変えない）でよいか
4. ① 退避時に landing_params が保存されているか（① の index.php の確認）
5. 流入履歴を出す場所：反響一覧（注文）だけでよいか（建売・顧客情報にも要るか）
6. フォームのページ自体の URL に広告以外の `?` が付くサイトがあると、フォームが landing_params をそれで上書きし、広告の情報が消える（tracker.js の補修で戻るのは khg_vid だけ）。そういうページがあるか
