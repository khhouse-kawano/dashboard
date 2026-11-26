---
table: suumo_db
title: SUUMO 反響の取り込み元（注文住宅）
business: order
source: 改修
---
SUUMO（注文住宅。KH・DJH・Nagomi）の資料請求の生データ。1行が1件の資料請求（依頼番号）。
sync の runSuumoOrder.ts が SUUMO の管理画面から CSV を落とし、① の request suumo_db_order（handlers/suumo_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に `suumo<依頼番号>` の行を足す（portal/suumo_order.php。媒体 SUUMO）。
⚠️ 鍵は id_suumo だが UNIQUE キーは無い。PHP が既にある依頼番号を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ 毎回「前月1日から」の全件が送られてくるので、平常時は skipped が多いのが正常。
画面から直接は読まない（反響一覧は inquiry_customer を読む）。

## 列
- id: 連番（自動採番）
- date_suumo: 資料請求日（YYYY/MM/DD。CSV の「.」を「/」に直して入れる）
- id_suumo: 依頼番号（SUUMO 側の番号）。反響一覧の inquiry_id は `suumo` ＋この値
- sei_suumo: 氏名の姓（漢字）
- mei_suumo: 氏名の名（漢字）
- sei_kana_suumo: 氏名の姓（フリガナ）
- mei_kana_suumo: 氏名の名（フリガナ）
- age_suumo: 年齢
- zip_suumo: 郵便番号（反響一覧には入れない）
- address1_suumo: 住所1
- address2_suumo: 住所2（反響一覧には使わない）
- address3_suumo: 住所3。建設予定地で店舗が決まらないとき、店舗判定に使う
- mail_suumo: メールアドレス
- phone_suumo: 電話番号
- period_suumo: 建築予定時期
- budget_suumo: 予算（土地予算を除く）
- shop_suumo: 取り込んだアカウントのブランド（KH / DJH / Nagomi）。店舗名ではない
- place_suumo: 建設予定地（名称）。店舗判定の第1優先。反響一覧の area に入る
- duplicate_suumo: 重複の印（運用側で更新。取り込みでは触らない）
- result: 結果（例「来場済み」。運用側で更新。取り込みでは触らない）
