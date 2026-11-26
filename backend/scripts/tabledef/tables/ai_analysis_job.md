---
table: ai_analysis_job
title: Claudeによる分析の実行記録
business: common
source: 改修
---
「Claudeによる分析」（v2.2.217〜。画面 header/claude/ClaudeAnalysis.tsx）の1回の実行が1行。依頼文・対象・進み具合・結果のレポート（HTML）・費用を持つ。
② の features/aiAnalysis/job.ts が書く（ai_analysis_start で queued → running → done / error）。画面は ai_analysis_list を数秒ごとに読み、ai_analysis_get で本文を開く。
共有するときは shared_report に HTML の写しを作る（source = ai_analysis）。
⚠️ 削除は行を消さず deleted_at を付けて html を消す（1日の実行回数の上限を数えるため）。
⚠️ html は Claude が書いた HTML。画面では iframe（sandbox）の中でしか出さない。

## 列
- id: 連番（自動採番）。shared_report.source_id から参照される
- staff_id: 実行した人（staff.id）
- staff_name: 実行した人の名前（staff.name の写し）
- status: queued＝受付 / running＝実行中 / done＝完了 / error＝失敗。② の再起動時に queued・running は error にする
- prompt: 利用者が書いた依頼文
- division: order（注文）/ kaeru（建売）
- section: 課。空は事業部全体
- shop: 店舗。空は課（または事業部）全体
- period_from: 対象期間の始め（YYYY-MM）
- period_to: 対象期間の終わり（YYYY-MM）
- progress: 画面に出す途中経過（例: 店舗別の実績を集計中）
- tool_calls: Claude がデータを取りに行った回数
- title: レポートの題（完了時に入る）
- summary: 一覧に出す要約（1〜3文）
- html: レポート本文（HTML）。削除すると NULL
- model: 使った Claude のモデル名
- input_tokens: 入力のトークン数
- output_tokens: 出力のトークン数
- cost_usd: かかった費用（ドル）
- error_message: 失敗の理由
- created_at: 受け付けた日時。1日の実行回数はこれで数える
- started_at: 分析を始めた日時
- finished_at: 終わった（完了・失敗）日時
- deleted_at: 削除した日時。⚠️ 行は消さない（消すと1日の実行回数が減り、上限をすり抜けられる）
