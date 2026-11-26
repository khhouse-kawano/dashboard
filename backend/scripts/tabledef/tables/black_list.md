---
table: black_list
title: ブラックリスト名簿
business: common
source: 改修
---
反響を受けたくないお客様の名簿。1行＝1人。反響一覧で、携帯番号かメールが一致する反響にブラックの印を付けるのに使う。
書くのは ② blacklist.ts（ブラックリストの編集 header/inquiry/EditBlackList.tsx。一覧・追加・1列ずつ更新）と、反響一覧でブラックを付け外ししたとき（list/save.ts。一致する行の show_key を 0/1 にし、理由を note に足す。無ければ行を作る）。読むのは反響一覧（show_key = 1 の mail・mobile）。
⚠️ 主キーは no。id は飾り（'bl_…' のダミー値）なので WHERE に使わない。
⚠️ 反響の black タグ（inquiry_customer のフラグ列）とは別物。
⚠️ note は NOT NULL で既定値が無い。空文字を必ず入れる。

## 列
- no: 連番（自動採番）。画面はこの値で行を更新する
- id: ダミーの ID（'bl_' で始まる）。どこでも使わない
- name: 顧客名
- brand: ブランド（KH / DJH / 2L / 中古住宅専門店 / 全社 など。無いときは全社）
- date: 登録日（YYYY/MM/DD）
- mail: メールアドレス（反響との突き合わせに使う）
- mobile: 携帯番号（反響との突き合わせに使う）
- zip: 郵便番号
- full_address: 住所
- show_key: 1 = 有効 / 0 = 解除
- note: 理由・経緯のメモ（反響一覧から付けた理由を追記する）
