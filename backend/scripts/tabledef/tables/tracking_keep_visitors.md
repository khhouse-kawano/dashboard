---
table: tracking_keep_visitors
title: 閲覧の記録を消さない顧客ID
business: common
source: 改修
---
tracking_pageviews の整理で消さない顧客ID（khg_vid）の一覧（v2.2.203）。1顧客ID＝1行。
書くのは ② features/tracking/maintenance.ts（起動の少しあとと6時間ごと）。反響（inquiry_customer・inquiry_customer_kaeru）と有効名簿（master_data・master_data_kaeru）の landing_params から khg_vid を拾って INSERT IGNORE する（MA 用）。
⚠️ 足すだけで消さない。⚠️ 手で直さない。

## 列
- visitor_id: 顧客ID（khg_vid。主キー）
- reason: cv（反響あり）／ master（有効名簿）。最初に入ったときの理由
- created_at: 登録日時
