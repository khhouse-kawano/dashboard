---
table: building_yearly
title: 建築着工（年次）
business: common
source: 改修
---
国の建築着工統計の新設住宅の戸数（年次）。1行が「1市区町村（または県全域）× 1年」。e-Stat の統計表 0003114522（2011〜）から取り込む（backend-express/scripts/import-estat-building-yearly.mjs。表は 2026-08-27_building_yearly.sql）。
市況分析の「月次／年次」の切り替えの年次側と、経年比較に使う。
⚠️ (areaCode, year) が一意。再取り込みは UPSERT。⚠️ ローカルの写しは 6県・2011〜2024 年。

## 列
- id: 連番
- pref: 都道府県名
- area: 市区町村名。県全域は building と同じく "-"
- areaCode: e-Stat の地域コード（例 46201=鹿児島市）。市町村合併があっても追える
- year: 西暦
- amount: 新設住宅 合計戸数
- owner: 持家。注文住宅のシェアの分母
- rent: 貸家
- employer: 給与住宅
- condominiums: 分譲住宅。建売のシェアの分母
