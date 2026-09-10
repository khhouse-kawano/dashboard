-- ===========================================================
-- AIデジタル資金計画書（funding_plan）に「⑩ 土地検索」の列を追加
--
-- 2026-09-10
--
-- ─────────────────────────────────────────────
-- なぜ必要か
--
--   原本（C:/Users/shinji-kawano/Downloads/AIデジタル資金計画書.html）に
--   「⑩ 土地検索」のタブが追加された。地図から地点を選び、周辺施設を
--   検索して、候補地をメモしていく画面である。
--
--   ⚠️⚠️ **列を足さないと、画面では入力できるのに保存されない。**
--     保存処理は funding_plan に存在する列だけを採用する
--     （リクエストのキーをそのまま列名にすると SQL インジェクションになるため）。
--     列が無いキーは黙って捨てられ、エラーも出ない。
--
--   ⚠️ この SQL と backend-express/src/features/fundingPlan/columns.ts の
--     両方を直すこと。片方だけでは保存されない。
-- ─────────────────────────────────────────────
--
-- ⚠️ 列名は原本の `data-k` 属性と1文字も違わない。改名しないこと。
--   t_lat / t_lng / t_addr / t_muni / t_area / t_dist は data-k を持たず、
--   地図の操作からプログラムが代入する。それでも S に入るので保存対象。
--
-- ⚠️⚠️ **接頭辞 t_ は既に「⑦ 今建てる／待つ の比較」で使われている。**
--     既存: t_wait t_upRate t_futureRate t_yRate t_y1 t_y2 t_kidAge t_addPay
--     今回: t_pref t_city t_station t_lat t_lng t_addr t_muni
--           t_area t_dist t_radius t_budget t_needTsubo
--   名前は重複していないが、接頭辞だけで画面を判断しないこと。
--
-- 実行順: このファイル単体で完結。2026-09-08_funding_plan.sql の後に実行する。
-- 冪等性: ⚠️ ADD COLUMN に IF NOT EXISTS を付けている（MariaDB 10.0+）。
--         二重実行しても落ちない。
-- ===========================================================

ALTER TABLE `funding_plan`
  -- 検索条件（画面の入力欄。data-k あり）
   ADD COLUMN IF NOT EXISTS `t_pref` TEXT COMMENT '検索する県（kagoshima 等の内部値）'
  ,ADD COLUMN IF NOT EXISTS `t_city` TEXT COMMENT '検索する市区町村'
  ,ADD COLUMN IF NOT EXISTS `t_station` TEXT COMMENT '最寄り駅（任意）'
  ,ADD COLUMN IF NOT EXISTS `t_budget` DECIMAL(14,3) COMMENT '土地の予算（万円）'
  ,ADD COLUMN IF NOT EXISTS `t_needTsubo` DECIMAL(14,3) COMMENT '必要な坪数'
  ,ADD COLUMN IF NOT EXISTS `t_radius` DECIMAL(14,3) COMMENT '周辺施設を探す半径（m）'

  -- 選んだ地点。⚠️ 画面の入力欄ではなく、地図の操作から代入される
  ,ADD COLUMN IF NOT EXISTS `t_lat` TEXT COMMENT '選んだ地点の緯度。⚠️ 文字列で持つ（未選択は空文字）'
  ,ADD COLUMN IF NOT EXISTS `t_lng` TEXT COMMENT '選んだ地点の経度。⚠️ 文字列で持つ（未選択は空文字）'
  ,ADD COLUMN IF NOT EXISTS `t_addr` TEXT COMMENT '選んだ地点の住所（国土地理院の逆ジオコーディング結果）'
  ,ADD COLUMN IF NOT EXISTS `t_muni` TEXT COMMENT '選んだ地点の市区町村コード由来の表記'
  ,ADD COLUMN IF NOT EXISTS `t_area` DECIMAL(14,3) COMMENT '選んだ範囲の面積'
  ,ADD COLUMN IF NOT EXISTS `t_dist` DECIMAL(14,3) COMMENT '基準地点からの距離'

  -- ⚠️ JSON 型だが pool.ts の jsonStrings:true により**文字列**で返る。
  --   受け取り側で JSON.parse すること。
  ,ADD COLUMN IF NOT EXISTS `lands` JSON COMMENT '候補地のメモ（n:名称 ad:住所 ts:坪数 tk:坪単価 pr:価格 yt:用途地域 bk:建蔽/容積 hz:災害情報 me:備考 の配列）'
;

-- ===========================================================
-- 確認
-- ===========================================================
-- ⚠️ 13行返ることを確認する。少なければ ALTER が一部失敗している。
--
-- ⚠️⚠️ **information_schema は使わないこと。**
--   ① レンタルサーバー（Xserver 共用）の DB ユーザーには参照権限が無く、
--     #1044 - ユーザー '...'@'localhost' の 'information_schema' データベースへの
--     アクセスを拒否します
--   になる。SHOW COLUMNS なら同じ確認ができ、権限も要らない。
--   ⚠️ ローカルの root では通ってしまうため、気づかずに書きがちである。
SHOW COLUMNS FROM `funding_plan`
 WHERE `Field` IN ('t_pref','t_city','t_station','t_budget','t_needTsubo','t_radius',
                   't_lat','t_lng','t_addr','t_muni','t_area','t_dist','lands');
