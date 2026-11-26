---
table: loan_rate
title: 住宅ローン金利（資金計画書）
business: common
source: 改修
---
資金計画書で使う住宅ローン商品ごとの金利と手数料。1行が「1商品 × 1基準日」の登録。v2.2.168（backend/scripts/sql/2026-10-06_loan_rate.sql）。
② loanRate.ts：loan_rate_upload（Master だけ。UploadLoan.tsx の CSV）が登録して確定し、loan_rate_latest が商品ごとの最新の確定済みの行を返す。
⚠️ 確定（confirmed_at）していない行は下書きで、計画書には出さない。
⚠️ 顧客の計画書（funding_plan.loans）は保存時点の金利を持つ。ここを直しても過去の計画書の数字は動かない。

## 列
- no: 連番
- id: 商品ID（loan_product.id）
- base_date: 基準日（この金利をいつ時点のものとして登録したか）。⚠️ HTML の ln_asof にあたる
- rate: 金利（%）。例: 0.875
- asof: 金融機関側の適用月の表記（LOANS の asof。例: 2026/8）
- fee: 事務手数料の表記（例: 借入額×2.2%）
- feeMode: rate = 借入額×feeVal% / fixed = feeVal 円
- feeVal: 事務手数料の値（feeMode による。% または 円）
- hosho: 保証料の表記
- hoshoVal: 保証料（円）。⚠️ 試算では事務手数料に足される
- dan: 団信の表記
- note: 備考（優遇条件など）
- warn: 注意書き（画面で目立たせる）
- source: 出典（例: 各金融機関公式サイト（2026年8月時点））。⚠️ HTML の ln_source にあたる
- confirmed_at: 確定日時。⚠️ NULL の行は下書きで、計画書には出さない
- confirmed_by: 確定した人（staff の名前）
- created_by: 登録した人（staff の名前。初期投入は system）
- created_at: 登録日時
- updated_at: 更新日時
