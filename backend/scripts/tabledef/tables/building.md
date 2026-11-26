---
table: building
title: 建築着工（月次）
business: common
source: 改修
---
国の建築着工統計の新設住宅の戸数（月次）。1行が「1市区町村 × 1か月」。全都道府県。
市況分析（① core/market.php・market_area.php。画面は frontend/src/components/market/）が、注文（持家）・建売（分譲住宅）のシェアの分母に使う。
作り直しは backend-express/scripts/sql/2026-08-27_building_monthly.sql（旧の表は building_backup_20260827 に退避）。
⚠️ e-Stat の API に月次 × 市区町村 × 利用関係別の表が無いので、受け取った CSV で入れ替える。
⚠️ (pref, area, year) は一意にならない（政令市の同名の区があるため、UNIQUE を張らない）。経年比較は年次の building_yearly を使う。

## 列
- no: 連番
- pref: 都道府県名
- area: 市区町村名。郡・区の行も含む
- year: "YYYY/MM"（列名は year だが月）。API は 'YYYY-MM' に直して返す
- amount: 新設住宅 合計戸数
- owner: 持家。注文住宅のシェアの分母
- rent: 貸家
- employer: 給与住宅
- condominiums: 分譲住宅。建売のシェアの分母
