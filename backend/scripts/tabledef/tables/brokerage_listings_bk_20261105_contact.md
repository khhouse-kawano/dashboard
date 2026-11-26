---
table: brokerage_listings_bk_20261105_contact
title: 反響の電話・メールの控え（v2.2.251）
business: realty
source: 改修
copy_of: brokerage_listings
---
brokerage_listings（元の表）の、売り反響・買い反響（kind が leads・buyLeads）の phone・mail を連絡先（contact）から埋める前の写し（2026-11-05。v2.2.251）。
backend/scripts/sql/2026-11-05_realty_lead_contact_split.sql で作る。戻すときは同じファイルの末尾のコメントの UPDATE で internal_id を突き合わせる。
⚠️ 画面・処理からは使っていない（推定）。⚠️ 電話番号・メールアドレスを含む。

## 列
- internal_id: 元の表の internal_id（戻すときの突き合わせ）
- id:
- kind:
- phone: 埋める前の電話番号
- mail: 埋める前のメールアドレス
