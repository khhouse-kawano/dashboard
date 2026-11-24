# デプロイ手順 v2.2.296　顧客DB（注文・建売・中古）：商談・架電記録から検索

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `database_list`（今までの request。GET）が新しい条件 `record` を受ける。商談記録（interview_sheet）・架電記録（call_sheet）の本文（note）にその語がある顧客に、ほかの条件と合わせて絞り込み、そのページの顧客の当たった記録（日付・架電か商談か・アクション・語の前後40字。1人あたり新しい順に5件）を返す。同じ語は60秒だけ結果を覚えておく | ② VPS（features/database/recordSearch.ts（新規）・features/database/list.ts） |
| 2 | 3つの顧客DB のページ送りの右に「商談・架電記録」の検索の枠（入力欄・「商談・架電記録から検索」・「解除」）。Enter かボタンで検索（入力しただけでは探さない）。検索している間は 担当営業｜**商談・架電内容**｜ステータス の列が増え、探した語を黄色の太字で出す。語は URL の `record=` にも出る | Dashboard（frontend の build） |
| 3 | 更新履歴1行・業務ガイド「顧客DB」「顧客DB（建売営業）」「顧客DB（中古リノベ）」 | ① DB `backend/scripts/sql/2026-11-24_update_log_2.2.296.sql` |

- ⚠️ v2.2.295 までを先に済ませてください。表の変更はありません。
- ① PHP の変更はありません（request は今までの `database_list` のまま。転送リスト・GET_ALLOWED_REQUESTS は済んでいます）。
- ⚠️ 画面（手順4）は ② のあとに上げてください。② が古いまま検索すると、条件が無視されて絞り込まれません（列は出ますが中身が空になります）。
- ② に届かず、今までの全件読み込み（POST）に切り替わっているときは、検索の枠が押せなくなり「この検索は今は使えません」と出ます。

## 順序
```
1. GitHub で v2.2.296 を production へマージ（PR）
2. ② VPS
3. ① SQL：2026-11-24_update_log_2.2.296.sql   ← ⚠️ 1回だけ
4. Dashboard の画面を build してアップロード
```

### 手順2　【② VPS】
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
- `git log` が v2.2.296 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順3　【① SQL】
```bash
mysql < 2026-11-24_update_log_2.2.296.sql
```

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/recordSearch.tsx`（新規）
  - `src/components/database/DatabaseOrder.tsx`
  - `src/components/database/DatabaseKaeru.tsx`
  - `src/components/database/DatabaseResale.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
注文・建売・中古の顧客DB で、それぞれ次を確かめます。
- ページ送りの右に「商談・架電記録」の枠がある。入力しただけでは一覧は変わらない。
- 「ローン」などを入れて Enter（またはボタン）→ 数秒で件数が減り、担当営業とステータスの間に「商談・架電内容」の列が出る。探した語が黄色の太字になっている。
- 店舗・ランクなどを選んだまま検索すると、その条件も残っている。アドレスに `record=…` が出て、読み込み直しても同じ一覧が出る。
- 「解除」で列が消え、件数が元に戻る。
- 検索は本番の記録の量しだいで時間がかかります。1回に10秒を超えるようなら知らせてください（ローカルでは ② の中で約1秒）。

## 切り戻し
- 画面：前の build に戻せば、検索の枠と列が無くなるだけです。
- ②：前の版に戻すと `record` が無視されるだけです（画面を先に戻してください）。
