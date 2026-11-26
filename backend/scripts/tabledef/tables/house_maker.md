---
table: house_maker
title: 住宅会社（他社）の名簿
business: common
source: 改修
---
競合の住宅会社の名前の一覧（約380社）。顧客情報の「競合他社」の入力や他社資料の社名のサジェストに使う。
読むのは顧客情報（information の order・spec・used。SELECT *）、競合の集計（competitor.ts・analysis/competitor.ts）、他社資料（competitorPdf.ts）。書き込む処理は無い（手で足す）。
⚠️ 自社グループの社名（国分ハウジングなど）も入っている。競合の集計では外して別の欄に出す（analysis/competitor.ts の OWN_GROUP_NAMES）。

## 列
- no: 連番
- label: 社名（表示名）
- letter: 検索用の読み（ひらがな・カタカナ・ローマ字をつなげた文字列）。サジェストの並び順にも使う
