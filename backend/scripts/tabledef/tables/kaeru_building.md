---
table: kaeru_building
title: 建売の物件（工程表）
business: spec
source: 改修
---
建売（かえるホーム）の物件一覧。スプレッドシート「かえるホーム工程表」の CSV から作る。1行＝物件1つ（property_id が主キー）。
書くもの：backend-express/scripts/import-kaeru-csv.mjs（⚠️ TRUNCATE してから全件を入れ直す）。2026-08-26_market_construction.sql で今の形に作り替えた。
読むもの：市況表（Market。① market_construction.php）の建売の着工・契約。注文の着工は contract_customer。
⚠️ 店舗コードを持たない。課・店舗で絞るときは staff（担当者名）を staff_list で読み替える。
⚠️ use_code の 4（中古再販）は新設着工ではないので着工から外す（frontend/src/components/market/README.md）。

## 列
- property_id: 物件ID（CSV の列0）。主キー
- name: 物件名称。⚠️ 同じ名前の物件があるのでキーに使わない
- use_code: 用途コード 0〜5（凡例が無いので生の値を残す。0・1・2・5＝建売、3＝注文系モデルハウス、4＝中古再販）
- category: use_code から作る区分。建売／中古
- progress_status: 工程状況（完成済・着工前・建築中・その他）
- sales_status: 販売状況（引渡済・販売中・契約済・キャンセル など）
- area: 市区町村
- pref: 県（取り込みで population の (pref, area) と突き合わせて補う）
- constructionDate: 基礎着工日。1970-01-01 は未入力として NULL
- completionDate: 完工日
- handoverDate: 引渡日（旧 finishedDate）
- contractDate: 契約計上日
- staff: 契約担当（staff_list の name と突き合わせる）
