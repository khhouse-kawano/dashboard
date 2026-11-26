---
table: tracking_touches
title: アクセス解析の着地（広告流入）
business: common
source: 改修
---
広告などのパラメータ付きでサイトに着地した1回＝1行（v2.2.199）。数十万行ある。
書くのは ② の公開の受け口（tracker.js → POST /api/track/touch。features/tracking/touch.ts）。
読むのは「反響管理 → アクセス解析」（summary・detail・vendors など）と、反響ごとの流入の一覧（request tracking_touches。list/TrackingTouches.tsx）。
反響とは inquiry_customer.landing_params の khg_vid（無ければ gclid などのクリックID）で結ぶ。外部キーは無い。
⚠️ 整理の処理（maintenance.ts）は、この表は消さない。
⚠️ IP は保存しない（ip_hash だけ）。

## 列
- id: 連番
- site_id: tracking_sites.id
- visitor_id: ブラウザの localStorage の khg_vid（UUID）
- source: 流入元（フォームと同じ決め方：utm_source → Facebook/Instagram → Google → Yahoo → Flyer）
- gclid: Google 広告のクリックID
- gbraid: Google 広告のクリックID（iOS アプリ向け）
- wbraid: Google 広告のクリックID（iOS ウェブ向け）
- fbclid: Meta（Facebook・Instagram）のクリックID
- yclid: Yahoo! 広告のクリックID
- gad_source: Google 広告が付けるパラメータ gad_source
- gad_campaignid: Google 広告のキャンペーンID（gad_campaignid）
- utm_source: utm_source
- utm_medium: utm_medium
- utm_campaign: utm_campaign
- utm_term: utm_term
- utm_content: utm_content。⚠️ Meta 広告では広告ID（meta_ad_items.ad_id）が入る
- flyer: チラシの識別（URL パラメータ flyer）
- landing_url: 着地したページ（? 以降を除く）
- referrer: 参照元
- user_agent: ブラウザの User-Agent
- ip_hash: IP は保存しない。SHA-256（ソルト付き）
- created_at: 着地した日時
