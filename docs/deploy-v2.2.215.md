# デプロイ手順 v2.2.215　オーナーズハウス募集フォームの作り直し

| # | 何が変わるか | どこ |
|---|---|---|
| 0 | **今すぐ**：今の photo/ に PHP を動かさない .htaccess を置く | ⚠️ **kh-house.jp**（オーナーズハウスのフォームのサーバー）`owners_house/form/photo/.htaccess` |
| 1 | 受付を残す表 `owners_house_application` | ① DB `backend/scripts/sql/2026-10-23_owners_house_application.sql` |
| 2 | フォームの受け口（写真付き）・① から ② への転送（一覧・取り込み） | ① PHP `backend/src/handlers/owners_house_application.php`（新規）・`backend/src/core/express_proxy.php` |
| 3 | 一覧 `owners_house_application_list`・過去メールの取り込み `owners_house_application_import` | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 4 | Dashboard の画面「反響管理 → オーナーズハウス募集」・版の表示（2.2.215） | ① フロント（ビルドしてアップロード。いつもの手順） |
| 5 | 新しいフォーム | ⚠️ **kh-house.jp** `owners_house/form/`（`backend/scripts/owners_house_form/` の中身） |
| 6 | 過去の通知メールの取り込み | ⚠️ Google Apps Script（新しいスクリプト。手で1回実行） |
| 7 | 更新履歴・業務ガイドの記事 | ① DB `backend/scripts/sql/2026-10-23_update_log_2.2.215.sql` |

## 順序
```
0. kh-house.jp の photo/.htaccess   ← ⚠️ マージを待たずに今すぐ
   GitHub で v2.2.215 を main → production へマージ
1. ① SQL（表）
2. ① PHP（owners_house_application.php・express_proxy.php）   ← ⚠️ 1 の後
3. ② 再ビルド
4. ① フロント
5. kh-house.jp のフォームを差し替え   ← ⚠️ 1・2 の後（先に差し替えると送信が失敗する）
6. GAS で過去のメールを取り込む   ← ⚠️ 1・3 の後
7. ① SQL（更新履歴・記事）
```

## 手順0　【kh-house.jp FTP】photo/ の .htaccess（今すぐ）
- `backend/scripts/owners_house_form/photo.htaccess` を、`owners_house/form/photo/` に **`.htaccess` という名前で**置く。
- 確かめ方：ブラウザで `https://kh-house.jp/owners_house/form/photo/` の中の画像（例 `naikan2IMG_4941.jpeg`）が今までどおり開くこと。
- ⚠️ ついでに photo/ の中に、画像（.jpg .jpeg .png）以外のファイルが無いか見る。あれば消す前に知らせてください（誰かが置いた可能性がある）。

## 手順1　【① phpMyAdmin】表を作る
ファイル: `backend/scripts/sql/2026-10-23_owners_house_application.sql`（⚠️ 2回流しても壊れない）

## 手順2　【① FTP】PHP
アップロード（`/dashboard/api/gateway/` の下）:
- `handlers/owners_house_application.php`（新規）
- `core/express_proxy.php`（許可リストと expressProxyExclusive() に `owners_house_application_list` / `_import` を足した）

⚠️ 写真の保存先は k-snap と同じ `/dashboard/api/images/`（`KSNAP_IMAGE_DIR` の設定もそのまま）。追加の設定は無い。

確認（保存はされない。名前が空なので 400）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -F request=owners_house_application -F name= -F photo_mode=request
```
⚠️ `入力内容をご確認ください。` が返ればよい（`該当する処理がありません` ならアップロードできていない）。

## 手順3　【② VPS で実行】再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/ownersHouse/application.ts
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"owners_house_application_import"}'
```
⚠️ `合い言葉が違います。` が返ればよい。

## 手順4　【① フロント】
いつもの手順でビルドしてアップロード。ヘッダーの「反響管理」に「オーナーズハウス募集」が出る（まだ0件）。

## 手順5　【kh-house.jp FTP】フォームの差し替え
1. ⚠️ 今の `owners_house/form/` の **index.html・step2.php・step3.php・regist.php** を手元に残す（戻すとき用）。
2. `backend/scripts/owners_house_form/` の **index.html・form.css・form.js・api.php** をアップロード（index.html は上書き）。
   - ⚠️ `_astro/`・`images/`・`sample/`・`photo/` はそのまま使う（触らない）。
   - ⚠️ `photo.htaccess` は手順0 で photo/ に置いたもの（form/ には置かない）。
3. ⚠️ **step2.php・step3.php・regist.php をサーバーから消す（または名前を変える）**。残っていると、写真を名前のまま保存する古い口が開いたままになる。
4. 自分で1回応募する（「写真を添付する」で写真3枚）→
   - 完了画面が出る
   - 社内（mkt@kh-group.jp ほか）に「【オーナーズハウス募集】◯◯様からの応募がありました」が届き、写真のリンクが開ける
   - Dashboard の「オーナーズハウス募集」に出る
   - ⚠️ 確認が済んだら、テストの応募を消す（phpMyAdmin で `DELETE FROM owners_house_application WHERE id = ◯;`。写真は `/dashboard/api/images/` から消す）

## 手順6　【GAS】過去のメールの取り込み
1. 以前の通知メール（件名「オーナーズハウスへの募集がありました。」）が届いている Gmail のアカウントで、新しい Apps Script のプロジェクトを作る（会員登録の GAS と同じプロジェクトに足してもよい）。
2. `backend/scripts/gas/OwnersHouseMailImport.gs` の中身を貼って保存。
3. 「プロジェクトの設定」→「スクリプト プロパティ」→ `MEMBER_ENTRY_KEY`（会員登録の GAS と同じ値）。同じプロジェクトなら設定済み。
4. `OwnersHouseMailImport` を**手で1回**実行（⚠️ トリガーは作らない）。実行ログの最後に「おわり: 取り込み ◯ 件 / 取り込み済み ◯ 件 …」。
   - ⚠️ もう一度実行しても二重には入らない（取り込み済みは飛ばす）。
5. Dashboard の「オーナーズハウス募集」に「過去のメール」の印付きで並ぶことを確かめる。

## 手順7　【① phpMyAdmin】更新履歴・業務ガイドの記事
ファイル: `backend/scripts/sql/2026-10-23_update_log_2.2.215.sql`
