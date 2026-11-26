---
table: loan_product
title: 住宅ローン商品（資金計画書）
business: common
source: 改修
---
資金計画書の比較表に出す住宅ローン商品。1行が1商品。v2.2.168（backend/scripts/sql/2026-10-06_loan_rate.sql）。金利そのものは loan_rate に持つ。
② loanRate.ts：loan_rate_upload（Master だけ。画面 header/system/UploadLoan.tsx の CSV）が登録・更新し、loan_rate_latest（全員）が計画書に返す。
⚠️ 列名・キー名は資金計画書の LOANS と同じ（fi・pn など）。改名しない。
⚠️ 行は消さない（過去の金利の参照元）。出さないときは active = 0。

## 列
- id: 商品ID（LOANS の id。例: kagin / flat35）。⚠️ 変えると計画書の比較表と照合できなくなる
- g: 区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）
- fi: 金融機関名（例: 鹿児島銀行）。⚠️ 一括更新（金融機関名=金利）の照合キーにもなる
- pn: 商品名（例: 住宅ローン（変動））
- type: 金利タイプ。v = 変動 / f = 固定
- url: 公式サイト
- sort: 並び順（小さいほど上）
- active: 1 = 計画書に出す / 0 = 出さない（⚠️ 行は消さない。過去の金利の参照元になるため）
- created_at: 登録日時
- updated_at: 更新日時
