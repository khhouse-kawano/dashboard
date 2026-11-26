---
table: townlife_db_khf
title: タウンライフ 反響の取り込み元（国分ハウジング不動産）
business: spec
source: 推論
---
（推定）タウンライフ不動産売買（国分ハウジング不動産。ブランド KHF）の反響の生データ。1行が1件の問い合わせ。
コードからの使用箇所なし（推定：以前の取り込みスクリプト portal-app の reloadTownlifeKhf.js が書いていた。注文の townlife_db とは別。docs/oldDocument/handover-portal-order.md では移植の対象外）。
登録は 2025/10/31〜2026/03/04 の227件で止まっている。反響一覧（inquiry_customer_kaeru・_resale）との結び付きは見つからない。
⚠️ 個人情報を含む。使わないなら整理の対象（推定）。

## 列
- no: 連番（自動採番）
- id: （推定）タウンライフの問い合わせID（7桁）
- name: 氏名
- kana: ふりがな
- zip: 郵便番号
- address: 住所
- mail: メールアドレス
- phone: 電話番号
- category: 希望物件種別（例 戸建て・マンション・土地。複数は「，」区切り）
- area: （推定）希望エリア
- plan: （推定）希望間取り
- estate: （推定）土地・物件に関する希望
- price: （推定）予算
- demand: （推定）ご希望・こだわり
- note: （推定）その他
- date: 問い合わせ日（YYYY/MM/DD）
- shop: 店舗（すべて「国分ハウジング不動産」）
- situation: 状況（タウンライフ上の確認状況。例「<日時>確認済み」）
- brand: ブランド（すべて KHF）
