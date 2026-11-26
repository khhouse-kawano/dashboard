---
table: information
title: 旧お知らせ
business: common
source: 推論
---
（推定）旧版のお知らせ（社内向けの掲示）。1件＝1行。登録は 2025-03 〜 2025-05 の12件で、半分ほどはテストの行。
コードからの使用箇所なし（推定：home/informaiton.php が SELECT * で読むが、接続先は別の DB（owners_house）で dashboard の画面からは使っていない）。
⚠️ コードの request information（顧客情報）はこの表とは関係ない。

## 列
- id: 連番
- date: （推定）掲示日（YYYY/MM/DD の文字列）
- title: （推定）お知らせの見出し
- content: （推定）お知らせの本文
- poster: （推定）投稿者（部署・名前）
- img_1: （推定）画像1
- img_2: （推定）画像2
- img_3: （推定）画像3
- img_4: （推定）画像4
- list: （推定）一覧に出すか（1＝出す）。⚠️ 今は全行 0
