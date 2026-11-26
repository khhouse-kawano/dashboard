---
table: breakaway
title: フォームの離脱記録
business: order
source: 推論
---
コードからの使用箇所なし（推定：キャンペーン・来場予約・資料請求のフォームで、途中まで入力して送らずに離れた記録。この repo の外（khg-marketing.info のフォームなど）が書いている）。
1行＝1回の離脱。2025-11〜 の記録がある。⚠️ Dashboard の画面・処理からは使っていない（推定）。入力した値そのものは持たず、入力済みの項目名だけを持つ。

## 列
- no: 連番（自動採番）
- brand: ブランド（kh / djh / pg / nagomi / jh / 2l など。小文字）
- campaign: キャンペーン・フォーム名（例「【KH共通】来場予約」）
- time: 離脱した日時（ISO 8601・UTC）
- filled: 入力済みだった項目名のカンマ区切り（shop・sei・mei・phone・mail など）
