# デプロイ手順 v2.2.292　顧客DB（中古）を1ページずつ GET で読む・見た目を注文・建売とそろえる・条件を URL に出す

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `database_list` で中古（category=used）も受ける。今の画面と同じ条件で絞り込み、1ページ分を返す。表示する行の重複の印・初回通電日・次回架電日・媒介も返す。dupOf で名寄せの候補、master=1 で媒体・担当を返す | ② VPS（features/database/list.ts・queries.ts、gateway/registry.ts） |
| 2 | 顧客DB（中古）を開いたら、1ページ目の20件だけを GET で読む。② に届かないときは今までの全件読み込み（POST・① の database_used.php）に切り替える。見た目を注文・建売と同じにし、左の4列（編集・複製・店舗・顧客名）を固定する。条件・ページ・表示件数を URL に出し、URL の条件で開く | Dashboard（frontend の build） |
| 3 | 更新履歴1行・業務ガイド「顧客DB（中古リノベ）」の記事 | ① DB `backend/scripts/sql/2026-11-23_update_log_2.2.292.sql` |

- ⚠️ v2.2.291 までを先に済ませてください。表の変更はありません。
- ① PHP の変更はありません（`database_list` は request 名だけで許可済みで、中古もそのまま ② へ届きます）。
- ⚠️ 画面（手順4）は ② の後に上げてください。先に上げると、中古の `database_list` を ② が受けられず、画面は全件読み込みに切り替わります（動きますが、速くなりません）。

## 順序
```
1. GitHub で v2.2.292 を production へマージ（PR）
2. ② VPS
3. ① SQL：2026-11-23_update_log_2.2.292.sql   ← ⚠️ 1回だけ
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
- `git log` が v2.2.292 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

確認（トークン無しで送って 401 なら ② まで届いています）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://（① のドメイン）/dashboard/api/gateway/?request=database_list&category=used&page=1'
```

### 手順3　【① SQL】
```bash
mysql < 2026-11-23_update_log_2.2.292.sql
```

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/DatabaseResale.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
中古リノベで顧客DB を開き、次を確かめます。
- すぐに1ページ目が出る（全件を読み込む待ちが無い）。
- 店舗・住所・ステータスなどで絞ると件数が変わり、アドレスに `?address=…` のように条件が出る。
- そのアドレスで読み込み直すと、同じ条件・同じページで開き、欄にも値が入っている。
- 「初回通電日」「次回架電日」、売り:ポータルの「媒介編集／媒介追加」、顧客名の左の緑のマーク（重複）が今までどおり出る。緑のマークを押すと名寄せの画面に候補が出る。
- 「編集」を開くと、アドレスに `id=…` が付く。閉じると `id` だけが外れ、条件は残る。
- 一覧を横に動かしても、左の4列が残る。

## 切り戻し
画面を前の build に戻せば、今までどおり全件を読み込む形に戻ります。② は中古の request が1つ増えるだけなので、戻さなくて構いません。
