-- v2.2.205 の CV の表と、かえるホームの反響の landing_params を消す（⚠️ 結びつけた記録が消える）
DROP TABLE IF EXISTS tracking_conversions;
ALTER TABLE inquiry_customer_kaeru DROP COLUMN IF EXISTS landing_params;
ALTER TABLE master_data_kaeru DROP COLUMN IF EXISTS landing_params;
