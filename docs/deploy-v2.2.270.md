# デプロイ手順 v2.2.270　面談アンケート（survey）で新しいお客様が出ない

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | survey のお客様の検索（`interview_survey:customers`）を、更新の止まった `customers` 表ではなく `master_data`（注文の顧客DB）から返す | ② VPS（backend-express） |
| 2 | 版の表示 2.2.270 | ① フロント（Dashboard） |
| 3 | 更新履歴 | ① DB `backend/scripts/sql/2026-11-16_update_log_2.2.270.sql` |

- ⚠️ survey の画面（react/survey）・① の PHP・表は変わりません。`.env.prod` の変更もありません。
- ⚠️ **急ぎは ② だけです**（② を更新した時点で survey に新しいお客様が出ます）。

## 順序
```
0. GitHub で v2.2.270 を production へマージ（PR）
1. ② VPS：fetch・checkout → 作り直し        ← これで直る
2. ① Dashboard のフロント（npm run build）
3. ① SQL：2026-11-16_update_log_2.2.270.sql      ← ⚠️ 1回だけ
```

### 手順1　【② VPS】
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
git log -1 --oneline
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
dcp ps express-api
```
- `git log` が v2.2.270 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順2　【① フロント】
いつもどおり `npm run build` してアップロードします。

### 手順3　【① SQL】
phpMyAdmin で `2026-11-16_update_log_2.2.270.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```

## 終わったら（動作確認）
- survey（khg-marketing.info/survey/）の来場前・来場後の検索で、最近の反響のお客様（今月の反響日）が上に出る。

## 切り戻し
- ② を前の版に戻すと、`customers` 表から読む形に戻ります（7月以降のお客様は出なくなります）。

## 知っておくこと
- `customers` 表は 2026-07-22 を最後に更新されていませんでした（ローカルの本番の写しで確認）。
- 返すのは顧客DBに表示している顧客だけ（show_dashboard = 1、個人情報を削除した顧客は除く）。反響日は 'YYYY/MM/DD' にそろえて新しい順（反響日の無い顧客は最後）。
- ローカルでは 26,590件・約3.6MB・0.9秒（① 経由）。
