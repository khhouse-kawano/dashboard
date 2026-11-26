---
table: contract_expected
title: 契約見込み数（当月確約数）
business: common
source: 改修
---
店舗ごと・月ごとの契約見込み数（ランク画面の「当月確約数」など）。1行＝1か月×1営業課×1店舗（date・section・shop の UNIQUE キー）。
書くのは ② contract_ex_update（interviewLog.ts の runContractExpectedUpdate。① contract_ex_update.php から移したもの）。読むのはランク画面（RankOrder・RankKaeru・RankResale。rank の EXPECTED_SQL）。
⚠️ ON DUPLICATE KEY UPDATE で上書きする。UNIQUE キーを外すと同じ組み合わせの行が増え続ける。⚠️ 書き込みは ① へのフォールバック禁止。

## 列
- id: 連番（自動採番）
- date: 年月（YYYY/MM）
- section: 営業課
- shop: 店舗
- count: 契約見込み数（空なら 0）
