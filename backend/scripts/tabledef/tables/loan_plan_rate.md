---
table: loan_plan_rate
title: 金融機関のプラン別金利（月次）
business: common
source: 改修
---
商圏内の金融機関の住宅ローンのプラン別金利。1行が「1か月 × 1プラン」。v2.2.240（backend/scripts/sql/2026-11-03_loan_plan_rate.sql）。
② loanPlanRate.ts：loan_plan_rate_upload（Master だけ）が plan_rates_YYYY-MM.csv の内容でその月を丸ごと入れ替え、loan_plan_rate_list（全員）が画面 header/market/LoanRates.tsx に返す。
⚠️ 資金計画書の金利（loan_product / loan_rate）とは別物。ここから計画書の金利は書き換えない。
⚠️ 列名は CSV の見出しと同じ。改名しない。月ごとの分析レポートは analysis_report（category = 'loan_rate'）。

## 列
- no: 連番
- month: 対象月（YYYY-MM。CSV のファイル名の月）
- line: CSV の行番号（見出しを1行目として数える）。⚠️ 並びを CSV と同じに保つため
- g: 区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）
- id: 商品ID（loan_product.id と同じ体系。例: kagin）
- fi: 金融機関名
- plan: プラン名
- rtype: 金利タイプ（変動 / 固定期間選択 / 全期間固定）
- term: 固定期間（年）。変動は空
- feeType: 手数料・保証料の型（手数料定率 / 保証料一括 …）
- dan: 団信（一般 / がん / 8大疾病 …）
- cond: 条件（どの金利を採ったか）
- rate: 適用金利（%）。⚠️ 空なら NULL
- base: 店頭（基準）金利（%）
- prev: 前月の適用金利（%）。⚠️ 前月に無いプランは NULL
- asof: 金融機関側の適用日（例: 2026/11/02）
- url: 出典の URL
- conf: 値の確かさ（official = 公式 / calc = 計算 / comparison = 比較サイト）
- created_by: 登録した人（初期データは seed）
- created_at: 登録日時
