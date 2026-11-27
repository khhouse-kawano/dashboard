---
table: land_source
title: 土地仕入の反響ソース
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の反響ソース（土地の情報がどこから来たか）。⚠️ これから設定するための受け皿で、作った時点では空。
案件（land_deal.source_id）・アプローチ（land_approach.source_id）から指す。1行でも入ると、案件の画面に「反響ソース」の選択が出る。
読むところ：land_master。画面からの登録は v2.2.312 の「仕入設定」。

## 列
- id: 連番
- name: 反響ソースの名前
- kind: 種類（業者・ポータル・自社サイトなど。自由）
- memo: メモ
- sort: 並び順
- active: 1＝使う
- created_at: 登録日時
- updated_at: 最後に直した日時
