# デプロイ手順 v2.2.209（会員登録の取り込みを ② へ・KH久留米店・退会の除外・① の予備）

⚠️ v2.2.207 は main にマージ済み。このブランチは main から切ってある（v2.2.208 は使っていない）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 会員登録の取り込みの受け口 `member_entry`（合い言葉つき） | ⚠️ **② VPS（.env.prod に MEMBER_ENTRY_KEY を足して再ビルド）** |
| 2 | ② に届かないときの予備 `member_entry.php`・① から ② への転送 | ① PHP `backend/src/handlers/member_entry.php`（新規）・`backend/src/core/express_proxy.php` ＋ ⚠️ **① の .htaccess（SetEnv MEMBER_ENTRY_KEY）** |
| 3 | GAS の MEMBERtoDashboard を差し替える | ⚠️ Google Apps Script（スクリプト プロパティ MEMBER_ENTRY_KEY） |
| 4 | 古い受け口 `api/member.php` を止める | ① FTP（GAS の確認が済んでから） |
| 5 | 画面の版 | ① フロント |
| 6 | 更新履歴 | ① DB |

- ⚠️ **合い言葉は ② ・ ① ・ GAS の3か所で同じ値**にする。どれかが違うと、その経路は 401（合い言葉が違います）になり、取り込まれない。
- ⚠️ 合い言葉の値はリポジトリ・チャット・手順書に書かない。

## 順序
```
0. GitHub で v2.2.209 を main → production へマージ
   （合い言葉を1つ作っておく。例: WSL で openssl rand -hex 24。値は画面に残さない）
1. ② .env.prod に MEMBER_ENTRY_KEY → 再ビルド
2. ① .htaccess に SetEnv MEMBER_ENTRY_KEY → ① PHP（member_entry.php・express_proxy.php）   ← ⚠️ 1 の後
3. GAS：スクリプト プロパティ → コードを差し替え → 手で1回実行                          ← ⚠️ 1・2 の後
4. ① api/member.php を止める                                                               ← ⚠️ 3 の確認の後
5. ① フロント
6. ① SQL（更新履歴）
```
- ⚠️ 1・2 を済ませる前に 3 をすると、合い言葉が無い・受け口が無いため取り込まれない（GAS のログに 401／該当する処理がありません が出る）。
- ⚠️ 3 まで終われば、GAS が止まっていた間の会員登録も入る（GAS は過去2日分のメールを毎回読む。取り込み済みのものは「登録済み」で飛ばす）。

## 手順1　【② VPS で実行】合い言葉・再ビルド
`.env.prod` に1行足す（値は手順0で作ったもの）:
```
MEMBER_ENTRY_KEY=<合い言葉>
```
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/memberEntry/entry.ts
```
⚠️ ファイル名が出れば v2.2.209 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認（合い言葉なし。保存されない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"member_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。
```bash
dcp exec express-api sh -c 'test -n "$MEMBER_ENTRY_KEY" && echo SET || echo EMPTY'
```
⚠️ `SET` が出ればよい（値は出さない）。

## 手順2　【① FTP】合い言葉・PHP
1. ① の `.htaccess` のうち、`SetEnv KSNAP_OWNER_KEY` が書いてあるファイルの同じ並びに1行足す（⚠️ 場所は KSNAP_OWNER_KEY と同じ。`backend/.env` 方式で入れているならそちらに `MEMBER_ENTRY_KEY=<合い言葉>`）:
```
SetEnv MEMBER_ENTRY_KEY <合い言葉>
```
2. アップロードする2ファイル（`/dashboard/api/gateway/` の下）:
- `handlers/member_entry.php`（新規）
- `core/express_proxy.php`（`expressProxyRequests()` に `member_entry` を1行足した）

確認（合い言葉なし）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"member_entry"}'
```
⚠️ `合い言葉が違います。` が返ればよい（① から ② へ届いている）。`該当する処理がありません` なら member_entry.php が置けていない。

⚠️ 切り戻し: express_proxy.php の `'member_entry',` の行を消して上書きすると、① の PHP だけで受ける。

## 手順3　【GAS】MEMBERtoDashboard の差し替え
今の会員登録の GAS（関数 `MEMBERtoDashboard` があるプロジェクト）で:
1. ⚠️ **今のコードを全部コピーして手元に残す**（戻すとき用）。
2. 「プロジェクトの設定」→「スクリプト プロパティ」→ `MEMBER_ENTRY_KEY` に合い言葉を入れて保存。
3. コードを `backend/scripts/gas/MEMBERtoDashboard.gs` の中身に**丸ごと**置き換えて保存。
   - ⚠️ トリガーはそのまま（関数名は以前と同じ `MEMBERtoDashboard`）。
   - ⚠️ ライブラリ「Parser」は使わなくなった。消さなくても動く。
4. エディタで `MEMBERtoDashboard` を選んで「実行」→「実行ログ」を見る:
   - `② 200 homepage… : {"status":"exists",…}` … 取り込み済み（以前の GAS が入れたもの）。⚠️ 過去2日分はほとんどこれになる
   - `② 200 … {"status":"success",…}` … 新しく入った
   - `送らない（退会の通知）` など … 送らなかったメールと理由
   - ⚠️ `② 401` → 合い言葉が ② と違う／`MEMBER_ENTRY_KEY が未設定` → 2 をやり直す
   - ⚠️ `① …` の行が出たら ② に届いていない（② のログを確認）
5. Dashboard の反響一覧で、新しく入った会員登録の店舗・住所・郵便番号・知ったきっかけを確認する。

⚠️ 切り戻し: 1 で残したコードに戻す（スクリプト プロパティは残してよい）。⚠️ その場合は手順4（member.php を止める）をしないこと。

## 手順4　【① FTP】古い受け口 api/member.php を止める
⚠️ 手順3 の確認が済んでから。⚠️ **誰でも反響を書き込める口なので、残さない。**
- `https://khg-marketing.info/api/member.php` のファイル名の先頭に `_old_` を付ける（1週間問題なければ消す）。
- ⚠️ ほかの GAS やフォームがこの URL を使っていないか、念のためサーバーのアクセスログで手順3の後に member.php への POST が来ていないことを確かめてから。

## 手順5　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.e02894ce.js` / `main.b8a7c60b.css`（画面の版だけの変更）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順6　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-22_update_log_2.2.209.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

## 確認（翌日）
① phpMyAdmin:
```sql
SELECT inquiry_id, response_medium, brand, shop, zip, LEFT(building, 20) AS addr, duplicate
FROM inquiry_customer
WHERE inquiry_id LIKE 'homepage%' AND hp_campaign LIKE '%会員登録' AND inquiry_date >= '2026/10/23'
ORDER BY id DESC LIMIT 20;
```
- 店舗が「◯◯店舗未設定」ばかりになっていない／福岡県の住所が KH久留米店 になっている
- 中身が空の行が無い

## ⚠️ 要確認
- 退会の通知は「件名か本文の最初の行に『退会』を含むメール」として飛ばしている。実際の退会メールの文面が違えば知らせてください。
- 2L は県外の住所でも 2L鹿児島店（以前の GAS と同じ）。KH・なごみ・JH は表に無い住所なら「◯◯店舗未設定」。
- GATEWAY_REQUIRE_AUTH を true にすると member_entry も止まる（GAS はスタッフのトークンを持たない）。
