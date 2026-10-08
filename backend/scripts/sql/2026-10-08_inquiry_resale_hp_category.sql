-- =====================================================================
-- v2.2.175（任意）: 中古住宅専門店の来場予約（GAS → reserve_resale_update）で
--   すでに取り込まれ、category が空のままの反響に 買い:中古リノベ を入れる
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 流すかどうかは利用者が決める（⚠️ 流さなくても、これから届く予約には入る）。
-- ⚠️ 対象は inquiry_id が hp_resale_ で始まり、category が空の行だけ。
--   ⚠️ 既に値が入っている行（手で入れた 買い:中古リノベ など）は触らない。
-- ⚠️ ローカルでは 8件（2026/06/28〜2026/09/09・すべて未同期）。
--   ⚠️ 要確認の中古の未同期は 2026/08 以降だけ数えるので、出てくるのはそのうち 2026/08 以降の分。
-- =====================================================================

-- 確認（流す前に件数を見る）
SELECT COUNT(*) AS target
  FROM inquiry_customer_resale
 WHERE inquiry_id LIKE 'hp\_resale\_%'
   AND TRIM(COALESCE(category, '')) = '';

UPDATE inquiry_customer_resale
   SET category = '買い:中古リノベ'
 WHERE inquiry_id LIKE 'hp\_resale\_%'
   AND TRIM(COALESCE(category, '')) = '';
