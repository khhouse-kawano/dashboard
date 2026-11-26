---
table: form_cv
title: キャンペーンフォームの送信記録
business: common
source: 改修
---
キャンペーンフォームが送信された1回＝1行（コンバージョンの記録）。
書くのは公開フォームの送信の処理（② features/campaignForm/entry.ts・estimate/entry.ts、① handlers/campaign_form.php・estimate_entry.php）。失敗しても反響の保存は止めない。
⚠️ このリポジトリで読む処理は無い（推定：外部の集計用）。お客様の情報は持たない。

## 列
- no: 連番
- brand: 送られてきたブランド（kh・djh・pg・jh・2l・khg・なごみ など。⚠️ 公開フォームが送る値のままで、form_table.brand と違うことがある）
- time: 送信日時（文字列）
- campaignName: キャンペーン名
- campaignId: キャンペーンID（form_table.campaign_id）
- url: フォームのあったページの URL
- source: 流入元（meta・google・flyer・ig・yahoo など。空も多い）
