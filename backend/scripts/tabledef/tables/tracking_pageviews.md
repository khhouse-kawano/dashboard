---
table: tracking_pageviews
title: アクセス解析のページ閲覧
business: common
source: 改修
---
タグを貼ったサイトのページ閲覧1回＝1行（v2.2.203）。約50万行。
書くのは ② の公開の受け口（tracker.js がページを開くたびに POST /api/track/pv。features/tracking/pageview.ts）。
読むのは「反響管理 → アクセス解析」と、顧客情報の「HP閲覧履歴」（request customer_pageviews。information/CustomerPageviews.tsx）。
⚠️ 上限 50万行（maintenance.ts の PAGEVIEW_CAP）を超えると、6時間ごとの整理で tracking_keep_visitors に無い顧客の古い行から消す。
⚠️ URL は ? 以降を保存しない（個人を特定できる値が入ることがあるため）。

## 列
- id: 連番
- site_id: tracking_sites.id
- visitor_id: 顧客ID（khg_vid）
- visit_id: 訪問ID（30分以内の移動は同じ）
- url: 見たページ（? 以降を除く）
- title: ページのタイトル
- prev_url: 同じ訪問のひとつ前のページ（訪問の最初のページは NULL）
- created_at: 閲覧した日時
