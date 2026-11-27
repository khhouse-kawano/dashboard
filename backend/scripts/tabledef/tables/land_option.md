---
table: land_option
title: 土地仕入の選択肢
business: spec
source: 改修
---
建売営業の「土地仕入」（v2.2.311〜）の画面の選択肢。初期値は移行元と同じ。list_key ごとに並び順で出す。
list_key：deal_kind（案件種別）・ap_type（アプローチ種別）・reaction（反応）・reply_result（買付の返答結果）・lost_reason（失注理由）・deal_terms（契約条件）・vendor_kind（業者の区分）・phase（育成フェーズ）・bottleneck（ボトルネック）。
⚠️ ステータス（情報取得〜見送り）は工程の決まりに使うので、ここには置かない（logic.ts の STATUS）。
⚠️ ap_type の値は、まとめ入力の列（logic.ts の AP_BREAKDOWN）と対応している。名前を変えると集計で訪問に数えられる。

## 列
- id: 連番
- list_key: 選択肢の種類
- value: 選択肢の値
- sort: 並び順
- active: 1＝出す
