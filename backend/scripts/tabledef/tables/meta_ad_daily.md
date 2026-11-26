---
table: meta_ad_daily
title: Meta 広告（自社）の日別の数字
business: common
source: 改修
---
自社の Meta 広告の日別の表示回数・クリック・費用（v2.2.203）。1広告×1日＝1行（主キー ad_id, day）。
書くのは ② features/metaAds/importer.ts（insights level=ad・1日ごと）。取り込むたびに直近の日数分を上書きする。
読むのは「反響管理 → アクセス解析」の詳細（features/tracking/detail.ts。meta_ad_items と ad_id で結ぶ）。

## 列
- ad_id: Meta の広告ID（meta_ad_items.ad_id）
- day: 日付
- impressions: 表示回数
- clicks: リンクのクリック（inline_link_clicks）
- spend: 費用（円）
- imported_at: 取り込んだ日時
