# デプロイ手順 v2.2.213　公開フォームの受け皿（② が落ちたとき）と DJH 会員登録のお礼メール

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 受け皿 `campaign_form.php`（roll: public / entry。② の campaign_form の予備） | ① PHP `backend/src/handlers/campaign_form.php`（新規） |
| 2 | 各ブランドサイトの `form/api/index.php` の転送先を ① のゲートウェイへ付け替え | ⚠️ **8サイト**（各ブランドサイトのサーバー）。`backend/scripts/brand_form_api/index.php` |
| 3 | DJH 会員登録のお礼メールにログイン情報を入れる | ① DB（phpMyAdmin）`backend/scripts/sql/2026-10-23_djh_member_thanks_mail.sql` |
| 4 | 版の表示（2.2.213） | ① フロント（ビルドしてアップロード。いつもの手順） |
| 5 | 更新履歴 | ① DB `backend/scripts/sql/2026-10-23_update_log_2.2.213.sql` |

- ⚠️ ② VPS の変更は**なし**（再ビルド不要）。`express_proxy.php` の変更も**なし**。
- ⚠️ ふだん（② が動いている間）の動きは変わらない。1・2 は ② が落ちたときだけ使われる。

## 順序
```
0. GitHub で v2.2.213 を main → production へマージ
1. ① PHP（campaign_form.php）
2. 8サイトの form/api/index.php   ← ⚠️ 1 の後（先に付け替えると、受け皿が無くて 404 になる）
3. ① SQL（DJH 会員登録のお礼メール）   ← いつでもよい（⚠️ すぐ効く）
4. ① フロント
5. ① SQL（更新履歴）
```

## 手順1　【① FTP】受け皿
アップロード（`/dashboard/api/gateway/` の下）:
- `handlers/campaign_form.php`（新規）

確認（フォームの設定の読み込み。保存はしない。表示の記録が1行入る）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"campaign_form","roll":"public","brand":"djh","campaign_id":"20240000_djh_kyotsu_member"}'
```
⚠️ `"status":"success"` とフォームの設定が返ればよい。⚠️ `mail_to` / `mail_cc` が**含まれていない**こと。

## 手順2　【8サイト FTP】form/api/index.php
`backend/scripts/brand_form_api/index.php` を、次の8か所の `form/api/index.php` に**上書き**する。
1. ⚠️ 上書きの前に、今のファイルを手元に残す（戻すとき用。8つとも同じ中身のはず）。
2. アップロード先:
   - https://kh-house.jp/form/api/
   - https://day-just-house.com/form/api/
   - https://www.nagomi-koumuten.jp/form/api/
   - https://furukomi-home.com/form/api/
   - https://2lhome.net/form/api/
   - https://miyazaki.pg-house.jp/form/api/
   - https://jusfy-home.com/form/api/
   - https://kh-house.jp/khg/form/api/

確認（各サイト。保存はしない）:
```bash
curl -s -X POST https://kh-house.jp/form/api/ -H 'Content-Type: application/json' -H 'Authorization: form_get' -d '{"brand":"kh","campaign_id":"存在しないID"}'
```
⚠️ `{"status":"empty","data":null}` が返ればよい（① の受け皿まで届いている）。
- `Unknown Authorization` → ヘッダの値の打ち間違い
- `通信エラーが発生しました`（502）→ そのサイトのサーバーから ① へ届いていない
- `該当する処理がありません`（404）→ 手順1 が済んでいない

## 手順3　【① phpMyAdmin】DJH 会員登録のお礼メール
ファイル: `backend/scripts/sql/2026-10-23_djh_member_thanks_mail.sql`
1. ⚠️ 最初の SELECT の結果（今の `thanks_subject` / `thanks_body`）を控える（戻すとき用）。
2. UPDATE が **1行** 変わること。
3. 最後の SELECT で `thanks` が `1`、件名と本文が入っていること。
4. デイジャストハウスの会員登録フォームから自分のアドレスで1回登録し、お礼メールに「ユーザー名」「パスワード」が入っていることを確かめる。
   - ⚠️ 反響一覧に入った自分のテスト登録は消しておく。

## 手順4　【① フロント】
いつもの手順でビルドしてアップロード（版の表示が 2.2.213 になる）。

## 手順5　【① phpMyAdmin】更新履歴
ファイル: `backend/scripts/sql/2026-10-23_update_log_2.2.213.sql`
