---
table: realty_call_logs
title: 架電ナビの通話記録
business: realty
source: 改修
---
不動産企画係の架電ナビの「記録して次へ」1回 = 1行（v2.2.226）。以前のアプリ（Supabase）の call_logs と同じ中身。
書くのは ② planner:navi_save（架電ナビ。反響の更新と同じトランザクション）と planner:call_logs_import（以前のアプリの CSV の取り込み。マスターだけ）。読むのは ② planner:call_logs（架電ナビの「履歴・分析」）。
⚠️ 文字起こし・ヒアリングの詳細は反響（brokerage_listings）には入れず、この表だけに持つ。⚠️ 日時は日本時間。⚠️ JSON の列は文字列のまま持つ。
⚠️ 売主の名前・住所などの個人情報を含む。⚠️ ローカルは 0 件。

## 列
- id: 連番（主キー）
- src_id: 以前のアプリ（Supabase）の id。CSV の取り込みの二重防止。Dashboard で記録した行は NULL
- created_at: 記録した日時（日本時間）
- created_by: 記録した人（Dashboard のログイン名。取り込みは空）
- lead_id: 売り反響の id（brokerage_listings.id）。反響を選ばずに始めた通話は NULL
- lead_kind: 反響の種別（brokerage_listings.kind。navi_save は leads を入れる）
- staff: ナビの画面の担当者（略称）
- customer: 売主の名前（ナビの入力）
- media: 反響の媒体
- address: 物件の住所
- ms_name: マンション名
- room: 部屋番号
- station: 最寄り駅
- prop_type: 物件の種別
- area: 面積
- built: 築年
- owner: 名義人（続柄を括弧で付ける）
- occupancy: 居住の状況（補足を括弧で付ける）
- loan: ローンの有無
- loan_amount: ローンの残高
- wish_price: 希望価格
- wish_time: 売却の希望時期
- temperature: 売却の温度感
- reason: 売却理由（離婚・相続・住替え・資産整理）
- asker: 問合せ主（名義人・名義人以外 など。売却理由ごとの選択肢）
- status: 状況（売却理由と問合せ主ごとの選択肢。例「相続手続き中」）
- outcome: 通話結果（訪問アポ獲得・不在・不通 など）
- next_action: 次のアクション
- appt_at: アポの日時（日本時間）
- appt_place: アポの場所
- started_at: 通話開始（日本時間）
- duration_sec: 通話の秒数
- max_step: どこまで進んだか（1〜9）
- hearing: ヒアリング（JSON。{項目: メモ}）
- rebuttals: 表示した切り返しの id（JSON 配列）
- events: 操作の記録（JSON 配列）
- transcript: 文字起こし（JSON 配列 [{t, x}]）
- memo: 通話メモ
- app_ver: 記録したときのアプリの版
