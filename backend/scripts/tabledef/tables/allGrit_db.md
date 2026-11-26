---
table: allGrit_db
title: ALLGRIT 反響の取り込み元（注文住宅）
business: order
source: 改修
---
ALLGRIT（LINE の顧客管理。注文住宅の KH・DJH の LINE アカウント）の顧客一覧の生データ。1行が1件の LINE の友だち（リード）。
sync の runAllGrit.ts（注文と建売をまとめた処理。旧 runAllgritOrder.ts）が CSV を落とし、来店予約・資料郵送後で姓のある行だけを ① の request allgrit_db_order（handlers/allgrit_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に `allgrit<id_allGrit>` の行を足す（portal/allgrit_order.php。媒体 ALLGRIT）。
⚠️ 鍵は id_allGrit だが UNIQUE キーは無い。PHP が既にある ID を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ city_allGrit2・city_allGrit3・shop_allGrit は NOT NULL で既定値が無い（列を省いた INSERT は厳密モードで落ちる）。
⚠️ 建売（かえる）の ALLGRIT はこの表ではなく request allGrit_kaeru で別に送る。

## 列
- id: 連番（自動採番）
- id_allGrit: お客様の LINE UID。DJH のアカウントの行は末尾に `DJH` を付ける（同じ人が KH・DJH の両方にいると重なるため）
- date_allGrit: LINE 登録日（YYYY/MM/DD）。⚠️ sync が取り込んだ日の日付で上書きする
- status_allGrit: リードステータス（例 来店前・来店後・資料郵送後・商談中・成約済み）
- sei_allGrit: 姓
- mei_allGrit: 名
- mail_allGrit: 連絡先メールアドレス
- phone_allGrit: 電話番号
- zip_allGrit: 郵便番号
- address1_allGrit: 住所（反響一覧の building に入る）。店舗判定の第3優先
- budget_allGrit: 予算
- pref_allGrit: 希望エリアの都道府県
- city_allGrit: 希望エリアの市区町村 第1希望。店舗判定の第2優先
- city_allGrit2: 希望エリアの市区町村 第2希望
- city_allGrit3: 希望エリアの市区町村 第3希望
- place_allGrit: 建築予定地（市区町村）。店舗判定の第1優先。⚠️ 希望エリア第1希望（city_allGrit）とは別物（2026-09-08 に追加）
- shop_allGrit: 取り込んだアカウントのブランド（KH / DJH。以前の行には KHF・KHG もある）。店舗名ではない
