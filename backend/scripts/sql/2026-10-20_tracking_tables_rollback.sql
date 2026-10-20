-- =====================================================================
-- 広告流入トラッキング（v2.2.199）を戻す：2026-10-20_tracking_tables.sql で作った表を消す
--
-- ⚠️⚠️ **着地の記録（tracking_touches）とサイトの登録（tracking_sites）が消える。** 戻せない。
-- ⚠️ 既存の表（inquiry_customer の landing_params など）には触らない。
-- ⚠️ 先に各サイトのフッターからタグを外すこと（外さないと ② が「サイトが無い」と毎回ログに出す。表示には影響しない）。
-- =====================================================================

DROP TABLE IF EXISTS tracking_touches;
DROP TABLE IF EXISTS tracking_sites;
