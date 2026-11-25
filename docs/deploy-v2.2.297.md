# デプロイ手順 v2.2.297　顧客DB：商談・架電記録から検索を本番の DB でも動くように・要回答の表示

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 商談・架電記録からの検索が、本番の DB で SQL の構文エラー（`JSON_TABLE`）になり 502 だったのを直す。DB の JSON の関数を使わず、記録の列を文字のまま探して、② で記録をほどいて本文に語があるかを決める（古い MariaDB でも動く） | ② VPS（features/database/recordSearch.ts） |
| 2 | 3つの顧客DB：記録の検索が失敗しても全件読み込みに切り替えない。枠に赤で「記録の検索に失敗しました（理由）」と出し、一覧は前のまま。同じ語でもう一度押すと探し直す | Dashboard（frontend の build） |
| 3 | 注文の顧客DB：キャンセル集計・失注集計の「要回答」を、ボタンの上の吹き出しから、ボタンの中の赤い札「要回答 ○」に変える（検索の枠と重なっていた。0件なら出さない） | Dashboard（frontend の build） |
| 4 | 更新履歴1行・業務ガイド「顧客DB」「顧客DB（建売営業）」「顧客DB（中古リノベ）」 | ① DB `backend/scripts/sql/2026-11-24_update_log_2.2.297.sql` |

- ⚠️ v2.2.296 までを先に済ませてください。表の変更はありません。
- ① PHP の変更はありません（request は今までの `database_list` のまま）。
- 原因：v2.2.296 は記録をほどくのに DB の `JSON_TABLE` を使っていました。ローカルの DB（MariaDB 10.11）では動きますが、本番の DB は版が古く、構文エラーになっていました。今回は MariaDB 10.5 の一時コンテナでも動くことを確かめています。

## 順序
```
1. GitHub で v2.2.297 を production へマージ（PR）
2. ② VPS
3. ① SQL：2026-11-24_update_log_2.2.297.sql   ← ⚠️ 1回だけ
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
- `git log` が v2.2.297 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順3　【① SQL】
```bash
mysql < 2026-11-24_update_log_2.2.297.sql
```

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/recordSearch.tsx`
  - `src/components/database/DatabaseOrder.tsx`
  - `src/components/database/DatabaseKaeru.tsx`
  - `src/components/database/DatabaseResale.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
注文・建売・中古の顧客DB で、それぞれ次を確かめます。
- 「展示場」「ローン」などを入れて Enter → 件数が減り、「商談・架電内容」の列が出る。枠に「この検索は今は使えません」「記録の検索に失敗しました」が出ない。
- 店舗・ランクなどを選んだまま検索しても、その条件が残っている。「解除」で元の件数に戻る。
- 注文の顧客DB：キャンセル集計・失注集計のボタンの中に赤い「要回答 ○」が出て、検索の枠と重ならない。
- うまくいかないとき：枠に出た理由と、② のログを見ます。
  ```bash
  dcp logs --since 30m express-api | grep -iE "error|gateway 5"
  ```

## 切り戻し
- 画面：前の build に戻すと、要回答の吹き出しが元に戻ります。記録の検索に失敗したときは、前と同じく全件読み込みに切り替わります。
- ②：前の版に戻すと、記録の検索がまた 502 になります（画面は失敗の理由を出すだけで、一覧は使えます）。
