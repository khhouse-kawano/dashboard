---
table: introductory
title: 紹介元の選択肢
business: common
source: 改修
---
顧客の「紹介元」の選択肢の一覧。1行が1つの選択肢（例 オーナー様・社員・家づくりヒーロー・SUUMOカウンター）。
読むところ：顧客情報の編集（InformationEdit.tsx・InformationEditKaeru.tsx・InformationEditResale.tsx）の紹介元の選択欄、顧客DB（注文。DatabaseOrder.tsx）の紹介元の絞り込み、架電状況の一覧（callStatusList）。② の information・database・callStatusList と ① の同名の PHP が `SELECT * FROM introductory` で返す。
⚠️ 画面からは足せない。選択肢を増やすときは DB に直接入れる（推定）。⚠️ 名前を変えると、すでに顧客に入っている値と合わなくなる。
お友達紹介キャンペーンの反響（inquiry_introductory）とは別物。

## 列
- no: 連番
- name: 選択肢の名前（画面にそのまま出る）
