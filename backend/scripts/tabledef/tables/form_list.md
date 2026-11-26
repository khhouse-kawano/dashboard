---
table: form_list
title: 旧キャンペーンフォームの一覧
business: common
source: 推論
---
（推定）form_table より前のキャンペーンフォームの登録の一覧。1フォーム＝1行。登録日は 2024-11 〜 2025-09 で止まっている。
コードからの使用箇所なし（推定：旧版のフォーム管理の表。form_table に移った）。
⚠️ コードの「form_list」は ① の旧 API の Authorization の名前（一覧の処理）で、この表ではない。

## 列
- id: 連番
- campaign_name: キャンペーン名
- campaign_id: キャンペーンID
- day: 登録日（YYYY-MM-DD の文字列）
- url: フォームを置くページの URL
- brand: ブランドキー（kh・djh・nagomi・2l・fh・jh・pgh）
- campaign_to: （推定）社内通知メールの宛先
- campaign_cc: （推定）社内通知メールの Cc
- thanks: （推定）サンクスメールを送るか（1＝送る）
- redirect: （推定）送信後の完了ページの URL
- sns: （推定）SNS 用のバナー画像のパス（./banner/…）
- flyer: （推定）チラシ画像のパス（./flyer/…）
- landing: （推定）イベントの LP の URL
