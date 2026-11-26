---
table: form_table_bk_20261105_attention
title: キャンペーンフォームの注意事項の控え（2026-11-05）
business: common
source: 改修
copy_of: form_table
---
form_table（元の表）の brand = 'kh' の attention を、佐賀店の特典の注記を消す前に控えた写し（2026-11-05。backend/scripts/sql/2026-11-05_form_table_kh_remove_saga_note.sql）。
戻すときは id で form_table と結んで attention を書き戻す（SQL ファイルの末尾）。
⚠️ 画面・処理からは使っていない（推定）。戻す必要が無くなったら消してよい。

## 列
- id:
- brand:
- attention:
