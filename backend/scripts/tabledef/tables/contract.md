---
table: contract
title: 契約・工程の一覧（旧）
business: order
source: 推論
---
コードからの使用箇所なし（推定：注文住宅の契約ごとの工程（確認申請・着工・完工・引渡）と手数料を持つ旧い表。0行で、契約者の一覧は contract_customer に移っている）。
1行＝1契約（推定）。⚠️ 画面・処理からは使っていない（推定）。⚠️ 列名に綴りの誤りがある（Constraction・competion・commition）。

## 列
- id: 連番
- idSearch: （推定）検索用の番号
- number: （推定）契約の番号
- projectNumber: 工事番号
- customerName: 顧客名（邸名）
- contractDate: 契約日
- confirmation: （推定）確認申請日（予定）
- startConstraction: 着工日（予定）
- competionConstruction: 完工日（予定）
- handover: 引渡日（予定）
- confirmation_2: （推定）確認申請日（実績）
- startConstraction_2: （推定）着工日（実績）
- competionConstruction_2: （推定）完工日（実績）
- search: （推定）検索用の文字列
- handover_2: （推定）引渡日（実績）
- handoverStatus: 引渡の状態
- commitionIC: （推定）IC（インテリアコーディネーター）の手数料・担当
- commitionArchitect: （推定）設計の手数料・担当
- commitionControl: （推定）工事管理の手数料・担当
- staff: 営業担当
- section: 営業課
- shop: 店舗
- company: 会社（ブランド）
