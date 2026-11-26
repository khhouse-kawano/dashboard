---
table: shop_list
title: 店舗マスタ
business: common
source: 改修
---
店舗の一覧。1行が1店舗（管理用の擬似店舗・インサイドセールスなども含む）。
画面はヘッダーの「システム管理 → 店舗」（header/system/EditShop.tsx。① header_shop_edit / header_shop_update）。
ほぼすべての集計画面（反響一覧・顧客DB・店舗別反響推移・全社報告・市況分析・紹介・アンバサダーなど）が、店舗の選択肢と事業・課への振り分けに読む。
⚠️ 画面ごとに絞り方が違う（show_flag = 1 の画面と report_flag = 1 の画面がある）。
⚠️ 経理の予算画面は別の表 shop_list_accounting を使う。

## 列
- id: 連番。並びにも使う
- brand: ブランド（KH / DJH / なごみ / KHF / FH / JH / PGH / 2L など）
- shop: 店舗名（例 KH鹿児島店）。staff_list.shop・budget.shop など各表の店舗名と同じ表記
- division: 事業（注文事業 / 建売分譲事業 / 中古リノベ / 不動産企画室）。section_list.division と同じ値
- section: 所属の課（section_list.name）
- area: 県（鹿児島県 / 宮崎県 など）。空の店舗も多い
- resister_goal [推論]: （推定）登録数の目標。⚠️ 綴りは resister。読む処理なし
- reserve_goal [推論]: （推定）来場予約数の目標。読む処理なし
- show_flag: 1 = 反響一覧などの店舗の選択肢に出す
- brand_sort: ブランドの並び順（KPI・市況分析・資金計画書・アンバサダーが ORDER BY brand_sort, id）
- event_modal [推論]: （推定）イベントの入力モーダルに出す店舗。店舗画面で切り替えられるが読む処理は見当たらない
- ma_flag [推論]: （推定）MA（マーケティング）の対象店舗。店舗画面で切り替えられるが読む処理は見当たらない
- report_flag: 1 = 全社報告用フォーマット・市況分析・紹介・日報などの対象店舗（管理用の擬似店舗を外す）
- multi: 1 = 併売店（2つのブランドを同じ店で売る）。親か子かは parent_shop で見る
- parent_shop: 親店舗（併売店の子にだけ親の shop を入れる。例 DJH加世田店 → KH加世田店）。集計で親にまとめる。⚠️ 親自身は NULL（backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql）
