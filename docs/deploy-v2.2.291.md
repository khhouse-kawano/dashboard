# デプロイ手順 v2.2.291　顧客DB（注文）を1ページずつ GET で読む・見た目を建売とそろえる・条件を URL に出す

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `database_list` で注文（category=order）も受ける。今の画面と同じ条件で絞り込み、1ページ分を返す。絞り込みの条件は紹介者・イベント・K-Snap・Hotlead・家族名・「名前&電話」「名前+住所」。今のページの Hotlead も返す。master=1 のときは選択肢と、キャンセル・失注の要回答の件数も返す | ② VPS（features/database/list.ts、gateway/registry.ts） |
| 2 | 顧客DB（注文）を開いたら、1ページ目の20件だけを GET で読む。② に届かないときは今までの全件読み込み（POST）に切り替える。見た目は建売（v2.2.290）と同じにし、左の4列を固定する | Dashboard（frontend の build） |
| 3 | 顧客DB（注文・建売）で、選んだ条件・ページ・表示件数を URL にも出す。URL に条件を付けて開くと、その条件で開く。編集を閉じても条件は残る | Dashboard（frontend の build） |
| 4 | 更新履歴1行・業務ガイド「顧客DB」「顧客DB（建売営業）」の記事 | ① DB `backend/scripts/sql/2026-11-23_update_log_2.2.291.sql` |

- ⚠️ v2.2.290 までを先に済ませてください。表の変更はありません。
- ① PHP の変更はありません（`database_list` は v2.2.289 で request 名だけで許可済みで、注文もそのまま ② へ届きます）。
- ⚠️ 画面（手順4）は ② の後に上げてください。先に上げると、注文の `database_list` を ② が受けられず、画面は全件読み込みに切り替わります（動きますが、速くなりません）。
- 中古の顧客DB は変わりません。

## 順序
```
1. GitHub で v2.2.291 を production へマージ（PR）
2. ② VPS
3. ① SQL：2026-11-23_update_log_2.2.291.sql   ← ⚠️ 1回だけ
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
- `git log` が v2.2.291 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

確認（トークン無しで送って 401 なら ② まで届いています）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://（① のドメイン）/dashboard/api/gateway/?request=database_list&category=order&page=1'
```

### 手順3　【① SQL】
```bash
mysql < 2026-11-23_update_log_2.2.291.sql
```

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/DatabaseOrder.tsx`
  - `src/components/database/DatabaseKaeru.tsx`
  - `src/components/database/listUrl.ts`（新規）
  - `src/components/database/databaseListStyle.ts`（新規）
  - `src/utils/version.ts`

## 終わったら（動作確認）
注文営業で顧客DB を開き、次を確かめます。
- すぐに1ページ目が出る（全件を読み込む待ちが無い）。
- キャンセル集計・失注集計の上に、要回答の件数が今までどおり出る。
- 住所・ランク・Hotlead などで絞ると件数が変わり、ブラウザのアドレスに `?address=…` のように条件が出る。
- そのアドレスで読み込み直すと、同じ条件・同じページで開き、欄にも値が入っている。
- 「編集」を開くと、アドレスに `id=…` が付く。閉じると `id` だけが外れ、条件は残る。
- 一覧を横に動かしても、左の4列が残る。

建売営業で顧客DB を開き、次を確かめます。
- 条件を選ぶと、アドレスに条件が出る。

## 切り戻し
画面を前の build に戻せば、今までどおり全件を読み込む形に戻ります。② は注文の request が1つ増えるだけなので、戻さなくて構いません。
