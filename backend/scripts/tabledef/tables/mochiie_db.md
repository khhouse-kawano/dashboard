---
table: mochiie_db
title: 持ち家計画 反響の取り込み元
business: order
source: 推論
---
（推定）持ち家計画（注文住宅のポータル。DJH・Nagomi）の反響の生データ。1行が1件の反響。
コードからの使用箇所なし（推定：以前の取り込みスクリプト portal-app の reloadMochiie.js が書き、反響一覧 inquiry_customer に `mochiie<ID>` の行を足していた。docs/oldDocument/handover-portal-order.md では移植の対象外）。
登録は 2023/11〜2026/09/04 の457件。反響一覧には媒体「持ち家計画」の行が残っている。
⚠️ 取り込みが Dashboard・sync の外にある（推定）。止まっているかどうかは要確認。

## 列
- id: 連番（自動採番）
- id_mochiie: 持ち家計画の反響ID。反響一覧の inquiry_id は `mochiie` ＋この値
- sei_mochiie: 氏名の姓
- mei_mochiie: 氏名の名
- sei_kana_mochiie: 氏名の姓（カナ）
- mei_kana_mochiie: 氏名の名（カナ）
- gender_mochiie: 性別
- birth_mochiie: 生年月日
- age_mochiie: 年齢
- address_mochiie: 住所
- phone_mochiie: 電話番号
- mail_mochiie: メールアドレス
- job_mochiie: 職業
- estate_mochiie: （推定）土地の有無
- area_pref_mochiie: 建築予定地の都道府県
- area_city_mochiie: 建築予定地の市区町村
- family_mochiie: （推定）家族構成
- structure_mochiie: （推定）希望の構造・工法
- member_mochiie: （推定）入居予定人数
- plan_mochiie: （推定）希望間取り
- large_mochiie: （推定）希望の広さ
- budget_mochiie: 予算
- demand_mochiie: （推定）ご要望
- date_mochiie: 反響日（YYYY/MM/DD）
- search_mochiie: （推定）検索条件・きっかけ
- reserve_mochiie: （推定）来場予約の内容
- note_mochiie: （推定）備考
- shop_mochiie: 取り込んだアカウントのブランド（DJH / Nagomi）。店舗名ではない
