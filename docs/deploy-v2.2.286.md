# デプロイ手順 v2.2.286　オーナーズハウスの見学予約：管理店舗の反響に・フォームとメールの見直し

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 見学予約の受け付けで、本文の house_id から物件（ownershouse）を引き、inquiry_customer の店舗を**物件の管理店舗**（略称。例 KH霧島店）にする。ブランド・見学先・種別も物件の値を使う。通知メールの件名に管理店舗、本文に種別・物件・物件ページ・流入（url_params / landing_params）。サンクスメールにお問い合わせ先の店舗 | ② VPS（features/ownersHouse/reservation.ts） |
| 2 | ② が落ちたときの予備（① で受ける）も同じ | ① PHP `backend/src/handlers/owners_house_reservation.php` |
| 3 | 見学予約フォームを form_get の公開フォームと同じ見た目に（入力 → 確認 → 完了。エラーは各欄の下） | kh-house.jp/owners_house/（react/owners_house の dist） |
| 4 | 更新履歴1行 | ① DB `backend/scripts/sql/2026-11-20_update_log_2.2.286.sql` |

- ⚠️ v2.2.285 までを先に済ませてください。表の変更はありません。
- 反響の送り先は今までどおりです：② `owners_house_reservation` → ② に届かなければ kh-house.jp の `/form/api/`（Authorization: owners_house_reservation）→ ① の `owners_house_reservation.php`。
- 物件を引けないとき（house_id が無い古い画面など）は、今までどおり画面が送った店舗を使います。⚠️ ②・① を先に上げても古いサイトのままで動きます。

## 順序
```
1. GitHub で v2.2.286 を production へマージ（PR）
2. ② VPS
3. ① PHP 1ファイル
4. ① SQL：2026-11-20_update_log_2.2.286.sql   ← ⚠️ 1回だけ
5. owners_house を build してアップロード
```
- Dashboard の画面（フロント）の変更は版の数字（version.ts）だけです。いつもどおり build してアップロードしてください。

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
- `git log` が v2.2.286 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順3　【① PHP】
`backend/src/handlers/owners_house_reservation.php` を ① の同じ場所へアップロードします（上書き）。

### 手順4　【① SQL】
```bash
mysql < 2026-11-20_update_log_2.2.286.sql
```

### 手順5　【owners_house】
```bash
cd react/owners_house
npm run build
```
`dist` の中身を kh-house.jp の `owners_house/` へアップロードします。
- 変えたファイル：`src/components/ReservationForm.tsx`（新規）、`src/components/publicForm.css`（新規。form_get の写し）、`src/components/Owners.tsx`

## 終わったら（動作確認）
- 物件ページの下の予約フォームが、form_get と同じ見た目（入力 → 確認 → 完了）で出る。
- 試しに予約すると（⚠️ 本番の反響になるので、テストと分かる名前で送り、あとで反響一覧から消してください）：
  - 反響一覧（注文）に、物件の管理店舗（例 KH霧島店）の反響として入る。
  - 通知メールの件名に管理店舗が入り、本文に物件・物件ページ・流入が出る。
  - サンクスメールに、お問い合わせ先の店舗が出る。

## 切り戻し
owners_house を前の build に戻すとフォームは前の見た目に戻ります。② と ① PHP は、house_id が無ければ前と同じ動きなので戻さなくて構いません。
