# 2026-10-21 kyusyu.pg-house.jp の反響だけ landing_params・line_id が入らない（調査）

## 依頼
- 「https://kyusyu.pg-house.jp/ からの反響だけ landing_params や line_id が取得できない。つまり古い PHP に向いている。調べてほしい」
- 対象のページ：`/reservation/`・`/event/` 以下など

## 結論
**② の `CORS_ORIGINS`（VPS の `.env.prod`）に `https://kyusyu.pg-house.jp` が入っていない。** そのため、ブラウザが ② への送信を毎回止め、フォームが ① の旧 PHP（`https://miyazaki.pg-house.jp/form/api/`）へ送り直している。旧 PHP は landing_params・line_id を保存しない。

- PG のサイトは `miyazaki.pg-house.jp` から `kyusyu.pg-house.jp` へ移っている（`https://miyazaki.pg-house.jp/` は `https://kyusyu.pg-house.jp/` へ 301）。`CORS_ORIGINS` には旧ドメインの miyazaki だけが残っていた
- コードの不具合ではない。フォーム（form_get）は新しいビルドで、landing_params・line_id・url_params を送る処理が入っている

## 調べたこと
1. ページのフォーム
   - `/event/260919_kirishima_modelhouse/` と `/reservation/` は iframe で `/form/?id=…&brand=pg`（PG のサイト自身に置いた form_get のビルド。`/form/assets/index-BSyHZ808.js`）
   - このビルドは `landing_params`・`line_id`・`url_params` を含む
   - `/contact/` は WordPress の Contact Form 7（自社のフォームではない。今回の対象外）
2. フォームの送信の流れ（form_get の `src/api/gateway.ts`）
   - まず ② `https://api.khg-marketing.info/api/gateway` に送る
   - 失敗したら（CORS・タイムアウト・停止）① の各ブランドの `form/api/` に送り直す。PG は `https://miyazaki.pg-house.jp/form/api/`
3. 本番 ② の CORS（OPTIONS で確認）

| Origin | Access-Control-Allow-Origin |
|---|---|
| https://kyusyu.pg-house.jp | ⚠️ **付かない** |
| https://miyazaki.pg-house.jp | 付く |
| https://kh-house.jp・day-just-house.com・www.nagomi-koumuten.jp・2lhome.net・furukomi-home.com・jusfy-home.com | 付く |

   - www の有無の別名（www.kh-house.jp など）も許可は無いが、どれも正規のドメインへ 301 で転送されるので問題ない
4. 反響の記録（ローカルDB。2026-10-07 時点の inquiry_customer）
   - 2026-09-17（② へ移行）以降の PG のホームページ反響 25件は、すべて `inquiry_id` が `homepage…`（① の旧 PHP の採番）。② の採番 `form…` は0件。landing_params・line_id はすべて空

## 直し方（⚠️ ② VPS の手作業。コードの変更なし）
`.env.prod` の `CORS_ORIGINS` に `https://kyusyu.pg-house.jp` を足し、express-api を作り直す。miyazaki は残してよい。

## 変更したファイル
- なし（調査のみ。この記録だけ）
