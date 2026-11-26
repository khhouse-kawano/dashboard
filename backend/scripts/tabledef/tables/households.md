---
table: households
title: 市区町村別の世帯数
business: common
source: 改修
---
国勢調査の一般世帯数（全国の市区町村）。1行＝1地域（pref・area の組で一意）。市況分析（Market）のエリア詳細で使う。
取り込みは backend-express/scripts/import-households-csv.mjs（households_all.csv）。読むのは ① market_area.php、建売の取り込み（import-kaeru-csv.mjs）が市区町村名の照合に使う。
2026-08-27 に全国版へ作り直した（backend-express/scripts/sql/2026-08-27_households.sql。前の表は households_backup_20260827）。
⚠️ 市区町村名の書き方が表ごとに違う（政令市の区など。① core/market.php の冒頭）。

## 列
- no: 連番（自動採番）
- pref: 都道府県名
- area: 市区町村名。県全域は "-"
- year: 調査年。元データに無いため空
- amount: 一般世帯総数
- one_person: 単独世帯
- more_two_people: 2人以上の世帯
- live_together: 間借り・同居など
