---
table: households_c
title: 世帯数の内訳（建て方・家族類型）
business: common
source: 改修
---
国勢調査の一般世帯数を、住宅の建て方と家族類型で分けたもの（全国の市区町村）。1行＝1地域×1建て方（pref・area・type の組で一意）。市況分析（Market）の世帯構成のグラフで使う。
取り込みは backend-express/scripts/import-households-c-csv.mjs（households_c_all.csv）。読むのは ① market_area.php。
2026-08-27 に全国版へ作り直した（backend-express/scripts/sql/2026-08-27_households_c.sql。前の表は households_c_backup_20260827）。
⚠️ 同じ地域・建て方が二重に入るとグラフが倍になる。UNIQUE キーで止めている。

## 列
- no: 連番（自動採番）
- pref: 都道府県名
- area: 市区町村名。県全域は households と同じく "-"
- type: 住宅の建て方（総数/一戸建/長屋建/共同住宅/その他）
- amount: 一般世帯数
- one_person_under65 [推論]: （推定）65歳未満の単身（30歳未満＋30〜64歳の合計）。⚠️ 画面のグラフでは使わない（足すと二重に数える）
- one_person_under30: 30歳未満 単身
- one_person_30_64: 30〜64歳 単身
- one_person_over65: 65歳以上 単身
- wife_husband: 夫婦のみ
- wife_husband_over65: 夫婦のみ（65歳以上）
- wife_husband_child_under3: 夫婦＋子（0〜2歳）
- wife_husband_child_3_5: 夫婦＋子（3〜5歳）
- wife_husband_child_6_9: 夫婦＋子（6〜9歳）
- wife_husband_child_10_17: 夫婦＋子（10〜17歳）
- wife_husband_child_18_24: 夫婦＋子（18〜24歳）
- wife_husband_child_over25: 夫婦＋子（25歳以上）
