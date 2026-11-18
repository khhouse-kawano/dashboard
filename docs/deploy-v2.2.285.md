# デプロイ手順 v2.2.285　オーナーズハウスの画像を ② に引っ越し、14枚まで登録

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ownershouse に img_6〜img_14 を足す（画像の列のコメントも直す）。更新履歴1行・業務ガイド1本 | ① DB `backend/scripts/sql/2026-11-18_update_log_2.2.285.sql` |
| 2 | 画像の置き場（owners-house-img ボリューム）と公開（https://api.khg-marketing.info/owners_house/img/…）。画像1枠の登録・削除 `owners_house_admin_image`。物件を返すとき画像を公開URLにする。引っ越しのコマンド | ② VPS（docker-compose.prod.yml・Dockerfile も変わる） |
| 3 | 転送の許可リストに1つ足す | ① PHP `backend/src/core/express_proxy.php` |
| 4 | 管理画面の編集で、画像14枠の登録・外す | ① フロント（Dashboard） |
| 5 | 物件ページ：メイン（画像1〜4）＋下のカルーセル（画像5〜14） | kh-house.jp/owners_house/（react/owners_house の dist） |

- ⚠️ v2.2.284 までを先に済ませてください。
- 画像の名前の決まり：`<物件ID>/<物件ID>_<枠番号2桁>_<中身から作る6文字>.<jpg|png|webp>`（例 `00000002/00000002_01_d72b59.jpg`）。列にはファイル名だけが入ります。
- 引っ越し前の画像の控え（343枚・196MB）：`C:\Users\shinji-kawano\Downloads\owners_house_images\`（ローカルで引っ越したもの。名前は本番と同じ決まり。⚠️ 中身から作る印は同じ画像なら本番と同じになります）

## 順序
```
1. ① SQL：2026-11-18_update_log_2.2.285.sql   ← ⚠️ 1回だけ・一番先
2. GitHub で v2.2.285 を production へマージ（PR）
3. ② VPS（作り直し → 引っ越しのコマンド）
4. ① PHP 1ファイル
5. ① Dashboard のフロント
6. owners_house を build してアップロード        ← ⚠️ ② と引っ越しの後
```

### 手順1　【① SQL】
```bash
mysql < 2026-11-18_update_log_2.2.285.sql
mysql -e "SHOW COLUMNS FROM ownershouse LIKE 'img_1%';"
```
- img_1・img_10〜img_14 が出ればよいです。⚠️ 2回流すと `Duplicate column name` で止まります。

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
- ⚠️ 今回は docker-compose.prod.yml（画像のボリューム）と Dockerfile も変わっています。`dcp up -d express-api` でボリュームが作られます。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。

続けて、画像の引っ越し（kh-house.jp の画像を ② の置き場へ取り込み、DB の画像の列をファイル名に書き換える）：
```bash
dcp exec express-api node dist/cli/ownersHouseMigrateImages.js | tail -5
```
- 最後に `引っ越し：343 枚　NG：2 枚` のように出ます（ローカルでは 343枚・NG 2枚）。
- NG の2枚は物件 00000035 の画像3・4 で、Google ドライブの共有リンク（画像そのものではない）です。いまのサイトでも出ていないので、そのままで構いません（管理画面から登録し直せます）。
- 何度実行しても大丈夫です（済んだ画像は飛ばします）。

確かめる：
```bash
dcp exec express-api sh -c 'ls /data/owners_house | wc -l'
curl -s -o /dev/null -w "%{http_code}\n" https://api.khg-marketing.info/owners_house/img/00000002/00000002_01_d72b59.jpg
```
- 物件の数（74前後）と `200` が出ればよいです。⚠️ 200 にならないときは、URL の6文字が違う可能性があります（`dcp exec express-api ls /data/owners_house/00000002` で確かめる）。

### 手順4　【① PHP】
`backend/src/core/express_proxy.php` を ① の同じ場所へアップロードします（上書き）。

### 手順5　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.285 になればよいです。

### 手順6　【owners_house】
```bash
cd react/owners_house
npm run build
```
`dist` の中身を kh-house.jp の `owners_house/` へアップロードします。
- 変えたファイル：`src/components/GalleryCarousel.tsx`（新規）、`src/components/Owners.tsx`、`src/components/style2.css`

## 終わったら（動作確認）
- https://kh-house.jp/owners_house/ の一覧・地図のサムネイルが出る（画像の URL が api.khg-marketing.info になっている）。
- 物件ページで、上の大きい写真・その下の3枚・下のカルーセル（写真が5枚以上ある物件）が出る。
- Dashboard の「オーナーズハウス」で物件を開き、14枠が出て、写真を選ぶと登録できる（試すときは「外す」で戻してください。⚠️ すぐサイトに出ます）。

## 切り戻し
- フロント・owners_house を前の版に戻すと、画像は前の並べ方になります。⚠️ 引っ越し後は DB の画像の列がファイル名になっているので、② を前の版に戻すと画像が出なくなります。② は戻さないでください。
- ⚠️ `dcp down -v` やボリュームの削除をすると、画像が全部消えます（控えはダウンロードの owners_house_images）。
