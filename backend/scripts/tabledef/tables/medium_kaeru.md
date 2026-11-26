---
table: medium_kaeru
title: 建売の販促媒体
business: spec
source: 改修
---
建売の販促媒体（反響媒体）の選択肢。1行＝媒体1つ（例 SUUMO・HOME'S・Instagram・Web検索・アットホーム・公式LINE・その他）。
読むもの：建売の反響一覧・顧客の編集・顧客DB・販促媒体別動向（CustomerKaeru・CustomerTrendKaeru）・店舗別（ShopKaeru）・地図・予算シミュレーター・② analysis/trendMedium.ts など（多くは SELECT * の全件）。
⚠️ 建売の顧客の販促媒体（master_data_kaeru.sales_promotion_name）はこの表の名前が正。別名（Youtube→YouTube など）は customerKaeruUtils.ts の normalizeMedium が寄せる。
⚠️ 注文の medium_list と違い list_medium・response_medium の列は無い（画面で絞らない）。
⚠️ 画面からの追加・編集は無い（推定）。媒体を増やすときは SQL で入れる。

## 列
- no: 連番（自動採番）。並び順にも使う
- medium: 媒体名。⚠️ ALLGRIT は「公式LINE」、at home は「アットホーム」で登録されている（画面の表示だけ差し替える）
- show_graph: グラフ表示。1＝販促媒体別動向の表の行・グラフの系列と予算シミュレーターに単独で出す（2026-09-11 追加。SUUMO・HOME'S・アットホーム・公式LINE など）
