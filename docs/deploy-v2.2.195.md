# デプロイ手順 v2.2.195（重複反響サマリー：反響媒体ごとの内訳）

⚠️ v2.2.194 は main にマージ済み。このブランチは main（v2.2.194 を含む）から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `duplicate_summary` が他ブランドの行ごとに反響媒体の内訳（`media`）も返す | ⚠️ **② VPS**（features/duplicateSummary.ts） |
| 2 | 重複反響サマリーでブランド名を押すと媒体ごとの内訳が開く・画面の版 | ① フロント（dashboard） |
| 3 | 更新履歴 ＋ 記事1本（重複反響サマリー） | ① DB |

- ⚠️ ① の PHP（express_proxy.php）は**変更なし**（新しい request は無い）。
- ⚠️ 表の作成も無し。

## 順序
```
0. GitHub で v2.2.195 を main → production へマージ
1. ② Express（build）
2. ① フロント（build）   ← ⚠️ 1 の後
3. ① SQL（update_log ＋ 記事）
```
- ⚠️ 2 を 1 より先に出すと、ブランド名を押しても内訳が空になる（② が媒体を返さないため。画面は落ちない）→ 先に 1。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "sales_promotion_name AS medium" backend-express/src/features/duplicateSummary.ts
```
⚠️ 1行出れば v2.2.195 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順2　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.a5e20637.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順3　【① phpMyAdmin】更新履歴 ＋ 記事
ファイル: `backend/scripts/sql/2026-10-16_update_log_2.2.195.sql`（前半が update_log の1行、後半が記事1本）
- ⚠️ phpMyAdmin の「インポート」でファイルごと流すのが確実（文字コード UTF-8）。

確認:
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
SELECT title, updated_by, updated_at FROM guide_article WHERE title = '重複反響サマリー';
```

## 確認（ログインした状態で）
1. ヘッダー「反響管理 → 重複反響サマリー」。KH などのカードの下の表の見出しに「（押すと媒体別）」が出る。
2. ブランド名を押すと、その下に「反響媒体・反響・重複・重複率・来場・次アポ・契約」の表が開く。もう一度押すと閉じる。
3. 見出し（重複率など）を押すと並べ替わる。
4. エリア・期間を変えても、開いた表の数字が変わる。
5. 業務ガイド「重複反響サマリー」に「反響媒体ごとに見る」が出る。
