---
table: suumo_property
title: SUUMO 掲載順位
business: spec
source: 改修
---
SUUMO の新築一戸建ての一覧（エリアごと）の掲載順位を、取得した日ごとに積み上げた表。1行が「ある取得日時の、あるエリアの、ある物件」。
オーナーの PC で週1回動くスクレイパー（extensions/meta_scraper/suumo_scraper.ts）が1件ずつ ① のゲートウェイへ送り、① が ② の features/suumoProperty.ts へ転送して INSERT する。
画面は SUUMO 掲載順位（database/SuumoPropertySummary.tsx）。② の property_suumo_latest（features/propertyGet.ts）が、選んだ取得日の行と、物件ごとの前回の行を返す。
⚠️ UNIQUE キーが無い。二重に送ると同じ物件が2行になる（そのため ① の expressProxyExclusive に入れ、① の予備では書かない）。
⚠️ 上書きせず積み上げる。行数は増え続ける。⚠️ 列はすべて text（数値も文字列）。

## 列
- id: 主キー
- rank: 掲載順位（文字列）。⚠️ 予約語なので SQL ではバッククォートで囲む
- area: エリア（市区町村。例 姶良市）
- company: 会社名（掲載している会社）
- name: 物件名
- price: 販売価格
- plan: 物件プラン（掲載枠。例 レポート枠・コマ枠・デコレーション枠・プレミアム枠）
- url: 詳細ページURL。前回順位を出すときに物件を見分ける鍵
- registered_at: 取得日時（YYYY-MM-DD HH:MM:SS）。画面の「取得日」は先頭10文字
