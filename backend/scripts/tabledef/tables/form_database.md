---
table: form_database
title: キャンペーンフォームのブランド既定値
business: common
source: 改修
---
キャンペーンフォームのブランドごとの既定値。1ブランド＝1行（nagomi・kh・djh・2l・fh・pg・jh・khg）。
画面「キャンペーン」で新しいフォームを作るとき、この行の値をひな型にする（request campaign_form の master。② features/campaignForm/index.ts）。
項目の列の形は form_table と同じ（JSON の文字列）。
⚠️ メール文面（thanks_subject など）の列は無い。新規は常に空＝既定の文面。

## 列
- id: 連番
- brand: ブランドキー（form_table.brand と同じ）
- mail_to: 社内通知メールの宛先の既定
- mail_cc: 社内通知メールの Cc の既定
- thanks: サンクスメールを送るかの既定（1＝送る）
- redirect: 送信後の完了ページの既定
- notice: フォーム画面の「注意書き」の既定（JSON）
- shop: 項目「店舗」の設定と選択肢の既定（JSON）
- date: 項目「来場希望日・時間」の既定（JSON）
- name: 項目「お名前」の既定（JSON）
- kana: 項目「ふりがな」の既定（JSON）
- age: 項目「年代」の既定（JSON）
- phone: 項目「電話番号」の既定（JSON）
- mail: 項目「メールアドレス」の既定（JSON）
- line_id: 項目「LINE ID」の既定（JSON。2026-10-12 追加）
- address: 項目「住所」の既定（JSON）
- medium: 項目「お問い合わせのきっかけ」の既定（JSON）
- question: 項目「ご要望・ご質問」の既定（JSON）
- attention: 注意事項の既定（JSON）
- color_code [推論]: （推定）フォームの色（例 #956134）。⚠️ 今はどのブランドも同じ値
- img_code [推論]: （推定）フォームに出すロゴ画像の URL。⚠️ form_table に列が無いので新規フォームには引き継がれない
