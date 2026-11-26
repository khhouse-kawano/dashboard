---
table: medium_list
title: 販促媒体マスタ
business: common
source: 改修
---
反響の媒体・販促媒体の一覧。1行が1媒体（SUUMO・HOME'S・かえる-資料請求 など）。
反響一覧・顧客・反響推移・予算シミュレーター・架電状況・経理の予算画面（① budget_accounting.php）・市況分析（① market_master.php）が、媒体の選択肢と表の行の並びに読む。注文の行の並びは `response_medium = 0 AND list_medium = 1` を sort_key 順。
⚠️ 書き込む画面は無い（手で入れている。推定）。
⚠️ 建売の反響の媒体名はこの表とほとんど一致しない（建売は medium_kaeru 側）。

## 列
- id: 連番
- medium: 媒体名。budget.medium・反響の medium と同じ表記
- category: 分類（ポータル / 印刷物 / CM/ラジオ / 看板 / 紹介 など）。空の行が多い
- sort_key: 並び順（小さいほど上）
- response_medium: 1 = 反響媒体（看板・建築現場を見て など）。広告費の表は 0 の行を使う
- list_medium: 1 = 注文の反響推移などの表に行として出す
- ma_medium: 1 = 市況分析（market_master）の媒体の選択肢に出す。経理の予算画面も振り分けに使う
- resale_portal_medium [推論]: （推定）中古（リセール）のポータル媒体の印。読む処理なし
- resale_medium [推論]: （推定）中古（リセール）の媒体の印。読む処理なし
- sell_portal_medium [推論]: （推定）売却のポータル媒体の印。読む処理なし
- ma_category: 市況分析での分類（ポータル / SNS/WEB / チラシ/DM / 看板 など）。medium をまとめた単位
