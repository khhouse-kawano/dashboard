---
table: staff_shop_bk_227
title: 担当事業の控え（v2.2.227）
business: common
source: 改修
copy_of: staff
---
staff（ログイン権限）の担当事業（shop）を estate に差し替えたときの控え（v2.2.227・2026-10-29。backend/scripts/sql/2026-10-29_staff_shop_estate.sql）。対象の人の id・氏名・差し替え前の担当事業だけを持つ。
v2.2.228 で estate をやめ、2026-10-29_staff_shop_estate_cleanup.sql がこの控えから元の担当事業へ戻した。
⚠️ 画面・処理からは使っていない（推定）。戻し用の SQL（_restore / _cleanup）だけが読む。

## 列
- id: staff.id
- name:
- shop: 差し替える前の担当事業（spec / used など）
