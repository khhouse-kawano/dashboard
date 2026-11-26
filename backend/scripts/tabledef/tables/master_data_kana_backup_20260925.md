---
table: master_data_kana_backup_20260925
title: 顧客ふりがなの退避
business: order
source: 改修
copy_of: master_data
---
master_data（注文住宅の顧客）のふりがなをカタカナにそろえる前の写し（2026-09-25）。ひらがなを含んでいた顧客だけを id とふりがな①②で退避した。
作ったのは backend/scripts/sql/2026-09-25_kana_to_katakana.sql の手順2（Nexus へ移行するため、ふりがなをカタカナにした）。戻すときは同じファイルの戻し方の SQL で id を突き合わせる。
⚠️ 画面・処理からは使っていない（推定）。

## 列
- id:
- customer_contacts_name_kana: 変換前のふりがな①（ひらがなのまま）
- customer_contacts_name_kana_2: 変換前のふりがな②（ひらがなのまま）
