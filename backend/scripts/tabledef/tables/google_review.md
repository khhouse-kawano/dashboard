---
table: google_review
title: Google クチコミ
business: common
source: 改修
---
店舗ごとの Google クチコミの評価と本文。1店舗（Google マップの店舗）＝1行（約31行）。
取得は projects/sync（Places API）→ ② request google_review の save（features/googleReview.ts）。新しいクチコミだけを足し、評価が変わったときだけ推移に1点足す。
読むのは画面「口コミ集計」（header/review/GoogleReview.tsx。request google_review の summary）。sync は list で店舗と Place ID を取る。
⚠️ 行の追加は手作業（Place ID が分からないと取得できない）。save は INSERT しない。
⚠️ Places API は1回に最大5件しか返さないので、全件は持っていない（溜まった分だけ）。
⚠️ ① に PHP の処理は無い（転送に失敗したら 502）。

## 列
- no: 連番（画面・sync の並び順）
- shop: Google 上の店舗名（例「国分ハウジング 霧島店」）。画面で shop_list の表記に読み替える（googleReviewUtils.ts）
- id: Google の Place ID（save はこれで行を探す）
- address: 店舗の住所
- average: 平均評価（文字列）
- amount: クチコミの件数（文字列）
- recently_review: ためたクチコミ（JSON 配列 [{rating, date, text, name}]）。新しいものを後ろに足す。⚠️ 古い要素は name が無く、本文の改行が <br>
- review_history: 評価の推移（JSON 配列 [{date, amount, average}]）。画面では使っていない
- url: Google マップの店舗ページの URL
