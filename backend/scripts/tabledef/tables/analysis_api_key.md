---
table: analysis_api_key
title: 分析APIのキー
business: common
source: 改修
---
分析API（② の /api/v1/analysis/…。Claude デスクトップから MCP 経由で叩く）を使うための受信用キー。1行がキー1本。
発行は ② の CLI（src/cli/issueAnalysisKey.ts）だけで、画面は無い。照合は ② の middlewares/apiKeyAuth.ts（Authorization: Bearer）。
⚠️ キー本体は発行時にしか表示せず、DB には SHA-256 のハッシュだけを持つ。値は画面・資料に出さない。
⚠️ 止めるときは revoked_at を入れる（行は消さない。analysis_query_log が参照する）。

## 列
- id: 連番（自動採番）。analysis_query_log.api_key_id から参照される
- staff_id: 所有者。staff.id。Master権限のみ
- label: 用途がわかる名前（例: だれの何の端末か）
- key_hash: SHA-256(キー本体)。16進64文字。⚠️ 秘密。一意
- key_prefix: 画面表示用の先頭部分（キーの見分け用）
- expires_at: 有効期限。NULLなら無期限
- revoked_at: 失効させた時刻。入っていたら即座に拒否
- last_used_at: 最後に使われた時刻（認証のたびに更新）。棚卸しに使う
- created_at: 発行した日時
