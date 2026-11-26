---
table: satbase_property
title: SatBase物件（建売の物件台帳の写し）
business: spec
source: 改修
---
SatBase の物件台帳（「KHF物件管理【KHG】 - 中間加工（物件）」）の写し。1物件 = 1行（backend/scripts/sql/2026-09-22_satbase_property.sql で作成）。ローカルは約1,900件。
書くのは ② satbase_import（SatBaseサマリーの CSV 取り込み。マスターだけ。property_id で突き合わせて追加・更新し、CSV に無い物件は消さない。空欄は NULL で上書き）。以前は backend/scripts/sql/2026-09-29_satbase_property_reload.sql で丸ごと入れ替えていた。
読むのは ② satbase_list（SatBaseサマリー header/SatBaseDatabase.tsx。satbase_property_flag を LEFT JOIN し、全件を返して画面で絞る）。① に PHP ハンドラは無い。
⚠️ SatBase 側が正。画面から書き換えない（画面のトグルは satbase_property_flag）。⚠️ CSV は位置で読む（列の並びは satbase.ts の IMPORT_COLUMNS）。

## 列
- property_id: 物件ID。⚠️ 主キー。画面はこの値の降順で並べる
- property_name: 物件名称。例: 2L国分重久ⅡG 2F
- usage_type: 用途の区分（0〜5の数値。意味は SatBase 側の定義）
- customer_name: お客様名。⚠️ 個人情報。契約済みの物件のみ入る
- contract_staff: 契約担当者名
- progress_status: 工程状況（着工前 / 建築中 / 完成済 / その他）
- sales_status: 販売状況（契約済 / 引渡済 / モデルハウス / キャンセル 等）
- area: エリア（市区町村）
- site_staff: 現場管理・営業担当者名
- design_staff: 設計担当者名
- construction_staff: 施工管理担当者名
- foundation_start_date: 基礎着工日。⚠️ 実データに 1970-01-01 が混ざっている（未入力の代わり）
- completion_date: 完工日
- exterior_completion_date: 外構完了日
- payment_date: 入金日。⚠️ 実データに 1970-01-01 が混ざっている
- delivery_date: 引渡日
- land_cost: 販売価格のうちの土地代（円）
- sales_price: 販売価格（円）
- contract_recorded_date: 契約計上日
- land_id: 土地ID（SatBase の土地台帳）
- permit_date: 確認済証の許可日
- property_id_general: 物件ID（一般）。⚠️ 実データでは property_id と同じ値
- plan: プラン名。例: 2A-5
- ground_improvement: 地盤改良の費用（円）。0 は改良なし
- price_changed_date: 販売価格を変更した日
- previous_sales_price: 変更前の販売価格（円）
- desired_start_date: 着工希望日
- purchase_settlement_date: 仕入の決済日。⚠️ 2026-09-22 時点で全件空
- purchase_contract_date: 仕入の契約日。⚠️ 2026-09-22 時点で全件空
- lat_lng: 位置情報（緯度,経度）。⚠️ 2026-09-22 時点で全件空
- property_id_manager: ID（管理職）。⚠️ 実データでは property_id と同じ値
- spec: 仕様（ZEH水準 / 省エネ / その他）
- prefecture: 県。⚠️ 実データに #N/A が混ざっている
- sales_period: 販売期間。⚠️ 「+0」「+12」のような符号付きの文字列で入っている
- portal_posted_date: ポータルサイトへの掲載日
- kaeru_hp_posted_date: かえるホームページへの掲載日
- schedule_created: 工程表を作成済みか（0 / 1）
- team: チーム（係）。例: 鹿児島係 / 大分係 / 土地仕入
