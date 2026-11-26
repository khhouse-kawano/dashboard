---
table: column_definition
title: テーブル定義書（列）
business: common
source: 改修
---
テーブル定義書の列ごとの説明（v2.2.301）。1列＝1行（テーブル名＋列名）。
原稿は table_definition と同じ（tables/<テーブル名>.md の「## 列」）。⚠️ 原稿に無い列の説明は、SQL を流すと消える（原稿が正）。
⚠️ 列の説明に、お客様の名前・電話・住所などの実際の値を書かない。

## 列
- table_name: テーブル名
- column_name: 列名（テーブル名と合わせて主キー）
- description: 列の説明
- source: 出典（改修 / 推論）
- updated_version: 説明を最後に直した版（説明・出典が変わったときだけ上がる）
- updated_at: 説明を最後に直した日時
