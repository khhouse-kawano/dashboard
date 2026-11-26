---
table: table_definition
title: テーブル定義書（テーブル）
business: common
source: 改修
---
テーブル定義書のテーブルごとの説明（v2.2.301）。1テーブル＝1行。
原稿は backend/scripts/tabledef/tables/<テーブル名>.md で、build-tabledef-sql.cjs が出す SQL で入れる。画面「システム管理 → テーブル定義書」（header/TableDefinition.tsx・Master だけ）が ② の table_definition で読む。
⚠️ 画面からは書き換えない（閲覧のみ）。⚠️ 型・NULL・既定値は持たない（② が SHOW FULL COLUMNS で実物から読む）。
⚠️ テーブルを作る・列を足す・意味を変えたら、原稿を直して SQL をその版の update_log の SQL に入れる（CLAUDE.md「テーブル定義書」）。

## 列
- table_name: テーブル名（主キー）
- title: 日本語の名前
- business: 事業（order 注文住宅 / spec 建売 / used 中古リノベ / realty 不動産企画係 / common 共通）
- description: テーブルの説明
- source: 出典（改修＝これまでの改修で扱った / 推論＝登録値から推した）
- updated_version: 説明を最後に直した版（説明・出典が変わったときだけ上がる）
- updated_at: 説明を最後に直した日時
