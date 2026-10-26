# デプロイ手順 v2.2.216　簡単見積もり（2L・JH）・オーナーズハウスの見学予約

⚠️ この3つは **2026-09 上旬から反響が届いていない**（Heroku の中継が、誤って消えた khg-marketing.info/api/ へ送っていたため）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 受け口 `estimate_entry`・`owners_house_reservation` | ⚠️ **② VPS（再ビルド）**。.env.prod の変更は**なし** |
| 2 | ② に届かないときの予備・① から ② への転送 | ① PHP `handlers/estimate_entry.php`・`handlers/owners_house_reservation.php`（新規）・`core/express_proxy.php` |
| 3 | 8サイトの `form/api/index.php`（② に届かないときの中継に2つ足した） | 各ブランドサイト。`Downloads/upload_v2.2.216/form_api/index.php` |
| 4 | 2L 簡単見積もり（送り先・URL パラメータ） | 2lhome.net/mitsumori/。`Downloads/upload_v2.2.216/2l_mitsumori/` |
| 5 | JH 簡単見積もり（送り先・URL パラメータ） | JH のサイトの /estimate/。`Downloads/upload_v2.2.216/jh_estimate/` |
| 6 | オーナーズハウスの見学予約（送り先・URL パラメータ・通知先を画面から外した） | kh-house.jp/owners_house/。`Downloads/upload_v2.2.216/owners_house/` |
| 7 | 版の表示（2.2.216） | ① フロント（いつもの手順） |
| 8 | 更新履歴 | ① DB `backend/scripts/sql/2026-10-23_update_log_2.2.216.sql` |

⚠️ 4〜6 の送り先は ②（api.khg-marketing.info）。⚠️ 本番の CORS_ORIGINS に **JH のサイト**と **https://kh-house.jp** が入っていること（公開フォームのために8サイト分を入れてあるはず。2L はサーバーから送るので不要）。

## 順序
```
0. GitHub で v2.2.216 を main → production へマージ
1. ② 再ビルド
2. ① PHP（3ファイル）           ← ⚠️ 1 の後
3. 8サイトの form/api/index.php  ← ⚠️ 2 の後（v2.2.213 の版をまだ置いていなければ、これを置けば両方入る）
4〜6. 各サイト（2L・JH・オーナーズハウス）   ← ⚠️ 1・2 の後
7. ① フロント
8. ① SQL（更新履歴）
```

## 手順1　【② VPS で実行】再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/estimate/entry.ts backend-express/src/features/ownersHouse/reservation.ts
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認（どちらも保存されない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"estimate_entry"}'
```
⚠️ `登録に失敗しました。`（400）が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"owners_house_reservation"}'
```
⚠️ 同じく `登録に失敗しました。`（400）。

## 手順2　【① FTP】PHP
アップロード（`/dashboard/api/gateway/` の下）:
- `handlers/estimate_entry.php`（新規。⚠️ v2.2.213 の `handlers/campaign_form.php` を使うので、それが置いてあること）
- `handlers/owners_house_reservation.php`（新規）
- `core/express_proxy.php`（許可リストに2つ足した）

## 手順3　【kh-house.jp・JH のサイト FTP】form/api/index.php
`Downloads/upload_v2.2.216/form_api/index.php` を、**kh-house.jp（オーナーズハウス）と JH のサイト（簡単見積もり）の `form/api/index.php` にだけ**上書きする。
- ほかの6サイト（DJH・なごみ・2L・FH・PGH など）は今回は不要。予備の送り直しは「画面を置いたサイト自身の /form/api/」へ行くため（2L はサーバーから①へ直接送るので使わない）。
- ⚠️ ただし v2.2.213 の form/api をまだ置いていないサイトには、この版を置けば v2.2.213 の分も入る（中身は v2.2.213 に2つ足しただけ）。

確認（保存されない）:
```bash
curl -s -X POST https://kh-house.jp/form/api/ -H 'Content-Type: application/json' -H 'Authorization: owners_house_reservation' -d '{"name":""}'
```
⚠️ `登録に失敗しました。` が返ればよい（`Unknown Authorization` なら古い版のまま）。

## 手順4　【2lhome.net FTP】2L 簡単見積もり（/mitsumori/）
1. ⚠️ 今の `result_api.php`・`index.html` を手元に残す。
2. `result_api.php` を上書き、`params.js` を新しく置く。
3. **index.html の `</body>` の直前に1行足す**: `<script src="./params.js"></script>`
   - ⚠️ index.html はこちらで書き換えていない（中に外部サービスのキーの行があるため）。
4. `https://2lhome.net/mitsumori/?utm_source=test` を開いて自分で見積もり → 結果ページへ移る → 社内に通知（form_table の 2l / 20250000_2l_mitsumori の宛先）→ 反響一覧に入り、反響の url_params に `utm_source=test`。

## 手順5　【JH のサイト FTP】JH 簡単見積もり（/estimate/）
1. ⚠️ 今の /estimate/ の index.html を手元に残す。
2. `Downloads/upload_v2.2.216/jh_estimate/` の **index.html と assets/** を上書き（古い assets/ のファイルは残っていてもよい）。.htaccess は今と同じ。
3. `/estimate/?utm_source=test` を開いて見積もりを作る → 結果ページへ移る → 反響一覧に入る（キャンペーン「20250000【JH共通】簡単見積もり」）。
   - 結果ページから来場予約もできる（「…簡単見積もりからの来場予約」）。

## 手順6　【kh-house.jp FTP】オーナーズハウスの見学予約（/owners_house/）
1. ⚠️ 今の /owners_house/ の index.html を手元に残す。
2. `Downloads/upload_v2.2.216/owners_house/` の **index.html と assets/** を上書き（img/・api/・.htaccess は触らない）。
3. どこかのオーナーズハウスのページで自分で見学予約 → 完了の表示 → お礼メールと社内通知（mkt@kh-house.jp ＋ ブランド別の Cc）→ 反響一覧に入る（キャンペーン「◯◯オーナーズハウス」）。
4. ⚠️ テストの反響は消しておく。

## 手順7　【① フロント】いつもの手順
## 手順8　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-23_update_log_2.2.216.sql`

## 終わったら
- Heroku の中継（projects/hub。polar-journey…）は、この3つが新しい送り先に変わったら使われなくなる。止めるかどうかは別途。
