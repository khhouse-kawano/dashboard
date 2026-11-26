---
table: realty_practice_logs
title: ロープレ練習の記録
business: realty
source: 改修
---
不動産企画係のロープレ練習1回 = 1行（v2.2.226）。以前のアプリ（Supabase）の practice_logs と同じ中身。
書くのは ② planner:practice_logs_import（以前のアプリの CSV の取り込み。マスターだけ）だけ。⚠️ 練習の画面は移行中で、Dashboard から書く処理・読む画面はまだ無い（推定）。
⚠️ 日時は日本時間。⚠️ JSON の列は文字列のまま持つ。⚠️ ローカルは 0 件。

## 列
- id: 連番（主キー）
- src_id: 以前のアプリ（Supabase）の id。CSV の取り込みの二重防止
- created_at: 練習した日時（日本時間）
- staff: 練習した担当者
- mode: full＝通し練習 / kiwa＝引き際トレーニング
- level [推論]: 難易度
- persona: 売主の設定（JSON）
- total [推論]: 採点の合計点
- max_total [推論]: 採点の満点
- scores [推論]: 項目ごとの点数（JSON）
- checklist [推論]: チェック項目の達成状況（JSON）
- result: 採点の結果（JSON）
- judge: ナビ上の動き（JSON）
- transcript: 会話（JSON）
- duration_sec: 練習の秒数
- max_step: どこまで進んだか
- rebuttals: 表示した切り返しの id（JSON 配列）
- appointment [推論]: アポを取れたか（0 / 1）
- app_ver: 練習したときのアプリの版
