---
table: land_area
title: 土地仕入のエリア
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）のエリア（鹿児島都城・熊本・宮崎・大分）。担当者をエリアに分け、エリアごとに合算する。
書くところ：初期値（2026-11-27_land_acquisition_tables.sql）、取り込み land:import（移行元に無いエリア名は作る）。読むところ：land_master・land_summary。
⚠️ どのエリアにも入らない担当者（area_id が NULL）は「その他」。

## 列
- id: 連番
- name: エリア名（保存値。移行元の値と同じ）
- label: 表示名（空なら name。例 鹿児島（都城）エリア）
- sort: 並び順
- active: 1＝使う
- created_at: 登録日時
- updated_at: 最後に直した日時
