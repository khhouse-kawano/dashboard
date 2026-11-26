---
table: contract_customer
title: 契約者一覧（受注完工）
business: common
source: 改修
---
注文住宅（と一部の建売）の契約者一覧。スプレッドシート「受注完工【KHG】」の CSV から取り込む。1行＝1契約者（CSV の1行）。
取り込みは backend-express/scripts/import-construction-csv.mjs。読むのは市況分析（Market）の「KHGの着工棟数」（① market_construction.php）。
2026-08-26 に作り直した（backend-express/scripts/sql/2026-08-26_market_construction.sql）。日付列は date 型にし、日付でない値（解約・未定・未入力・工程表無し）は status に逃がしている。
⚠️ 建売の着工は物件単位の kaeru_building で数える（契約者一覧には未販売の着工物件が載らないため）。⚠️ 氏名にサロゲートペアがあるので utf8mb4 のまま扱う。

## 列
- id: 連番（自動採番）
- name: 邸名（契約者名）
- contractDate: 契約計上年月日
- constructionDate: 着工予定日（済は実績）
- completionDate: 完工予定日（済は実績）
- handoverDate: 引渡年月日（済は実績）
- status: 日付列に入っていた非日付値（解約/未定/未入力/工程表無し）
- staff: 営業担当
- section: 営業所属課
- shop: 事業所
- category: 注文 / 建売。事業所に「かえる」を含むかで判定
- address: 建築地
- pref: 県
- sourceRow: 元CSVの行番号（差し戻し調査用）
