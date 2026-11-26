---
table: registered_estate
title: スタッフ別の物件取得件数
business: common
source: 推論
---
（推定）PG CLOUD の「物件取得者履歴」のレポートを、スタッフ × 月で数えたもの。1行 = 1スタッフの1か月。ローカルでは 2025/01〜2026/04 の 82 行。
コードからの使用箇所なし（推定：外部の同期処理か手作業で入れ、Dashboard の画面では使っていない）。
⚠️ name はスタッフ名（staff の名前とほぼ一致）。dev の個人情報マスク（mask_personal_info.sql）では判定できず対象外にしている。

## 列
- no: 連番（主キー）
- name: （推定）物件を取得したスタッフの名前
- period: 年月（YYYY/MM）
- value: （推定）その月に取得した物件の件数
- url: （推定）PG CLOUD のレポートの絞り込み済みの一覧へのパス（/properties?… の相対パス）
