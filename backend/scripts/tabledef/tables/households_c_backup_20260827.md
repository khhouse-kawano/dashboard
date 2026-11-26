---
table: households_c_backup_20260827
title: 世帯数内訳の退避（2026-08-27）
business: common
source: 改修
copy_of: households_c
---
households_c（世帯数の内訳）を全国版に作り直す前の写し（2026-08-27）。5県分。
作ったのは backend-express/scripts/sql/2026-08-27_households_c.sql（RENAME で退避）。
⚠️ 画面・処理からは使っていない（推定）。

## 列
- no:
- pref:
- area:
- type:
- delete_key: 全行 '00_総数' で意味を持っていなかった列（作り直しで落とした）
- amount:
- one_person_under65:
- one_person_under30:
- one_person_30_64:
- one_person_over65:
- wife_husband:
- wife_husband_over65:
- wife_husband_child_under3:
- wife_husband_child_3_5:
- wife_husband_child_6_9:
- wife_husband_child_10_17:
- wife_husband_child_18_24:
- wife_husband_child_over25:
