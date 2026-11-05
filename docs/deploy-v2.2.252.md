# デプロイ手順 v2.2.252　不動産企画係：反響の連絡先を電話・メールに合わせる

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 連絡先が空の反響に「電話 / メール」を入れる（入っている連絡先は変えない） | ① DB `backend/scripts/sql/2026-11-05_realty_lead_contact_fill.sql` |
| 2 | 売り反響・買い反響の電話・メールを画面で登録・変更したとき、連絡先も作り直す | ② VPS（backend-express） |
| 3 | 架電キュー・架電ナビの電話番号を「連絡先(電話)」から先に読む／版の番号 | ① フロント |
| 4 | 更新履歴・業務ガイドの記事 | ① DB `backend/scripts/sql/2026-11-05_update_log_2.2.252.sql` |

- ⚠️ **① の PHP、`projects/sync`、GAS は変わりません。**
- ② の新しい request はありません（`express_proxy.php` の変更なし）。

## 順序
```
0. GitHub で v2.2.252 を production へマージ（PR）
1. ② VPS（backend-express）を更新して再起動
2. ① SQL：2026-11-05_realty_lead_contact_fill.sql   ← 何回流しても同じ。② の後に流す
3. ① フロント（v2.2.252 のブランチでビルドしたもの）
4. ① SQL：2026-11-05_update_log_2.2.252.sql          ← ⚠️ 1回だけ
```
- 1 → 2 の順にするのは、② を上げる前に画面から登録された反響も、2 の SQL で埋めるためです。

### 手順1　【② VPS】backend-express を更新
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認（トークンなし。② に直接）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"broker","roll":"update","id":"x","data":{}}'
```
- `認証が必要です。`（401）ならよいです。

### 手順2　【① SQL】空の連絡先を埋める
phpMyAdmin で `2026-11-05_realty_lead_contact_fill.sql` を流します。
- 最初に、直す行の直す前の値を控えの表 `brokerage_listings_bk_20261105_contact_fill` に残します。
- 安全更新モード（ERROR 1175）でも通ることを、ローカルで確かめてあります。
- 確認（後）の「連絡先を埋められる」が 0 なら済みです。
- ローカル（本番の写し）では対象は 0 件でした。本番では、v2.2.247 のあとに画面から登録した反響の数だけ埋まります。
- 電話番号・メールアドレスそのものは出しません（件数だけ）。
- 問題が無ければ、しばらくしてから控えの表を消します（SQL の最後のコメントの `DROP TABLE`）。

### 手順3　【① フロント】いつもの手順
⚠️ v2.2.252 のブランチで `npm run build` をし直してから上げてください。

### 手順4　【① SQL】
phpMyAdmin で `2026-11-05_update_log_2.2.252.sql` を **1回だけ**流します（更新履歴と業務ガイドの記事）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.252 で、1行だけならよいです。

## 終わったら（動作確認）
1. 売り反響の「反響を追加」で電話番号を入れて登録 → 一覧の「連絡先」に番号が出る
2. その反響の編集画面で電話番号を直して保存 → 一覧の「連絡先」も新しい番号になる
3. 今日の架電キューで、その反響に「☎ 番号」が出る（担当が自分の反響）
4. 版の表示が ver2.2.252

## 注意
- 連絡先を作り直すのは、電話番号かメールアドレスが**変わったとき**だけです。フェーズだけ変えて保存しても、以前のアプリから来た連絡先（2つ目の番号などの書き込み）は残ります。
- 台帳・商談などの連絡先は変えません（売り反響・買い反響だけ）。

## 切り戻し
- データ：SQL の最後のコメントの「戻すとき」の UPDATE を流す（埋めた連絡先を空に戻します）
- ② を v2.2.251 に戻しても問題ありません（連絡先を作り直さなくなるだけです）
- フロントを戻すと、架電キュー・架電ナビは連絡先だけから電話番号を読む動きに戻ります
