---
table: suumo_resale_summary
title: SUUMO 掲載物件のサマリー
business: common
source: 改修
---
SUUMO に掲載している自社物件の一覧（掲載状況・PV など）。1行が1物件（management_no）。
sync の summary の処理（suumo_summary）が ① の request suumo_db_resale_summary（handlers/suumo_db_resale_summary.php）へ送り、management_no で上書き（ON DUPLICATE KEY UPDATE）する。management_no が空の行は捨てる。
同じ行を ② の property_db_portal（features/propertyPortal.ts）にも送り、物件DB（property_db）の空の列を埋める（docs/property-db-portal.md）。
画面は物件DB（DatabaseProperty.tsx）・物件のサマリー（PropertySummary.tsx）。② の property_list / property_detail（features/propertyGet.ts）が management_no ＝ property_db.property_id で結ぶ。
⚠️ アカウントの列が無い。建売（かえる）と中古の物件が1つの表に混ざる。
⚠️ basic_info などの列は、SUUMO の画面の複数の欄を1つにまとめた文（列のコメントの見出しの並び）。

## 列
- id: システム用主キー
- basic_info: 種別・物件名・号棟名/区画名・部屋番号・販売戸数/総戸数・会社間コピー物件・相互リンク・物件コード・販売状況をまとめた文
- location_and_price: 沿線名・駅名・交通・バス停名・価格をまとめた文
- registered_images: 登録画像（SUUMOマガジン用優先画像）（ハイライト）
- contract_status: 成約状況
- suumo_net_status: SUUMOネットのコマ掲載・レポート掲載（該当あり）・最終掲載
- suumo_net_options: SUUMOネットのオプション商品（現在指示あり）
- hp_service: HPサービス掲載（現在指示あり）
- suumo_magazine_past: SUUMOマガジンの過去掲載
- suumo_magazine_current: SUUMOマガジンの今回掲載（掲載指示あり）・掲載企画・最終掲載
- timestamps_info: 物件登録日時・物件最終更新日時
- summary: 概要
- catch_and_layout: ネット用メインキャッチ・サブキャッチ・レイアウト・キャプション（間取りはこの文の中にしか無い）
- trade_company_info: 取引態様・元付情報・会社情報
- internal_info: ★マーク・問合先担当者・貴社御担当・貴社物件コード・社内コメント1/2・問合せ先（現場型）
- company_code: 会社コード
- property_type_detail: 物件種別
- station_detail: 沿線駅
- address: 住所（物件DB の address を埋めるのに使う）
- min_price: 最低価格（円。物件DB の価格を埋めるのに使う）
- max_price: 最高価格
- original_company: 元付け会社名
- original_staff: 元付け担当
- bulk_upload_code: 一括入稿物件コード（末尾6桁がいえらぶの物件番号。使っていない）
- management_no: 貴社物件管理NO（いえらぶの6桁の物件番号）。上書きの鍵・物件DB と結ぶ鍵
- staff_in_charge: 貴社御担当
- property_category: 物件区分（例 居住用）
- publication_plan: 掲載企画
- pv_total: 詳細PV数（全期間）
- pv_recent_week: 詳細PV数（直近1週間）
- total_images: 総画像数
- highlight_detail: ハイライト
- created_at: レコード作成日時
- updated_at: レコード更新日時
