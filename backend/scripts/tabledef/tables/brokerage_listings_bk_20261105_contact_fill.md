---
table: brokerage_listings_bk_20261105_contact_fill
title: 反響の連絡先の控え（v2.2.252）
business: realty
source: 改修
copy_of: brokerage_listings
---
brokerage_listings（元の表）の、売り反響・買い反響の空の連絡先（contact）を「電話 / メール」で埋める前の写し（2026-11-05。v2.2.252）。直した行だけが入る。
backend/scripts/sql/2026-11-05_realty_lead_contact_fill.sql で作る。
⚠️ 画面・処理からは使っていない（推定）。⚠️ ローカルでは 0 件（埋める行が無かった）。

## 列
- internal_id: 元の表の internal_id（戻すときの突き合わせ）
- id:
- kind:
- contact: 埋める前の連絡先（空）
