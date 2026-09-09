-- ===========================================================
-- ALLGRIT（注文）に「建築予定地（市区町村）」を保存する
--
-- 2026-09-08
--
-- ─────────────────────────────────────────────
-- なぜ必要か
--
--   ALLGRIT の CSV には「建築予定地（市区町村）」列があるが、
--   これまで **どこにも保存されず、店舗判定にも使われていなかった。**
--
--   原因は sync 側のマッピングで、Homes 用のキー名を使っていたこと。
--
--     src/services/runAllgritOrder.ts
--       "建築予定地（市区町村）": "place_homes"   ← ⚠️ Allgrit なのに _homes
--
--   `allGrit_db` に `place_homes` 列は無く、allgrit_db_order.php の
--   許可カラムにも入っていないため、ゲートウェイで黙って捨てられていた。
--
--   その結果 Allgrit だけが他ポータルと挙動が違っていた。
--
--     ポータル   inquiry_customer.area に入れていた値
--     Homes      place_homes            （建築予定地）
--     SUUMO      place_suumo            （建設予定地）
--     タウンライフ place_detail_townlife （建設予定地詳細）
--     ALLGRIT    pref + city            （⚠️ 希望エリア第1希望）
--
--   店舗判定も同じで、Allgrit だけ「希望エリア第1希望 → 住所」の順に
--   見ており、建築予定地を見ていなかった。
-- ─────────────────────────────────────────────
--
-- ⚠️ 既存の列はすべて `text`。型を揃える。
--
-- ⚠️⚠️ `NOT NULL` にしないこと。
--   同じテーブルの `city_allGrit2` / `city_allGrit3` / `shop_allGrit` が
--   `NOT NULL` かつ既定値なしで定義されており、値を省いた INSERT が
--   strict モードで失敗する状態になっている。同じ罠を増やさない。
--   （既存列はこの SQL では変更しない。挙動が変わるため別途判断する）
--
-- ⚠️ 適用は phpMyAdmin のインポート機能を使うこと。
--   シェルのパイプ（mysql < file）だと日本語のコメントが文字化けする。
-- ===========================================================

ALTER TABLE `allGrit_db`
  ADD COLUMN `place_allGrit` TEXT DEFAULT NULL
    COMMENT '建築予定地（市区町村）。店舗判定の第1優先。⚠️ 希望エリア第1希望（city_allGrit）とは別物'
    AFTER `city_allGrit3`;

-- 確認
--   place_allGrit が city_allGrit3 の次に、Null=YES で並んでいること
-- SHOW COLUMNS FROM `allGrit_db`;
