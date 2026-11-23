# デプロイ手順 v2.2.289　顧客DB（建売）：1ページずつ GET で読む・左の4列を固定

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい request `database_list`（建売）。② が顧客を絞り込み・並べ替え・ページ分けして、1ページ分だけ返す。重複顧客・ギフトの印、名寄せの候補（dupOf）、選択肢（master=1）も返す。ギフトの判定は、返すページの顧客だけを調べる | ② VPS（features/database/list.ts・gift.ts、gateway/registry.ts） |
| 2 | `database_list` を GET で受けられるように。② へ転送するリスト2つに足す | ① PHP 2ファイル（core/db.php・core/express_proxy.php） |
| 3 | 顧客DB（建売）を開いたら1ページ目の20件だけ読む。条件・ページ・表示件数を変えたら GET で取り直す。② に届かないときは今までの全件読み込み（POST）に切り替える。左の4列（編集・店舗・顧客名・担当営業）を固定 | Dashboard（frontend の build） |
| 4 | 更新履歴1行・業務ガイド「顧客DB（建売営業）」の記事 | ① DB `backend/scripts/sql/2026-11-23_update_log_2.2.289.sql` |

- ⚠️ v2.2.288 までを先に済ませてください。表の変更はありません。
- ⚠️ 画面（手順5）は ② と ① PHP の後に上げてください。先に上げると、`database_list` が ① で 404 になり、画面は全件読み込みに切り替わります（動きますが、速くなりません）。
- 注文・中古の顧客DB は変わりません（後のブランチ）。

## 順序
```
1. GitHub で v2.2.289 を production へマージ（PR）
2. ② VPS
3. ① PHP 2ファイル
4. ① SQL：2026-11-23_update_log_2.2.289.sql   ← ⚠️ 1回だけ
5. Dashboard の画面を build してアップロード
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
- `git log` が v2.2.289 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順3　【① PHP】
次の2ファイルを ① の同じ場所へアップロードします（上書き）。
- `backend/src/core/db.php`
- `backend/src/core/express_proxy.php`

確認（トークン無しで送って 401 なら ② まで届いています。404 なら手順3の漏れです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://（① のドメイン）/dashboard/api/gateway/?request=database_list&category=spec&page=1'
```

### 手順4　【① SQL】
```bash
mysql < 2026-11-23_update_log_2.2.289.sql
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：`src/components/database/DatabaseKaeru.tsx`・`src/utils/version.ts`

## 終わったら（動作確認）
- 建売営業で 顧客DB を開くと、すぐに1ページ目が出る（全件を読み込む待ちが無い）。
- 店舗・入居希望地などで絞ると、件数が変わる。ページ・表示件数を変えると、その分が出る。
- 一覧を横に動かしても、左の「顧客情報編集・店舗・顧客名・担当営業」の4列が残る。
- 顧客の「編集」を閉じたあと、同じページのまま最新になる。
- 重複顧客のアイコンが出ている顧客で、アイコンを押すと名寄せの画面に候補が出る。

## 切り戻し
画面を前の build に戻せば、今までどおり全件を読み込む形に戻ります。② と ① PHP は、request が1つ増えるだけなので戻さなくて構いません。
