# デプロイ手順 v2.2.190（見学クラウドの予約を ② で受ける）

⚠️⚠️ **v2.2.188・v2.2.189 を出し終えてから**出すこと（`line_id`・`url_params`・`landing_params` の列を使う。列が無いと ⚠️ **見学クラウドの予約がまるごと保存できない**）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 見学クラウドの予約の受け口 `kengaku_cloud:entry` | ⚠️ **② VPS**（features/kengakuCloud/entry.ts ほか） |
| 2 | ② が `https://www.ie-miru.jp` からの通信を受け付ける | ⚠️ **② の設定**（CORS_ORIGINS） |
| 3 | 見学クラウドの GTM の送信先 | ⚠️ **GTM**（別のエンジニア。`gtm_reserve_send_v2.html`） |
| 4 | 画面の版 | ① フロント（dashboard） |
| 5 | 更新履歴 | ① DB |

## 順序（⚠️ この順を守る）
```
0. GitHub で v2.2.190 を main → production へマージ
1. ② Express（build）
2. ② の CORS_ORIGINS に https://www.ie-miru.jp を追加 → dcp up -d express-api
3. 動作確認（下の curl）
4. GTM の差し替え（別のエンジニア）  ← ⚠️ 1〜3 の後
5. ① フロント（build）
6. ① SQL（update_log）
```
- ⚠️ 4 を 1 より先にすると、② に受け口が無いので ⚠️ **予約が ① の PHP へ転送される**（ゲートウェイは知らない request を ① へ回す）。① にこの受け口は無いので保存されない。
- ⚠️ 旧の ① `khg-marketing.info/api/kengakuCloud/all/` は**消さないこと**（GTM を戻せば元に戻せる）。

## 手順1　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "request: 'kengaku_cloud'" backend-express/src/gateway/registry.ts
```
⚠️ 1行出れば v2.2.190 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

## 手順2　【② VPS】CORS_ORIGINS に見学クラウドを追加
- ② の環境変数 `CORS_ORIGINS` に `https://www.ie-miru.jp` を足す（⚠️ ついでに PG HOUSE の `https://kyusyu.pg-house.jp` も）
- ⚠️ 無くても `sendBeacon` の送信は届く。ただし fetch / XHR に回ったとき応答を読めず、⚠️ **二重送信や「送信に失敗しました」の表示**になりうる
```bash
dcp up -d express-api
```

## 手順3　確認
```bash
curl -s -o /dev/null -X OPTIONS -H "Origin: https://www.ie-miru.jp" -H "Access-Control-Request-Method: POST" -D - https://api.khg-marketing.info/api/gateway | grep -i access-control-allow-origin
```
⚠️ `Access-Control-Allow-Origin: https://www.ie-miru.jp` が出ればよい。
```bash
curl -s https://api.khg-marketing.info/api/gateway -d "request=kengaku_cloud&roll=entry"
```
⚠️ `{"status":"error","message":"未入力項目があります"}` が返れば受け口がある（⚠️ 何も保存されない）。

## 手順4　GTM（別のエンジニア）
- `Downloads/gtm_reserve_send_v2.html` の内容で「予約内容の API 送信」のカスタム HTML を差し替える
  - 送信先 `https://api.khg-marketing.info/api/gateway`
  - 送信データに `request=kengaku_cloud`・`roll=entry`
  - `url_params` は localStorage の JSON 文字列のまま1項目で
- `gtm_reserve_save.html` は変更なし
- ⚠️ 差し替え後、見学クラウドでテスト予約 → 下の確認

## 手順5　【WSL】フロントを ① へアップロード
⚠️ 変わるのは画面の版（version.ts）だけ。`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）

## 手順6　【① phpMyAdmin】更新履歴
⚠️ ファイル: `backend/scripts/sql/2026-10-12_update_log_2.2.190.sql`

## 出したあとの確認
| # | 見ること | 期待 |
|---|---|---|
| 1 | 見学クラウドでテスト予約（URL に `?utm_source=test` を付けて流入） | inquiry_customer に `kengakucloud_YYYYMMDD_HHMMSS_mmm` の行。氏名・かな・店舗・キャンペーン・予約日・予約時間・LINE ID・url_params・utm_source（⚠️ 住所は保存しない。社内通知にだけ載る） |
| 2 | 社内通知 | marketing@kh-group.jp と店舗の Cc に `{店舗}/{キャンペーン}からの登録がありました。` |
| 3 | 反響一覧 → 同期 | 顧客に LINE ID・url_params が入る |
```sql
SELECT inquiry_id, shop, hp_campaign, reserved_date, reserved_time, line_id, url_params FROM inquiry_customer WHERE inquiry_id LIKE 'kengakucloud%' ORDER BY id DESC LIMIT 5;
```

## 切り戻し
| 対象 | 方法 |
|---|---|
| GTM | 元の `gtm_reserve_send.html` に戻す（⚠️ ① の旧 API へ送る形に戻る） |
| ② | v2.2.189 の production で `dcp build` / `up -d` |
