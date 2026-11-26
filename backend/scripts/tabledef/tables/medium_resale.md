---
table: medium_resale
title: 中古リノベの販促媒体
business: used
source: 改修
---
中古リノベの販促媒体（反響媒体）の選択肢。1行＝媒体1つ（例 SUUMO・すまいステップ・HOME'S・イエイ・ネット検索・カエール・イエウール・athome）。
読むもの：中古の反響一覧・顧客の編集・顧客DB・店舗別（shopTrend）・地図（SELECT * の全件）。
⚠️ 注文の medium_list と違い list_medium などの列は無い。顧客の編集は全件を list_medium = 1 として扱う（InformationEditResale.tsx）。
⚠️ 建売は「Web検索」、中古は「ネット検索」（どちらの表にももう片方の言い方は無い）。
⚠️ 画面からの追加・編集は無い（推定）。

## 列
- no: 連番（自動採番）。並び順にも使う
- medium: 媒体名
