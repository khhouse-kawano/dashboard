-- ===========================================================
-- shop_list に「親店舗」の列を追加（併売店をまとめるため）
--
-- 2026-09-10
--
-- ─────────────────────────────────────────────
-- 何のための列か
--
--   1つの拠点に複数ブランドの店舗が同居している（＝併売店）ケースを、
--   会社実績（frontend/src/components/company/Company.tsx）で
--   1店舗としてまとめて見るために使う。
--
--   例（2026-09-10 時点の実データ）
--     加世田 … KH加世田店 / DJH加世田店 / なごみ加世田店
--     鹿屋   … KH鹿屋店   / DJH鹿屋店
--     延岡   … KH延岡店   / DJH延岡店
--
--   子店舗の `parent_shop` に**親店舗の `shop` をそのまま**入れる。
--     例: DJH加世田店 の parent_shop = 'KH加世田店'
--
--   ⚠️ 値は運用側が手作業で設定する。このSQLでは入れない。
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **非表示の条件は「multi = 1 かつ parent_shop が入っている」である。**
--   親店舗自身は parent_shop が NULL なので表示され続ける。
--   ⚠️ `multi` の付け方は一貫していない（2026-09-10 時点で KH延岡店 だけ multi = 0）。
--     そのため「multi = 1 なら子」とは判断できない。必ず parent_shop の有無で見ること。
--
-- ⚠️ 親店舗名は `shop_list.shop` と1文字も違わない値を入れること。
--   Company.tsx は文字列の完全一致で親子を突き合わせる。
--   （既存コードには店舗名からブランド名を除いた**部分一致**での推測が
--     あるが、それを置き換えるのがこの列の目的である）
--
-- 実行順: このファイル単体で完結。
-- 冪等性: ⚠️ ADD COLUMN に IF NOT EXISTS を付けている（MariaDB 10.0+）。
--         二重実行しても落ちない。
-- ===========================================================

ALTER TABLE `shop_list`
  ADD COLUMN IF NOT EXISTS `parent_shop` TEXT DEFAULT NULL COMMENT '親店舗';

-- ===========================================================
-- 確認
-- ===========================================================
-- ⚠️⚠️ **information_schema は使わない。**
--   ① レンタルサーバー（Xserver 共用）の DB ユーザーには参照権限が無く
--     #1044 - ... 'information_schema' データベースへのアクセスを拒否します
--   になる。SHOW COLUMNS なら権限が要らない。
SHOW COLUMNS FROM `shop_list` WHERE `Field` = 'parent_shop';

-- 設定の対象になる店舗（multi = 1 かつ report_flag = 1）。
-- ⚠️ ここに出た店舗のうち、子にあたるものへ parent_shop を入れる。
SELECT `id`, `brand`, `shop`, `division`, `area`, `multi`, `report_flag`, `parent_shop`
  FROM `shop_list`
 WHERE `multi` = 1
 ORDER BY `division`, `shop`;
