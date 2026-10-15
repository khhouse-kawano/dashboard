# デプロイ手順 v2.2.191（営業別契約率に部門を追加・契約数ランキングへ改名）

⚠️ v2.2.188〜190 を出し終えてから出すこと（ブランチが v2.2.190 の上に積んである）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `staff_contract` が `department=spec` で建売を集計する | ⚠️ **② VPS**（features/staffContract.ts・gateway/registry.ts） |
| 2 | 営業別契約率の「部門」・契約数ランキングの名称・画面の版 | ① フロント（dashboard） |
| 3 | 更新履歴 | ① DB |

⚠️ DB の列の追加は無い。① の PHP も変わらない。

## 順序
```
0. GitHub で v2.2.191 を main → production へマージ
1. ② Express（build）
2. ① フロント（build）   ← ⚠️ 1 の後
3. ① SQL（update_log）
```
- ⚠️ 2 を先に出すと、建売を選んでも古い ② は `department` を読まないので**注文の数字が出る**（エラーにはならない）。
- ⚠️ 1 だけ出した状態でも、古い画面は `department` を送らないので**今までどおり注文**が出る。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "toDepartment" backend-express/src/gateway/registry.ts
```
⚠️ 2行出れば v2.2.191 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順2　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.24d29da0.js` / `main.b8a7c60b.css`（CSS は変化なし）

## 手順3　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-15_update_log_2.2.191.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

## 出したあとの確認（Master か BrandAdmin で）
| # | 見ること | 期待 |
|---|---|---|
| 1 | 活動サマリー → 営業別契約率 | 絞り込みの左端に「部門」。最初は注文営業で、数字は v2.2.190 と同じ |
| 2 | 部門を建売営業に | 見出しが「建売分譲事業」。課は不動産営業1課・2課、店舗は鹿児島1係など |
| 3 | 活動サマリーのメニュー | 「契約数ランキング」と出て、押すとランキングが開く |
| 4 | 画面の版 | 2.2.191 |

- 建売の担当変更理由は、前任（first_interviewed_user）が入っている顧客が少ないため、ほとんど0になる（不具合ではない）
