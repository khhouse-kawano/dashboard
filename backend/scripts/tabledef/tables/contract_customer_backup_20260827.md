---
table: contract_customer_backup_20260827
title: 契約者一覧の退避（2026-08-27）
business: common
source: 推論
copy_of: contract_customer
---
contract_customer（契約者一覧）を作り直す前の写し（2026-08 下旬）。全列が text で、status・sourceRow の列が無い旧い形。
作り直しの SQL（2026-08-26_market_construction.sql）は _backup_20260826 の名前で退避する書き方だが、実物はこの名前で残っている（推定：実行日が27日だった）。
⚠️ 画面・処理からは使っていない（推定）。

## 列
- id:
- name:
- contractDate: 契約計上日（text。日付以外の値も混ざる）
- constructionDate: 着工日（text。日付以外の値も混ざる）
- completionDate: 完工日（text。日付以外の値も混ざる）
- handoverDate: 引渡日（text。日付以外の値も混ざる）
- staff:
- section:
- shop:
- category:
- address:
- pref:
