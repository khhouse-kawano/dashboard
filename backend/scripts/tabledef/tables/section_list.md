---
table: section_list
title: 課マスタ
business: common
source: 改修
---
営業の課の一覧。1行が1つの課（鹿児島営業1課・不動産営業1課・中古住宅専門店 など）。
集計画面の課の選択肢と並び（no 順）に使う（顧客・店舗別反響推移・地図・全社報告・競合・Googleレビュー・営業別契約率・予算シミュレーターなど）。スタッフ・店舗の管理画面も選択肢として読む。
⚠️ 書き込む画面は無い（手で入れている。推定）。

## 列
- no: 連番。並び順にも使う
- division: 事業（注文事業 / 建売分譲事業 / 中古リノベ / 不動産企画室）。shop_list.division と同じ値
- name: 課の名前。shop_list.section・staff_list.section と同じ表記
- order_flag: 担当別一覧（注文営業）の表示の有無
- report_flag: 全社報告用フォーマットの表示の有無
