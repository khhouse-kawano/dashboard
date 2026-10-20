# デプロイ手順 v2.2.202（トラッキング設定：サイトごとのサマリー・直近30日のCV・再読み込み）

⚠️ v2.2.201 は main にマージ済み。このブランチは main から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | サマリーの request（tracking_site_summary）・一覧に直近30日のCV | ⚠️ **② VPS（再ビルド）** |
| 2 | ① の転送リストに tracking_site_summary | ① PHP（`backend/src/core/express_proxy.php`） |
| 3 | トラッキング設定の画面（サマリー・CV の列・再読み込み）・画面の版 | ① フロント（dashboard） |
| 4 | 更新履歴 ＋ 記事1本（トラッキング設定） | ① DB |

- ⚠️ DB の構造・tracker.js・GTM は変更なし。

## 順序
```
0. GitHub で v2.2.202 を main → production へマージ
1. ② 再ビルド
2. ① PHP
3. ① フロント   ← ⚠️ 1・2 の後
4. ① SQL（更新履歴 ＋ 記事）
```
- ⚠️ 3 を先に出すと、サイト名を押したとき「サマリーを読み込めませんでした」になり、CV の列が空になる。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/tracking/summary.ts backend-express/src/features/tracking/conversions.ts
```
⚠️ 2つともファイル名が出れば v2.2.202 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
```bash
dcp logs express-api | grep -E "tracking_(site_list|site_save|site_summary|touches)" | tail -4
```
⚠️ 4行出ればよい（`--tail` で先に切らない。一覧は約190行・五十音順）。

## 手順2　【① FTP】PHP
`backend/src/core/express_proxy.php` を上書き（2つのリストに `tracking_site_summary`）
- 確認: トークン無しで ① に `{"request":"tracking_site_summary","site_id":1}` → **401**。404 なら手順2の漏れ。

## 手順3　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.d67b3612.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順4　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-20_update_log_2.2.202.sql`（前半が update_log の1行、後半が記事1本）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title = 'トラッキング設定';
```

## 確認（ログインした状態で）
1. 「反響管理 → トラッキング設定」→ 上に「再読み込み」、KPI と一覧に「直近30日のCV」が出る。
2. サイト名を押す → その行の下にサマリー（PV・うち広告・CV・CV率、着地ページ／流入元のタブ、表）。もう一度押すと閉じる。着地ページのアドレスを押すと、そのページが別のタブで開く。
3. 2つのサイトを開いても、それぞれ別に開け閉め・タブの切り替えができる。
4. 「再読み込み」→ 開いているサマリーも最新になる。
