---
table: land_deal
title: 土地仕入の仕入案件
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜。移行元は仕入KPI管理 v7.3）の仕入案件。1行が1件の土地の情報。
書くところ：② features/landAcquisition の land:deal_save・land:deal_delete、移行元の取り込み land:import（importLegacy.ts）。
読むところ：仕入案件一覧（LandDeals.tsx。② land_deal_list）、仕入ダッシュボード（land_summary。実績の数え方は logic.ts の computeActual）、業者の画面（land_vendor_get）。
⚠️ 買付の上限額・坪単価は保存しない（logic.ts の simMaxOffer・tsuboUnitOf で毎回計算する）。
⚠️ ステータスを変えると、空いている日付に今日が入る（logic.ts の applyStatus。買付なら返答期日＝買付日＋既定の日数）。
⚠️ 消すのは delete_flag = 1。

## 列
- id: 連番
- legacy_id: 移行元の id（取り込んだ行だけ）
- member_id: 担当者（land_member.id）
- kind: 案件種別（新規開拓・既存持込）
- vendor_id: 情報取得元の業者（land_vendor.id）
- vendor_name: 業者名（業者マスタの名前を変えると、そろえて書き換える）
- address: 物件所在地
- map_url: 地図の URL（空なら画面が所在地から作る）
- lots: 区画数。契約日が入ると「仕入区画」に数える
- land_m2: 土地面積（㎡）
- price: 想定仕入価格（万円）
- seller_name: 売主名
- agent_name: 媒介業者名
- buy_price: 購入金額（仕入金額・万円）。坪単価は、これが無ければ想定仕入価格で計算する
- terms: 契約条件（land_option の deal_terms）
- terms_memo: 契約条件の補足
- status: ステータス（情報取得・社長提案・買付・契約・決済完了・見送り）。並び順が工程の順
- info_date: 情報取得日。「情報取得」の実績の月
- prop_date: 社長提案日
- offer_date: 買付日
- contract_date: 契約日（現場）
- settle_date: 決済日（ゴール）。決済完了の区画は業者の買取実績に足す
- memo: 概要メモ
- sim_sales: 事業収支の想定総販売価格（万円）
- sim_build: 想定建築費（万円）
- sim_demolition: 予想解体・造成費（万円）
- sim_expense_rate: 諸経費率（%。既定5）
- sim_profit_rate: 目標利益率（%。既定15）
- offer_to: 買付提出先（返答をもらう相手）
- reply_due: 買付の返答期日。返答待ち（買付で返答結果が空）のアラートに使う
- reply_result: 返答結果（承諾・否決・保留・再交渉。空は返答待ち）
- reply_date: 回答日
- reply_memo: 返答メモ
- lost_reason: 失注理由（land_option の lost_reason）。見送り・否決の案件で集計する
- lost_memo: 失注の詳細メモ
- ap_id: 発生元のアプローチ（land_approach.id）。そのアプローチの情報取得数から、案件の数を引いて数える
- source_id: 反響ソース（land_source.id。これから設定）
- delete_flag: 削除の印（1＝削除）
- created_by: 登録した人（Dashboard のスタッフ名。移行元の行は移行元の担当者名）
- updated_by: 最後に直した人
- created_at: 登録日時
- updated_at: 最後に直した日時
