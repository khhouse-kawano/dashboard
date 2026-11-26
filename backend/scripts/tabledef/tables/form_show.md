---
table: form_show
title: キャンペーンフォームの表示記録
business: common
source: 改修
---
公開のキャンペーンフォームが表示された1回＝1行。数十万行ある。
書くのはフォームの初期表示（form_get。② features/campaignForm/entry.ts の runCampaignFormPublic、① handlers/campaign_form.php）。失敗してもフォームは出す。
⚠️ このリポジトリで読む処理は無い（推定：form_cv と合わせて表示→送信の率を見る外部の集計用）。
⚠️ brand・campaign には外から送られた値がそのまま入るので、脆弱性スキャンの文字列（SQL インジェクションの試しなど）の行が混じっている。集計するときは form_table の brand で絞る。
⚠️ time の形が古い行（YYYY-MM-DD）と新しい行（YYYY/MM/DD）で違う。

## 列
- no: 連番
- time: 表示日時（文字列）
- brand: 送られてきたブランド（kh・djh・pg・nagomi・jh・2l・khg など）
- campaign: キャンペーンID（form_table.campaign_id）
- url: フォームのあったページの URL
- source: 流入元
- campaign_name: キャンペーン名
