---
table: meta_ad_items
title: Meta 広告（自社）の一覧
business: common
source: 改修
---
自社の Meta 広告の一覧（v2.2.203）。1広告＝1行（主キー ad_id）。
書くのは ② features/metaAds/importer.ts（Graph API の {アカウント}/ads。自動の scheduler.ts と画面のボタン request meta_ads_import）。取り込むたびに上書きする。
読むのは「反響管理 → アクセス解析」の詳細（features/tracking/detail.ts。日別の数字は meta_ad_daily と ad_id で結ぶ）。
⚠️ ad_id は tracking_touches.utm_content（URL パラメータ {{ad.id}}）と同じ値。
⚠️ 他社広告ライブラリ（meta_ads）とは別物。

## 列
- ad_id: Meta の広告ID（主キー）
- brand: ブランドキー（META_AD_ACCOUNTS の左側。tracking_sites.brand と同じ。kh・djh・nagomi・pg・khf など）
- campaign_id: キャンペーンID
- campaign_name: キャンペーン名
- adset_id: 広告セットID
- adset_name: 広告セット名
- ad_name: 広告名
- status: effective_status（ACTIVE・PAUSED・ADSET_PAUSED・WITH_ISSUES など）
- thumbnail_url: サムネイルの URL。⚠️ 数日で期限が切れる。取り込みのたびに上書き
- image_url: 画像の URL（creative.image_url）
- imported_at: 最後に取り込んだ日時（アクセス解析の設定画面に「最終取り込み」として出す）
