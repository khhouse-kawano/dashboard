# デプロイ手順 v2.2.207（事前アンケートの作り直し：7ブランドの HTML を1ファイルに・回答を ② が直接登録）

⚠️ v2.2.206 は main にマージ済み。このブランチは main から切ってある。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | before_survey を utf8mb4 に・列のコメント・「1年以上前から3」を「1年以上前から」に直す（298件） | ① DB |
| 2 | 事前アンケートの受け口 `before_survey_entry`（保存・通知メール）・送信回数の上限 | ⚠️ **② VPS（再ビルド）** |
| 3 | 7ブランドの事前アンケートの画面を新しい1ファイルに置き換える | ① FTP（`/survey_kh/` など7か所） |
| 4 | GAS の Pre_survey を止める | ⚠️ Google Apps Script |
| 5 | 画面の版 | ① フロント（dashboard） |
| 6 | 更新履歴 | ① DB |

- ⚠️ `.env.prod` の変更は**なし**（② は https://khg-marketing.info からの送信を許可済み。2026-10-22 に本番の ② で確認）。
- ⚠️ `express_proxy.php` の変更も**なし**（アンケートの画面はブラウザから ② へ直接送る。① の PHP を通らない）。

## 順序
```
0. GitHub で v2.2.207 を main → production へマージ
1. ① DB：2026-10-22_before_survey.sql
2. ② 再ビルド                     ← ⚠️ 1 の後（絵文字入りの回答が utf8mb3 の表に入ると失敗する）
3. ① FTP：アンケートの画面を7か所   ← ⚠️ 2 の後（先に置くと送信が「該当する処理がありません」になる）
4. GAS の Pre_survey のトリガーを止める ← ⚠️ 3 と同時（3 の直後）
5. ① フロント
6. ① SQL（更新履歴）
```
- ⚠️⚠️ **4 を忘れないこと。** 通知メールの件名は今と同じ（【KH共通】事前アンケートへの回答がありました。）なので、Gmail のラベル「事前アンケート」が付き、GAS が読み取って**二重に登録する**（しかも本文の形が違うので、ほとんど空の行が入る）。
- ⚠️ 3 の前に送られた回答は、今までどおり GAS 経由で入る。3 と 4 の間（数分）に送られた回答は、古いページを開いたままの人なら GAS 経由・新しいページなら ② 経由で、どちらも1件ずつ入る（二重にはならない）。

## 手順1　【① phpMyAdmin】before_survey
ファイル: `backend/scripts/sql/2026-10-22_before_survey.sql`（何度流しても安全）
- 最後の `SHOW FULL COLUMNS` で、Collation が `utf8mb4_general_ci`・Comment に質問文が入っていればよい
- 最後の集計で `1年以上前から3` が無くなっていればよい

## 手順2　【② VPS で実行】Express の再ビルド
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
ls backend-express/src/features/beforeSurvey/entry.ts
```
⚠️ ファイル名が出れば v2.2.207 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```
確認（中身が空の送信。保存されない）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"before_survey_entry","brand":"xx"}'
```
⚠️ `アンケートの種類が分かりません` が返ればよい（`該当する処理がありません` なら再ビルドが反映されていない）。

## 手順3　【① FTP】アンケートの画面（7か所）
⚠️ 置き換える前に、各ディレクトリの今のファイルを手元に退避しておく（`Downloads/survey` に5つ分の写しあり。jh・2l は無いので先に取る）。

上書きする: `backend/forms/survey/index.html` を、次の7か所の `index.html` に**同じファイルのまま**置く（ブランドはディレクトリ名で決まる）。
```
/survey_kh/index.html
/survey_djh/index.html
/survey_jh/index.html
/survey_pg/index.html
/survey_2l/index.html
/survey_nagomi/index.html
/survey_fh/index.html
```
消す（またはファイル名の先頭に `_old_` を付ける）: 各ディレクトリの `confirm.php`・`thanks.php`・`style.css`
- ⚠️ `confirm.php`・`thanks.php` を残すと、古いページを開いたままの人の送信がそのまま GAS 経由で入り続ける（手順4で GAS を止めると、その分は**どこにも入らなくなる**）。消して PHP を減らす。

確認（ブラウザで）:
- https://khg-marketing.info/survey_kh/ を開き、ロゴ・色が国分ハウジングになっている
- 何も入れずに「入力内容の確認」→ 必須の欄に赤い文字が出る
- ⚠️ 実際の送信は手順4のあとに、社内のテスト用のメールアドレスで1回だけ（下の「確認」）

## 手順4　【GAS】Pre_survey のトリガーを止める
Google Apps Script のプロジェクト（事前アンケートの取り込み）で「トリガー」→ `Pre_survey` を削除する。
- ⚠️ 関数そのものは消さなくてよい（戻すときにトリガーを作り直すだけで済む）。

## 手順5　【WSL】フロントを ① へアップロード
`npm run build` → `deploy-dashboard`（⚠️ index.html も差し替える）
- ローカルのビルド結果: `main.c615b8f1.js`（画面の版だけの変更）
- ⚠️ `/dashboard/funding-plan/金利データ.js`（手で置いたもの）がデプロイ後も残っているか確認すること

## 手順6　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-22_update_log_2.2.207.sql`
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

## 確認（手順4のあと）
1. https://khg-marketing.info/survey_kh/ で、社内のテスト用のメールアドレスを使って最後まで送る → 「送信が完了しました」
2. 通知メールが kh の宛先（mkt@kh-house.jp ほか）に届く
3. ① phpMyAdmin:
```sql
SELECT id, brand, dateStr, name, emailAddress, sync FROM before_survey ORDER BY id DESC LIMIT 3;
```
4. ⚠️ 確認が終わったらテストの行を消す（`DELETE FROM before_survey WHERE id = <テストの id>;`）
5. 翌日、GAS が動いていない（同じ回答が2行になっていない）ことを確認する

## ⚠️ 要確認
- JUSFY HOME（jh）・ニーエルホーム（2l）の通知先。thanks.php の写しが無かったので、`mkt@kh-house.jp` と GAS の宛先（jh@kh-group.jp・2lhome@kh-group.jp）にしてある。違う場合は `backend-express/src/features/beforeSurvey/questions.ts` の BRANDS を直して ② を再ビルドする。
- 送信回数の上限は、ほかの公開フォームと同じ「同じ IP から10分で5件」。展示場の Wi-Fi で何組も続けて回答する使い方がある場合は知らせてください。
