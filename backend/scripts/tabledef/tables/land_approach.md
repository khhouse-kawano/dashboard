---
table: land_approach
title: 土地仕入のアプローチ
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の、業者へのアプローチ（訪問・架電など）を1件ずつ記録したもの。1行が1回。
書くところ：② land:approach_save・land:approach_delete（日次・アプローチ LandDaily.tsx）、取り込み land:import。
読むところ：日次・アプローチ（land_approach_list・land_daily）、仕入ダッシュボード（業者AP・情報取得の実績、案件化待ち）、業者の画面。
⚠️ 業者AP ＝ この表の件数 ＋ まとめ入力（land_daily_count）。⚠️ 情報取得には info_count から、このアプローチから作った案件の数を引いて足す。
⚠️ 消すのは delete_flag = 1。

## 列
- id: 連番
- legacy_id: 移行元の id（取り込んだ行だけ）
- ap_date: 日付
- ap_time: 時刻（任意。HH:MM）
- member_id: 担当者（land_member.id）
- vendor_id: 業者（land_vendor.id）
- vendor_name: 業者名
- ap_type: 種別（訪問・架電・受電・メール・FAX・直案件・業者持込）。まとめ入力の列と対応する
- contact: 訪問先・架電先の担当者名
- reaction: 反応・感触（land_option の reaction）
- info_count: このアプローチで得た土地情報の件数
- memo: 取得情報（売主の事情・価格感・条件など）
- address: 物件所在地（任意）
- map_url: 地図の URL
- land_m2: 土地面積（㎡・任意）
- is_candidate: 案件候補（1＝案件化待ちに出す。案件にすると外れる）。直案件・業者持込は既定で1
- source_id: 反響ソース（land_source.id。これから設定）
- delete_flag: 削除の印（1＝削除）
- created_by: 記録した人
- updated_by: 最後に直した人
- created_at: 登録日時
- updated_at: 最後に直した日時
