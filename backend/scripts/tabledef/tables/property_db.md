---
table: property_db
title: 物件DB（いえらぶの物件）
business: common
source: 改修
---
いえらぶ（物件管理システム）の物件一覧の写し。1行＝物件1つ（property_id＝いえらぶの6桁の物件番号。UNIQUE）。建売（株式会社 国分ハウジング不動産 本店）と中古（国分ハウジンググループ中古住宅専門店）の物件が1つの表に入る（store_name で分ける）。
書くもの：
- いえらぶの CSV の取り込み（② realty/ieloveImport.ts。不動産企画係の「設定・データ管理」。v2.2.260〜）。物件番号で上書きし、価格が変わったら price_raw に足す。以前は sync が毎日 ① property_db_update.php へ送っていた（PHP は残っている）。
- ポータルのデータで補う（② propertyPortal.ts。request property_db_portal。v2.2.301）。⚠️ 空の列だけ埋め、無い物件は作る（docs/property-db-portal.md）。
- 経緯度（① customer_address.php が lat_lng を入れる）。
読むもの：物件DB（DatabaseProperty.tsx）・物件の詳細（PropertySummary.tsx）・SUUMO物件サマリー（② propertyGet.ts。v2.2.301 から GET）、顧客の編集の物件の選択肢（② information/index.ts）、媒介獲得台帳とのつなぎ（② realty/ieloveMatch.ts）。
⚠️ 「契約済み」の物件は「その店舗の最新の取得日（registered）でない物件」（最新の取り込みで無くなった物件）。⚠️ registered を今日にして行を作ると、ほかの物件がすべて契約済みに見える。
⚠️ いえらぶの番号が無い行を作らない（取り込みが property_id で上書きするので二重になる）。
⚠️ store_name は全角の空白を含めて1文字も違わないこと（画面は空白を消して比べる）。ローカルには「株式会社国分ハウジング不動産」（本店の付かない古い表記）の行もあり、建売・中古のどちらの画面にも出ない（推定）。

## 列
- no: 連番（自動採番）
- property_id: 物件番号（いえらぶの6桁）。⚠️ UNIQUE。ポータルの管理番号（SUUMO の management_no・HOME'S の company_management_number・at home の management_no の下6桁）と結ぶ
- management_code: 管理コード
- store_name: 担当店舗名（株式会社　国分ハウジング不動産　本店＝建売／国分ハウジンググループ中古住宅専門店＝中古）
- property_staff: 物件担当者。画面の「担当」の絞り込み
- transaction_type: 取引態様（例 仲介・専属専任媒介・専任媒介・一般媒介）
- property_type: 物件種別（例 新築一戸建て・中古一戸建て・売地・中古マンション）
- address: 所在地
- property_name: 物件名（「(公開)」などが付く。顧客の問い合わせ物件 property_name と突き合わせる）
- room_number: 空き物件内容（部屋番号）
- land_area: 土地面積
- building_area: 建物面積（例「壁芯67.99㎡」）
- layout: 間取り
- building_age: 築年数（いえらぶは「1978年12月」のような建築年月）
- price: 価格（例「900万円」）
- gross_yield: 表面利回り
- transportation: 交通1（例「路線「駅」駅 徒歩5分」）
- agency: 取扱業者。画面の「取扱」「自社物件を表示」の絞り込み
- staff_in_charge: 担当者（取扱業者の担当）
- tel: 電話番号（取扱業者）
- report_date: 活動報告日
- next_report_date: 活動報告予定日
- expected_yield: 想定利回り
- total_units: 総戸数・総区画数
- structure: 建物構造
- zoning: 用途地域
- zoning_2: 用途地域2
- seller: 売主
- owner: 所有者
- price_raw: 価格の履歴（JSON 配列 [{"date":"YYYY/MM/DD","value":"円"}]）。取り込みで価格が変わったときだけ足す
- investment_type: 実需・投資
- expiry_date: 掲載期限
- publishing_instruction: 物件掲載指示（掲載先。例「HOME'S/SUUMO/アットホーム/いえらぶポータル/汎用連動」）
- internal_note: 社内用メモ１
- registered: 取得日（yyyy/mm/dd。取り込んだ日）。⚠️ 契約済みの判定に使う
- lat_lng: 経緯度（「緯度,経度」）。① customer_address.php が入れる。物件の詳細の地図
