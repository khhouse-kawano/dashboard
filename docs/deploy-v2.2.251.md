# デプロイ手順 v2.2.251　不動産企画係：売り反響・買い反響の電話番号・メールアドレス

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 今ある反響の電話番号・メールアドレスを、連絡先の欄から入れる（入っている値は変えない） | ① DB `backend/scripts/sql/2026-11-05_realty_lead_contact_split.sql` |
| 2 | 以前のアプリのデータを取り込み直すときも、連絡先から電話番号・メールアドレスを入れる | ② VPS（backend-express） |
| 3 | 版の番号 | ① フロント |
| 4 | 更新履歴 | ① DB `backend/scripts/sql/2026-11-05_update_log_2.2.251.sql` |

- ⚠️ **① の PHP、`projects/sync`、GAS は変わりません。**
- 1 の SQL は、② やフロントの前後どちらに流してもかまいません。

## 順序
```
0. GitHub で v2.2.251 を production へマージ（PR）。⚠️ v2.2.250 までのマージが先
1. ① SQL：2026-11-05_realty_lead_contact_split.sql   ← 何回流しても同じ
2. ② VPS（backend-express）を更新して再起動
3. ① フロント（v2.2.251 のブランチでビルドしたもの）
4. ① SQL：2026-11-05_update_log_2.2.251.sql          ← ⚠️ 1回だけ
```

### 手順1　【① SQL】電話番号・メールアドレスを入れる
phpMyAdmin で `2026-11-05_realty_lead_contact_split.sql` を流します。
- 最初に、直す前の値を控えの表 `brokerage_listings_bk_20261105_contact` に残します。
- 安全更新モード（ERROR 1175）でも通ることを、ローカルで確かめてあります。
- 確認（後）の見方
  - 「電話を入れられる」「メールを入れられる」が 0 なら済みです。
  - 「連絡先も無い」は、取り込み元にも連絡先が無い反響です。取り戻せません。
  - 「連絡先はあるが電話の形でない」は、桁が足りないなどの理由で電話を入れなかった反響です。必要なら画面で直してください。
  - 電話番号・メールアドレスそのものは、画面に出しません（件数だけ）。
- ローカル（本番の写し）での結果
  - 売り反響：電話の空 894件 → 15件、メールの空 894件 → 59件
  - 買い反響：電話の空 187件 → 21件、メールの空 182件 → 17件
- 問題が無ければ、しばらくしてから控えの表を消します（SQL の最後のコメントの `DROP TABLE`）。

### 手順2　【② VPS】backend-express を更新
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
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"planner","roll":"import_records"}'
```
- `認証が必要です。`（401）ならよいです。

### 手順3　【① フロント】いつもの手順
⚠️ v2.2.251 のブランチで `npm run build` をし直してから上げてください。

### 手順4　【① SQL】
phpMyAdmin で `2026-11-05_update_log_2.2.251.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.251 で、1行だけならよいです。

## 終わったら（動作確認）
1. 「売り反響」「買い反響」の一覧の「連絡先」の欄に、電話番号とメールアドレスが出る
2. 反響の編集画面の「連絡先(電話)」「連絡先(メール)」に値が入っている
3. 版の表示が ver2.2.251

## 注意
- 電話番号は数字だけで入ります（ハイフン無し）。もともと入っていた値（sync や画面から入ったもの）は変えません。
- 先頭の0が落ちた携帯番号（「9012345678」の形）は、0を足して入れます。ローカルでは37件ありました。

## 切り戻し
- データ：SQL の最後のコメントの「戻すとき」の UPDATE を流す（控えの表から戻ります）
- ② を v2.2.250 に戻しても問題ありません（取り込み直しで電話・メールを入れなくなるだけです）
