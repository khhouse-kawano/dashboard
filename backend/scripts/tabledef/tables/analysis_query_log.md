---
table: analysis_query_log
title: 分析APIの監査ログ
business: common
source: 改修
---
分析API（Claude デスクトップから MCP 経由）への1回の問い合わせが1行。いつ・だれのキーで・どの範囲を集計したかを追うための監査ログ。
② の features/analysis/audit.ts（recordAnalysisQuery）が書く。画面からは読まない。
⚠️ 返した結果の本体は残さない（条件と件数だけ）。⚠️ 書けなくても集計は止めない。

## 列
- id: 連番（自動採番）
- api_key_id: 使われたキー（analysis_api_key.id）。認証前に落ちた場合は NULL
- staff_id: キーの所有者（staff.id）
- endpoint: 呼ばれた口（pivot / funnel / unsynced / meta / adspend / competitor / report/list / report/spec など）
- group_by: 集計軸。カンマ区切り
- metrics: 指標。カンマ区切り
- basis: 集計の基準（reaction＝反響 / contract＝契約 / actual など）。無い口は NULL
- period_from: 対象期間の始め（YYYY-MM）
- period_to: 対象期間の終わり（YYYY-MM）
- filters: 絞り込み条件の JSON（512字で切る）
- row_count: 返した行数
- duration_ms: 所要時間（ミリ秒）
- status: ok / bad_request＝条件の誤り / unauthorized＝認証失敗 / rate_limited＝回数制限 / error＝失敗
- error_message: 失敗の理由
- client_ip: 接続元の IP（IPv6 も入るので45文字）
- request_id: X-Request-Id。② のアクセスログとの突き合わせ用
- created_at: 問い合わせの日時
