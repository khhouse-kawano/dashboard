# デプロイ手順 v2.2.193（重複反響サマリー）

⚠️ v2.2.192 を出し終えてから出すこと（ブランチが v2.2.192 の上に積んである）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい窓口 `duplicate_summary`（重複反響の集計） | ⚠️ **② VPS**（features/duplicateSummary.ts・gateway/registry.ts） |
| 2 | ① から ② へ `duplicate_summary` を転送する（⚠️ 入れないと ① が404を返す） | ⚠️ **① PHP**（core/express_proxy.php） |
| 3 | 反響管理 → 重複反響サマリー（全画面）・画面の版 | ① フロント（dashboard） |
| 4 | 更新履歴 | ① DB |

⚠️ DB の列の追加は無い。

## 順序
```
0. GitHub で v2.2.193 を main → production へマージ
1. ② Express（build）
2. ① PHP（express_proxy.php）   ← ⚠️ 1 の後
3. ① フロント（build）           ← ⚠️ 2 の後
4. ① SQL（update_log）
```
- ⚠️ 2 を 1 より先に出すと、② に窓口が無く「ループ検知」の 502 になる。
- ⚠️ 2 を出し忘れると「該当する処理がありません」（404）になる。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "request: 'duplicate_summary'" backend-express/src/gateway/registry.ts
```
⚠️ 1行出れば v2.2.193 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順2　【① レンタルサーバー】PHP
| ファイル | |
|---|---|
| `backend/src/core/express_proxy.php` | `expressProxyRequests()` と `expressProxyExclusive()` の両方に `duplicate_summary` を追加 |

確認（【あなたのPC】PowerShell）:
```powershell
curl.exe -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H "Content-Type: application/json" -d '{\"request\":\"duplicate_summary\"}'
```
⚠️ `{"status":"error","message":"認証が必要です。"}` なら ② まで届いている。`該当する処理がありません。` なら PHP が古い。

## 手順3　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.52118cc0.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順4　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-16_update_log_2.2.193.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | ヘッダー → 反響管理 | 一番下に「重複反響サマリー」（Master・それ以外の両方） |
| 2 | 重複反響サマリー | 全画面。KHG＋8ブランドのカード、ブランド色の縁、横棒（積み上げ） |
| 3 | 開始月・終了月 | 数字が変わる（カードのブランドの反響取得日で絞る） |
| 4 | 画面の版 | 2.2.193 |
- ⚠️ 開くまで1〜2秒かかる（3つの台帳 約3.8万件を毎回突き合わせるため）
