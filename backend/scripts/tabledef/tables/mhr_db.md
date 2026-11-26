---
table: mhr_db
title: MHR 反響の取り込み元（媒体不明）
business: common
source: 推論
---
（推定）「MHR」という媒体からの反響（会員登録・資料請求など）の生データ。1行が1件。媒体の正式名は分からない。
コードからの使用箇所なし（推定：Dashboard・sync の外の古い取り込みが書いていた）。
登録は 2025/03/28〜2025/07/17 の266件で止まっている。住所は九州以外も含む。反響一覧（inquiry_customer）に対応する接頭辞の行は見つからない。
⚠️ 個人情報を含む。使わないなら整理の対象（推定）。

## 列
- id: 連番（自動採番）
- id_mhr: （推定）媒体側の ID（5桁）
- sei_mhr: 氏名の姓
- mei_mhr: 氏名の名
- sei_kana_mhr: 氏名の姓（カナ）
- mei_kana_mhr: 氏名の名（カナ）
- zip_mhr: 郵便番号
- pref_mhr: 都道府県
- address_mhr: 住所（都道府県より後）
- phone_mhr: 電話番号
- mail_mhr: メールアドレス
- register_mhr: 登録日（YYYY/MM/DD）
