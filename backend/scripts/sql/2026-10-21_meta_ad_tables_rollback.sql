-- v2.2.203 の Meta 広告の表を消す（⚠️ 取り込んだ数字が消える。② の取り込みは META_ACCESS_TOKEN を空にすれば止まる）
DROP TABLE IF EXISTS meta_ad_daily;
DROP TABLE IF EXISTS meta_ad_items;
