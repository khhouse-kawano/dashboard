# デプロイ手順 v2.2.191（営業別契約率に部門を追加・契約数ランキングへ改名・Claudeによる分析を全員に開放・資金計画書の金利データ反映）

⚠️ v2.2.188〜190 を出し終えてから出すこと（ブランチが v2.2.190 の上に積んである）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `staff_contract` が `department=spec` で建売を集計する | ⚠️ **② VPS**（features/staffContract.ts・gateway/registry.ts） |
| 2 | 営業別契約率の「部門」・契約数ランキングの名称・Claudeによる分析（全員が開ける／上部に競合分析レポート）・画面の版 | ① フロント（dashboard） |
| 2' | 資金計画書（funding-plan/index.html）が `金利データ.js` を顧客の読み込み後にも当て直す | ① フロント（dashboard の build に含まれる） |
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
- ローカルのビルド結果: `main.d1539a8f.js` / `main.b8a7c60b.css`（CSS は変化なし）
- ⚠️ ① の `/dashboard/funding-plan/金利データ.js`（2026-10-15 に手で置いたもの）は**リポジトリに無い。** デプロイ後に残っているか確認すること（下の確認 5）
- ⚠️ Claudeによる分析の変更はフロントだけ（② の権限は元から `kpi_*` が master、競合分析レポートの閲覧が staff）

## 手順3　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-15_update_log_2.2.191.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 0 | **Master 以外**でヘッダーの「Claudeによる分析」 | 「権限がありません」が出ずに開く。競合分析レポートだけが見える（登録・削除・管理者専用の部分は出ない） |
| 0' | **Master** で同じボタン | 上に競合分析レポート、下に「管理者専用」の分析メニューと保存済みの分析 |
| 1 | （Master か BrandAdmin で）活動サマリー → 営業別契約率 | 絞り込みの左端に「部門」。最初は注文営業で、数字は v2.2.190 と同じ |
| 2 | 部門を建売営業に | 見出しが「建売分譲事業」。課は不動産営業1課・2課、店舗は鹿児島1係など |
| 3 | 活動サマリーのメニュー | 「契約数ランキング」と出て、押すとランキングが開く |
| 4 | 画面の版 | 2.2.191 |
| 5 | 保存済みの顧客で「デジシキ作成」→ ⑨ 銀行金利比較 | 基準日が 2026-10-15、鹿児島銀行などが 金利データ.js の値（例 kagin 1.6）。⚠️ 古いままなら再読み込み。それでも古ければ `金利データ.js` が消えていないか確認 |

- 建売の担当変更理由は、前任（first_interviewed_user）が入っている顧客が少ないため、ほとんど0になる（不具合ではない）
