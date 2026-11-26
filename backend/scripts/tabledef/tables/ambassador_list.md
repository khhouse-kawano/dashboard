---
table: ambassador_list
title: Instagram アンバサダーの台帳
business: order
source: 改修
---
Instagram 公式アンバサダー（紹介してくれるお施主様など）の台帳。1人＝1行。
登録・更新・一覧は画面「アンバサダー」（header/ambassador/AmbassadorList.tsx。request ambassador_list・ambassador_kpi。② features/ambassador/）。① に PHP の処理は無い。
アンバサダー経由の反響は inquiry_ambassador（ambassador_no でこの表の no を指す）。反響数は列に持たず、inquiry_ambassador を数えて返す。

## 列
- no: 連番（inquiry_ambassador.ambassador_no から指す。⚠️ アカウント名ではなくこれで結ぶ）
- name: 氏名
- kana: ふりがな
- address: 住所
- mobile: 電話番号
- mail: メールアドレス
- account: インスタグラムアカウント
- shop: 担当店舗（KH出水阿久根店 など）
- staff: 担当営業
- remarks: 備考。[{date, note}] のJSON配列
- registered_at: 登録日
