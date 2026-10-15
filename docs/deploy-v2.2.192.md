# デプロイ手順 v2.2.192（紹介キャンペーンサマリー）

⚠️ v2.2.191 を出し終えてから出すこと（ブランチが v2.2.191 の上に積んである）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい窓口 `introductory_summary`（紹介の歩留まりの集計） | ⚠️ **② VPS**（features/introductory/summary.ts・gateway/registry.ts） |
| 2 | 紹介キャンペーン → 紹介キャンペーンサマリー（全画面）・画面の版 | ① フロント（dashboard） |
| 3 | 更新履歴 | ① DB |

⚠️ DB の列の追加は無い。① の PHP も変わらない。

## 順序
```
0. GitHub で v2.2.192 を main → production へマージ
1. ② Express（build）
2. ① フロント（build）   ← ⚠️ 1 の後
3. ① SQL（update_log）
```
- ⚠️ 2 を先に出すと、② に窓口が無いので画面が「集計を取得できませんでした」になる（ゲートウェイは知らない request を ① へ回すが、① にも無い）。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "request: 'introductory_summary'" backend-express/src/gateway/registry.ts
```
⚠️ 1行出れば v2.2.192 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順2　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.e10fc675.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること（v2.2.191 と同じ）

## 手順3　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-15_update_log_2.2.192.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | ヘッダー → 紹介キャンペーン | 「反響一覧」「紹介キャンペーンサマリー」の2つ |
| 2 | 紹介キャンペーンサマリー | 全画面で開く。KPI（反響・面談・次アポ・契約・契約までの日数）と紹介元別などの表 |
| 3 | エリアを選ぶ | 店舗の選択肢がそのエリアだけになる（建売の「宮崎係」なども出る） |
| 4 | 開始月・終了月を選ぶ | 数字が変わる（反響取得日で絞る） |
| 5 | 画面の版 | 2.2.192 |
