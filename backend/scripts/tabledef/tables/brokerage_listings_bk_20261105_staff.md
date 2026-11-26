---
table: brokerage_listings_bk_20261105_staff
title: 担当者の表記そろえの控え（v2.2.252）
business: realty
source: 改修
copy_of: brokerage_listings
---
brokerage_listings（元の表）の担当者の表記を「空白なしの氏名」にそろえたときの、直した行の直す前・後の値（2026-11-05。v2.2.252）。
backend/scripts/sql/2026-11-05_realty_staff_name_unify.sql で作り、この表の _new の値で元の表を直した。戻すときは同じファイルの末尾のコメントの UPDATE で _old に戻す。
⚠️ 画面・処理からは使っていない（推定）。⚠️ SQL のコメントに「消さない」とある。

## 列
- internal_id: 元の表の internal_id（主キー）
- kind: 元の表の kind（ローカルでは ledger だけ）
- staff_old: 直す前の担当（staff）。略称や空白入りの氏名
- staff_new: 直した後の担当
- sub_old: 直す前の協同担当（subStaff）
- sub_new: 直した後の協同担当
- sell_old: 直す前の販売担当（sellStaff）
- sell_new: 直した後の販売担当
