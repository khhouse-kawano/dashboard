---
table: kpi_analysis_history
title: 旧KPI分析の結果
business: common
source: 改修
---
旧「KPI分析」（Claude による定型分析。① の kpi_analyze.php）の1回の結果が1行。Claude の解釈（analysis_json）と集計値（kpi_json）を JSON のまま持ち、画面で同じ結果を復元する。
読むのは ② の features/kpi/history.ts（kpi_analysis_list・kpi_analysis_get。Master のみ）で、画面は「Claudeによる分析」（header/claude/ClaudeAnalysis.tsx）の過去の定型分析。削除は ① の kpi_analysis_delete.php。
⚠️ kpi_analyze は画面から呼ばれなくなった（2026-10 以降の行が無い）。今の分析は ai_analysis_job。
⚠️ kpi_json は集計値だけで、お客様の個人情報は入らない（住所は市区町村まで）。⚠️ 一覧で analysis_json・kpi_json を SELECT しない（重い）。

## 列
- id: 連番（自動採番）
- staff_id: 実行者。staff.id（外部キー）
- usage_log_id: ai_usage_log.id。コスト追跡用
- title: 一覧に出す見出し（例: 日付＋事業＋課＋分析の種類）
- headline: Claudeの総括1〜2文。一覧のサブテキスト
- analysis_type: inquiry_trend＝反響推移 / shop＝店舗別 / medium＝媒体別
- division: order / kaeru
- scope_section: 対象の課（shop_list.section）。空は事業全体
- scope_shop: 対象の店舗（shop_list.shop）
- scope_staff: 対象の担当者（staff_list.name）
- scope_label: 対象の表示名（例: 注文事業 › 鹿児島営業1課）
- analysis_json: Claude の解釈（StructuredAnalysis）
- kpi_json: 集計値（AnySnapshot）。グラフの元データ
- model: 使ったモデル（例: claude-opus-5）
- created_at: 実行した日時
