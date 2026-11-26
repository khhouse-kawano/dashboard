---
table: athome_summary_db
title: at home 掲載物件のサマリー
business: common
source: 改修
---
at home に掲載している自社物件の集計（PV・反響数など）。1行が1物件（management_no）。
sync の summary の処理（runAtHomeSummary）が ① の request athome_db_summary（handlers/athome_db_summary.php）へ、集計期間（start_date・end_date）を付けて送り、management_no で上書き（ON DUPLICATE KEY UPDATE）する。
同じ行を ② の property_db_portal（features/propertyPortal.ts）にも送り、物件DB（property_db）の空の列を埋める（docs/property-db-portal.md）。
画面は物件DB（DatabaseProperty.tsx）・物件のサマリー（PropertySummary.tsx）。② の property_list / property_detail が management_no の末尾6桁 ＝ property_db.property_id で結ぶ。
⚠️ 期間ごとに積み上げず、最後に送った期間の値で上書きする。⚠️ アカウントの列が無い。建売と中古の物件が1つの表に混ざる。

## 列
- id: システム用主キー
- management_no: 管理番号（355050000＋いえらぶの6桁の物件番号）。上書きの鍵
- property_no: 物件番号（at home の番号。いえらぶの番号とは関係しない）
- property_type: 物件種目（例 新築売戸建住宅・中古売戸建住宅・売地）
- building_name: 建物名
- address: 所在地
- line_station: 沿線／駅
- price_man_yen: 金額（万円）
- published_date: 公開日
- floor_plan_flg: 間取図有無
- photo_count: 物件写真数
- pv_pc: 詳細PV（ATPC）
- pv_sp: 詳細PV（ATスマートフォン）
- pv_mobile: 詳細PV（ATケータイ）
- pv_total: 詳細PV（合計）
- inquiry_pc: 反響（ATPC）
- inquiry_sp: 反響（ATスマートフォン）
- inquiry_mobile: 反響（ATケータイ）
- inquiry_call: 反響（無料通話）
- inquiry_line: 反響（LINE）
- inquiry_total: 反響（合計）
- favorite_count: お気に入り登録
- movie_play_count: パノラマ・フォトムービー再生回数
- secondary_ad_auto: 2次広告自動公開物件
- created_at: レコード作成日時
- updated_at: レコード更新日時
- start_date: 集計開始日（sync が送る）
- end_date: 集計終了日（sync が送る）
