# デプロイ手順 v2.2.283　オーナーズハウスの物件を ① の DB に移し、② から読む

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ① の DB に `ownershouse`（物件 76件）を作る。更新履歴1行 | ① DB `backend/scripts/sql/2026-11-18_update_log_2.2.283.sql` |
| 2 | 物件の一覧・1件を返す `owners_house_list` / `owners_house_detail` を足す（ログインなし・読み取りだけ） | ② VPS |
| 3 | 転送の許可リストに2つを足す | ① PHP `backend/src/core/express_proxy.php` |
| 4 | オーナーズハウスのサイトが、物件を ② から読む（以前は kh-house.jp/owners_house/api/） | kh-house.jp/owners_house/（react/owners_house の dist） |

- Dashboard の画面（フロント）の変更はありません。
- ⚠️ これから物件データの元は ① の DB の `ownershouse` です。kh-house.jp 側の DB（khgweb_ownwershouse）を直しても、サイトには出ません。管理画面は Dashboard に後で作ります。
- ⚠️ ② に届かないときの予備はありません。② が止まっているあいだは、サイトに「物件データの取得に失敗」と出ます。

## 順序
```
1. ① SQL：2026-11-18_update_log_2.2.283.sql   ← ⚠️ 1回だけ・一番先
2. GitHub で v2.2.283 を production へマージ（PR）
3. ② VPS
4. ① PHP 1ファイル
5. owners_house を build してアップロード        ← ⚠️ ② より後
```

### 手順1　【① SQL】
```bash
mysql < 2026-11-18_update_log_2.2.283.sql
mysql -e "SELECT COUNT(*) FROM ownershouse; SELECT no, version FROM update_log ORDER BY no DESC LIMIT 1;"
```
- `76` と `2.2.283` が出ればよいです。
- ⚠️ 表を作る SQL（CREATE TABLE）なので、2回流すと `Table 'ownershouse' already exists` で止まります（その場合、更新履歴の行が1行増えているので、後から入った方を消してください）。

### 手順3　【② VPS】
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
- `git log` が v2.2.283 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

確かめる（どこからでも）：
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"owners_house_detail","id":"00000002"}' | head -c 120
```
- `{"status":"success","data":{"no":3,"id":"00000002",...` が出ればよいです。

### 手順4　【① PHP】
`backend/src/core/express_proxy.php` を ① の同じ場所へアップロードします（上書き）。

### 手順5　【owners_house】
```bash
cd react/owners_house
npm run build
```
`dist` の中身を kh-house.jp の `owners_house/` へアップロードします（いつもどおり）。
- 変えたファイル：`src/api/houses.ts`（新規）、`src/components/Map.tsx`、`src/components/Owners.tsx`

## 終わったら（動作確認）
- https://kh-house.jp/owners_house/ で物件の一覧・地図が出る。
- 物件を押すと、物件のページに中身が出る。
- ブラウザの開発者ツールの「ネットワーク」で、`api.khg-marketing.info/api/gateway` に送っていて、`kh-house.jp/owners_house/api/` には送っていない。

## 切り戻し
owners_house を前の build に戻せば、以前の kh-house.jp/owners_house/api/ から読む形に戻ります（②・① はそのままで問題ありません）。
