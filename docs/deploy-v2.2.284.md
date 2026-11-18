# デプロイ手順 v2.2.284　オーナーズハウスの管理画面

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ownershouse に列のコメント・lg_code・updated_at・updated_by を足す。全国地方公共団体コードの表 lg_code（1,794件）を作る。更新履歴1行・業務ガイド1本 | ① DB `backend/scripts/sql/2026-11-18_update_log_2.2.284.sql` |
| 2 | 管理画面の一覧・保存 `owners_house_admin_list` / `owners_house_admin_save`（ログイン必須） | ② VPS |
| 3 | 転送の許可リストに2つを足す | ① PHP `backend/src/core/express_proxy.php` |
| 4 | 左のメニュー「オーナーズハウス」（注文・PC のみ）。URL は `/ownersHouseAdmin` | ① フロント（Dashboard） |

- ⚠️ v2.2.283 まで（ownershouse の表）を先に済ませてください。
- owners_house（サイト）の変更はありません。サイトは今までどおり公開（flag = '1'）の物件を読みます。

## 順序
```
0. v2.2.283 までのデプロイが終わっていること
1. ① SQL：2026-11-18_update_log_2.2.284.sql   ← ⚠️ 1回だけ・一番先
2. GitHub で v2.2.284 を production へマージ（PR）
3. ② VPS
4. ① PHP 1ファイル
5. ① Dashboard のフロント（npm run build → アップロード）   ← ⚠️ ② より後
```

### 手順1　【① SQL】
```bash
mysql < 2026-11-18_update_log_2.2.284.sql
```
- 最後に `lg_code_rows 1794`、そのあと `matched 59 / unmatched 16`、最後に `matched 75 / unmatched 0` が出ればよいです。
  - 2回目の確認の前に、一覧にない呼び名（出水阿久根・加世田・肝属）の16件を、物件の所在地の市町村（出水・阿久根・長島・薩摩川内・南さつま・南大隅）に付け直しています（了承済み）。⚠️ サイトのエリアの絞り込みの名前も変わります。
- ⚠️ ALTER TABLE と CREATE TABLE が入っているので、2回流すと `Duplicate column name` / `Table 'lg_code' already exists` で止まります（その場合、更新履歴の行が1行増えているので後から入った方を消してください）。
- safe update モードでも止まらないよう、UPDATE の前で切ってあります。

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
- `git log` が v2.2.284 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【① PHP】
`backend/src/core/express_proxy.php` を ① の同じ場所へアップロードします（上書き）。

### 手順5　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.284 になればよいです。

## 終わったら（動作確認）
- 注文営業で、左のメニューの「K-snap登録」の下に「オーナーズハウス」が出る（スマホ・建売では出ない）。
- 開くと物件が30件出て、下までスクロールすると続きが出る。
- 行を押すと編集の画面が開き、都道府県・市区町村・管理店舗が選ばれていて、地図にピンが出る。
- 試しに直すときは、非公開の物件か、内容を戻せる物件で行ってください（保存するとサイトにすぐ出ます）。

## 気をつけること
- 管理店舗は shop_list の名前（例 KH霧島店）で選び、保存するときに正式名称（国分ハウジング霧島店）に直します（frontend の ownershouse/types.ts の toFormalShopName）。サイトの表示は今までどおりです。
- 保存すると、物件ページの地図（map_address）がピンの位置から作り直されます。

## 切り戻し
フロント・②・① PHP を前の版に戻すだけです（足した列・表は残しておいて問題ありません）。
