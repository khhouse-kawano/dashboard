---
table: land_vendor
title: 土地仕入の業者マスタ
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の業者マスタ。土地の情報をくれる不動産業者・工務店など。1行が1社。
書くところ：② land:vendor_save・land:vendor_delete、案件・アプローチの保存（名前が無ければ作る。ensureVendor）、取り込み land:import。
読むところ：業者マスタ（LandVendors.tsx。② land_vendor_list・land_vendor_get）、案件・アプローチの業者名の候補。
⚠️ 買取実績 ＝ buy_count（手入力）＋ 決済完了の案件の区画数（land_deal から毎回数える）。
⚠️ 消すのは delete_flag = 1（案件・アプローチの業者名は残る）。

## 列
- id: 連番
- legacy_id: 移行元の id（取り込んだ行だけ）
- name: 業者名
- vkind: 区分（land_option の vendor_kind）
- contact: 先方の担当者名
- tel: 電話番号
- email: メールアドレス
- area: 業者のエリア（自由に書く）
- addr: 住所
- url: ホームページ・参照 URL
- owner_member_id: 社内担当（land_member.id）
- vendor_rank: ランク（A＝最重要〜E＝実績なし）
- temp: 温度感（◎〇△✕）
- last_visit: 最終訪問日（手入力）。最終接触はこれとアプローチの最後の日の新しいほう
- buy_count: 買取数（手入力・過去の実績）
- memo: メモ
- delete_flag: 削除の印（1＝業者マスタから外した）
- created_by: 登録した人
- updated_by: 最後に直した人
- created_at: 登録日時
- updated_at: 最後に直した日時
