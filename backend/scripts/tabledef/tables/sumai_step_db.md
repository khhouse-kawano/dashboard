---
table: sumai_step_db
title: すまいステップ 査定依頼の取り込み元
business: used
source: 改修
---
すまいステップ（売却査定サイト。中古住宅専門店）の査定依頼 CSV の生データ。1行が1件の依頼（管理番号 id）。
sync の runSumaiStep.ts が CSV を読み、1行ずつ ① の request sumai_step_update（handlers/sumai_step_update.php）へ送る。INSERT IGNORE なので、既にある管理番号は上書きしない。
そのあと portal/sumai_step.php が、その行を反響一覧（inquiry_customer_resale。`sumai_step_<id>`・区分「売り:ポータル」）と
不動産CRMの売却リード（brokerage_listings。extId `sumai:<管理番号>`）へ足す（どちらも INSERT だけ）。
⚠️ CSV の改行入りの欄で読み崩れた行が混ざることがある（id・date が欠けた行は下流に流さない）。
⚠️ 照合順序が brokerage_listings（utf8mb4_unicode_ci）と違う。比べるときは COLLATE を付ける。

## 列
- no: 連番（自動採番）
- id: 管理番号（すまいステップ側の番号）。重複を防ぐ鍵
- date: 反響日時（YYYY-MM-DD HH:MM:SS）。反響日・売却リードの受付日になる
- status: 状態（すまいステップ上の対応状況）
- shop: 担当店舗（すまいステップ上の値）
- estate: 物件種別（反響一覧の property に入る。売却リードでは 戸建／マンション／土地 に直す）
- category: 物件種別：その他
- estate_pref: 物件住所：都道府県
- estate_city: 物件住所：市区町村
- estate_town: 物件住所：町名
- estate_street: 物件住所：字/丁目以降
- estate_building: 物件住所：建物名
- estate_room: 物件住所：号室
- estate_situation: 物件にお住まい
- large_1: 専有面積
- large_2: 専有面積（単位）
- large_3: 延べ床面積
- large_4: 延べ床面積（単位）
- land_large_1: 土地面積
- land_large_2: 土地面積（単位）
- land_large_3: 築年
- plan: 間取り
- situation: 現在の状況
- relationship: 物件の関係
- rent: 賃料
- floor: 階数
- room: 戸数（部屋数）
- reason: 査定の理由（複数選択が区切り無しでつながる）
- reason_other: 査定の理由：その他
- method: 査定の方法
- period: 売却の希望時期（売却リードの timing に入る）
- opinion: ご要望・ご質問
- sei: 氏名 姓
- mei: 氏名 名（先頭に空白が入る行がある）
- sei_kana: フリガナ 姓
- mei_kana: フリガナ 名
- age: 年齢
- phone: 電話番号
- mail: メールアドレス
- zip: 郵便番号
- address_1: お住まいの住所：都道府県、市区町村、町名
- address_2: お住まいの住所：字/丁目以降
- address_3: お住まいの住所：建物名、号室
- phone_call: 通電（すまいステップ上の記録）
- visit: 訪問（すまいステップ上の記録）
- medium: 媒介（すまいステップ上の記録）
- report: 査定書（売却リードの note に「査定書:」で入る）
- remarks: CSV の全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）
