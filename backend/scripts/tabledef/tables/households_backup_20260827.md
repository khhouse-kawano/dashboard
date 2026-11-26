---
table: households_backup_20260827
title: 世帯数の退避（2026-08-27）
business: common
source: 改修
copy_of: households
---
households（市区町村別の世帯数）を全国版に作り直す前の写し（2026-08-27）。5県分で、同じ地域が新旧2世代入っていた（year が空のまま積まれていた）。
作ったのは backend-express/scripts/sql/2026-08-27_households.sql（RENAME で退避）。
⚠️ 画面・処理からは使っていない（推定）。

## 列
- no:
- pref:
- area: 市区町村名。⚠️ 古い世代は県全域の行が「-」ではなく県名
- year:
- amount:
- one_person:
- more_two_people:
- live_together:
