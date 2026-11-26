---
table: lg_code
title: 地方公共団体コード
business: common
source: 改修
---
総務省の全国地方公共団体コードの一覧（R6.1.1 現在・1,794件）。1行が1つの都道府県または市区町村。v2.2.284 で作った（backend/scripts/sql/2026-11-18_update_log_2.2.284.sql）。
オーナーズハウスの管理画面（② ownersHouse/admin.ts）が市区町村の選択肢に読み、選んだ code を ownershouse.lg_code に入れる。
⚠️ 書き込む画面は無い。市町村の合併などで変わったら SQL で入れ直す。

## 列
- code: 団体コード（6桁。末尾は検査数字）
- pref_name: 都道府県名（例 鹿児島県）
- city_name: 市区町村名（例 霧島市）。都道府県そのものの行は空
- pref_short: 都道府県名から「都府県」を抜いた形（例 鹿児島。北海道はそのまま）。ownershouse.pref と同じ形
- city_short: 市区町村名から末尾の「市区町村」を抜いた形（例 霧島）。ownershouse.area と同じ形
