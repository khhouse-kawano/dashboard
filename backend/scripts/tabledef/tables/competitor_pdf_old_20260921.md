---
table: competitor_pdf_old_20260921
title: 他社資料の旧形式の控え（2026-09-21）
business: common
source: 改修
copy_of: competitor_pdf
---
competitor_pdf（元の表）を1ファイル1行に作り替える前の、旧形式（顧客1人1行）の写し（2026-09-21。backend/scripts/sql/2026-09-21_competitor_pdf_one_row_per_file.sql）。戻すときはこの表を rename する。
⚠️ 画面・処理からは使っていない（推定）。⚠️ 列の形が元の表と違う。

## 列
- no: 連番
- id: master_data.id（顧客ごとに1行。PDF の無い空の行がほとんど）
- pdf_path: その顧客の PDF の JSON 配列 [{"name","path","staff"}]
