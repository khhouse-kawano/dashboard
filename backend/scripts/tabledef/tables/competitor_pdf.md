---
table: competitor_pdf
title: 他社資料（PDF）
business: common
source: 改修
---
お客様からもらった他社の資料（カタログ・見積もり・チラシなど）の PDF。1ファイル＝1行（v2.2.140 で「顧客1人1行・JSON 配列」から作り替えた）。
登録は顧客情報の他社資料と他社資料一覧（frontend utils/competitorPdfUpload.ts → ① handlers/competitor_pdf_upload.php。ファイルは ① の /uploads/competitors/）。
読むのは顧客情報（information/TableCompetitorPdf.tsx。id で引く）と「他社動向 → 他社資料」（CompetitorMaterials.tsx。request competitor_pdf。カテゴリ → 他社 → PDF のフォルダ表示）。
⚠️ id は顧客ごとに重複する（主キーは no）。⚠️ 移行した古いファイルは company・category が空（画面では「未分類」）。

## 列
- no: 連番（主キー）
- id: master_data.id（どの顧客の資料か）
- name: 画面に出す表示名
- path: /uploads/competitors/xxx.pdf
- staff: 登録した営業
- company: 他社名。master_data.competitors_text から選ぶ（house_maker の候補も出す）
- category: カタログパンフレット/見積もり・提案書/チラシ/その他
- created: 登録日時
