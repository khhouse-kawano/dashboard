---
table: form_table
title: キャンペーンフォームの設定
business: common
source: 改修
---
キャンペーンフォーム（イベント予約・資料請求などの公開フォーム）の設定。1フォーム＝1行（brand＋campaign_id で引く）。
登録・更新は画面「キャンペーン」（NewCampaign.tsx・FormBuilder.tsx。request campaign_form の list / detail / insert / update。② features/campaignForm/index.ts）。
公開フォームの表示（form_get）と送信（form_register）は ① の khg-marketing.info/api/ と ② campaignForm/entry.ts が brand＋campaign_id でこの表を読み、通知先・サンクスメールの可否・文面もここから決める（送られてきた値は使わない）。
⚠️ brand はローマ字（nagomi など）。公開フォームが送る brand（かな・khg など）とは違うので、brands.ts で読み替える。
⚠️ 項目の列（notice〜medium・line_id）は JSON の文字列（CHECK json_valid 付き）。{bool: 聞くか, required: 必須か, …} の形。空文字を入れると保存ごと失敗する。
⚠️ 公開済みのフォームが ① の API を直接呼んでいるので、行を消したり brand・campaign_id を変えたりすると反響が止まる。

## 列
- id: 連番
- registered_date: 登録日（YYYY/MM/DD の文字列）
- campaign: キャンペーン名（フォームの見出し・反響のキャンペーン名）
- campaign_id: キャンペーンID（brand と組で1フォームを決める）
- url: フォームを置くページの URL
- tag: 埋め込み用のタグ（iframe）。⚠️ フォーム作成画面が作る HTML 版とは別物
- brand: ブランドキー（kh・djh・nagomi・2l・fh・pg・jh・khg）
- mail_to: 社内通知メールの宛先
- mail_cc: 社内通知メールの Cc（khg の共通フォームは店舗別の Cc で上書き。entry.ts の KHG_CC）
- redirect: 送信後に移る完了ページの URL
- thanks: お客様へのサンクスメールを送るか（1＝送る）
- notice: フォーム画面の「注意書き」（JSON）。⚠️ 社内通知メールではない
- name: 項目「お名前」の設定（JSON。姓・名をまとめる）
- kana: 項目「ふりがな」の設定（JSON。せい・めいをまとめる）
- age: 項目「年代」の設定（JSON）
- phone: 項目「電話番号」の設定（JSON）
- mail: 項目「メールアドレス」の設定（JSON）
- line_id: 項目「LINE ID」の設定（JSON。2026-10-12 追加）。送られてこなければ今の値のまま
- address: 項目「住所」の設定（JSON。郵便番号〜番地をまとめる）
- question: 項目「ご要望・ご質問」の設定（JSON）
- attention: フォームの注意事項（JSON。text_red などに改行区切りの文言）
- shop: 項目「店舗」の設定と選択肢（JSON）
- date: 項目「来場希望日・時間」の設定と選択肢（JSON）
- medium: 項目「お問い合わせのきっかけ」の設定と選択肢（JSON。YouTube を足したのは 2026-10-05）
- thanks_subject: サンクスメールの件名。空なら既定（mailTemplate.ts）
- thanks_body: サンクスメールの本文。空なら既定
- internal_subject: 社内通知メールの件名。空なら既定
- internal_body: 社内通知メールの本文。空なら既定
