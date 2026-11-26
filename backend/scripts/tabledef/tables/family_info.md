---
table: family_info
title: 顧客の家族情報
business: common
source: 改修
---
顧客の家族（ご主人・奥様・お子様など）。1行＝1顧客（id は master_data・master_data_kaeru などの id）。家族の中身は family_info 列に JSON 配列で持つ。
書くのは ② familyInfo.ts（request: family_info。家族情報モーダル FamilyInfo.tsx）と資金計画書の保存（fundingPlan/familyInfoWriteBack.ts が奥様・お子様の名前などを差分だけ書き戻す）。読むのは家族情報モーダル、顧客DB（家族の名前で検索）、ギフトの判定、架電一覧、資金計画書の初期値。
⚠️ テーブル名と列名が同じ（family_info.family_info）。読み違えに注意。
⚠️ ① に family_info.php を作らない（familyInfo.ts の冒頭）。
⚠️ id が空の行が実在する。空の id で検索すると他人の家族が返るので、空では引かない。
⚠️ 家族の JSON は ② も ① と同じく文字列のまま返す（pool.ts の jsonStrings）。画面は JSON.parse して使う。

## 列
- no: 連番（自動採番）
- id: 顧客ID
- shop: 顧客の担当店舗（保存したときの値）
- name: 顧客名（保存したときの値）
- family_info: 家族の JSON 配列。1人分は relation（続柄）・name・kana・birth・mail・mobile・employmentType・employer・employmentYears の9項目
