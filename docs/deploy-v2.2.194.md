# デプロイ手順 v2.2.194（業務ガイド）

⚠️ v2.2.193 は main にマージ済み。このブランチは main（v2.2.193 を含む）から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい窓口 `guide_list`・`guide_article`・`guide_save`（業務ガイドの記事の読み書き） | ⚠️ **② VPS**（features/guide.ts・gateway/registry.ts） |
| 2 | ① から ② へ上の3つを転送する（⚠️ 入れないと ① が404を返す） | ⚠️ **① PHP**（core/express_proxy.php） |
| 3 | 業務ガイドの画面（別ウインドウの `/guide`）・入口ボタン3か所・画面の版 | ① フロント（dashboard） |
| 4 | 新しい表 `guide_article`・`guide_history` | ① DB |
| 5 | 更新履歴 ＋ 記事58本 | ① DB |

## 順序
```
0. GitHub で v2.2.194 を main → production へマージ
1. ② Express（build）
2. ① PHP（express_proxy.php）   ← ⚠️ 1 の後
3. ① SQL（表の作成）            ← ⚠️ 5 より先
4. ① フロント（build）           ← ⚠️ 2・3 の後
5. ① SQL（update_log ＋ 記事）
```
- ⚠️ 2 を 1 より先に出すと、② に窓口が無く「ループ検知」の 502 になる。
- ⚠️ 2 を出し忘れると「該当する処理がありません」（404）になる。
- ⚠️ 5 を 3 より先に流すと、後半の記事の行が「表が無い」で止まる。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "request: 'guide_" backend-express/src/gateway/registry.ts
```
⚠️ 3行出れば v2.2.194 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順2　【① レンタルサーバー】PHP
| ファイル | |
|---|---|
| `backend/src/core/express_proxy.php` | `expressProxyRequests()` と `expressProxyExclusive()` の両方に `guide_list`・`guide_article`・`guide_save` を追加 |

確認（【あなたのPC】PowerShell）:
```powershell
curl.exe -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H "Content-Type: application/json" -d '{\"request\":\"guide_list\"}'
```
⚠️ `{"status":"error","message":"認証が必要です。"}` なら ② まで届いている。`該当する処理がありません。` なら PHP が古い。

## 手順3　【① phpMyAdmin】表の作成
⚠️ ファイル: `backend/scripts/sql/2026-10-16_guide_article.sql`（`CREATE TABLE IF NOT EXISTS` の2つだけ。既存の表は変えない）

確認:
```sql
SHOW TABLES LIKE 'guide%';
```
⚠️ `guide_article` と `guide_history` の2行が出ればよい。

## 手順4　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.5ae2ef2c.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順5　【① phpMyAdmin】更新履歴 ＋ 記事
⚠️ ファイル: `backend/scripts/sql/2026-10-16_update_log_2.2.194.sql`（約90KB。前半が update_log の1行、後半が記事58本）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流す（SQL 欄に貼ると長さで切れることがある）。文字コードは UTF-8。

確認:
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT division, COUNT(*) FROM guide_article GROUP BY division;
```
⚠️ 記事は common 11・order 23・spec 13・used 11（計58）。

## 確認（ログインした状態で）
1. 注文営業で、ヘッダーの「マーケット情報」の右に「業務ガイド」が出る。押すと別ウインドウで開く。
2. 右上のパネルの「要確認」の下、トップ画面の4つのボタンの下にも「業務ガイド」が出る。
3. ガイドの窓で記事を開き、再読み込みしても表示が消えない。
4. 建売営業・中古リノベを選んだときも出て、その事業の記事が出る。不動産企画係では出ない。
5. マネージャー（BrandAdmin）・管理者でログインすると「記事を作る」「直す」が出る。一般の人には出ない。
6. ⚠️ ポップアップを止める設定のブラウザでは、同じタブで開く（そのときは戻るボタンで元の画面へ）。
