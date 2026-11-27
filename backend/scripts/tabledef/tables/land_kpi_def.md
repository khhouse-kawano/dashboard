---
table: land_kpi_def
title: 土地仕入の KPI の定義
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の KPI の一覧。仕入ダッシュボードのカードはこの並びで出す。
初期値は移行元の6指標（業者AP・情報取得・社長提案・買付・契約・仕入区画。calc = auto）。
⚠️ これから KPI を足すための受け皿。calc = manual の KPI は、手入力の実績（land_manual_actual）だけで数える。目標は land_target に kpi_key で入れる。
⚠️ calc = auto の数え方は logic.ts の computeActual に書いてある（kpi_key を変えると数えなくなる）。

## 列
- id: 連番
- kpi_key: KPI のキー（land_target・land_manual_actual の kpi_key）
- label: 画面の名前
- unit: 単位（件・区画など）
- calc: auto＝記録から自動で数える（＋手入力） / manual＝手入力だけ
- description: 数え方の説明（カードに出す）
- sort: 並び順
- active: 1＝使う（0 にするとカード・集計から外れる）
- created_at: 登録日時
- updated_at: 最後に直した日時
