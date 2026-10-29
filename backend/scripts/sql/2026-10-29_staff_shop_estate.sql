-- =====================================================================
-- v2.2.227 担当事業（staff.shop）の差し替え: 建売（spec）と以前の不動産企画係アプリのユーザーを estate にまとめる
--
-- estate ＝ 建売・中古・不動産企画係の3つに入れる（frontend/src/utils/shopAccess.ts）。
-- 対象:
--   1. 担当事業が spec（建売）・realty（不動産企画係）の人
--   2. 以前の不動産企画係アプリ（khf-eigyokanri）の担当者（取り込んだ設定の担当者）。氏名の空白は無視して突き合わせる
-- ⚠️ 全事業（all）の人は変えない（権限が狭くなるため）。⚠️ estate の人はそのまま
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ v2.2.227 の ② と ① PHP・フロントを出したあとに流す
--   （先に流すと、estate の人が事業を選ぶ画面で「閲覧権限がありません」になる）
-- ⚠️ 戻すときは 2026-10-29_staff_shop_estate_restore.sql（控えの表 staff_shop_bk_227 から戻す）
-- =====================================================================

-- 1) 流す前の確認（対象の人と今の担当事業）。⚠️ ここで人数と顔ぶれを確かめてから 2) へ
SELECT id, name, brand, shop AS 今の担当事業
  FROM staff
 WHERE shop <> 'all' AND shop <> 'estate'
   AND (shop IN ('spec', 'realty')
        OR REPLACE(REPLACE(name, ' ', ''), '　', '') IN ('時任聡一朗', '宮城智一', '永田倫也', '岡崎真夕'))
 ORDER BY shop, id;

-- 2) 控え（対象の人の id と今の担当事業）。⚠️ 前の控えは作り直す（控えの表だけ。staff には触らない）
DROP TABLE IF EXISTS staff_shop_bk_227;
CREATE TABLE staff_shop_bk_227 AS
SELECT id, name, shop
  FROM staff
 WHERE shop <> 'all' AND shop <> 'estate'
   AND (shop IN ('spec', 'realty')
        OR REPLACE(REPLACE(name, ' ', ''), '　', '') IN ('時任聡一朗', '宮城智一', '永田倫也', '岡崎真夕'));

-- 3) 差し替え（控えにある人だけ）
UPDATE staff s JOIN staff_shop_bk_227 b ON b.id = s.id SET s.shop = 'estate';

-- 4) 確認: 担当事業ごとの人数（spec・realty が 0 になり、estate が控えの人数と同じならよい）
SELECT shop AS 担当事業, COUNT(*) AS 人数 FROM staff GROUP BY shop ORDER BY shop;
SELECT COUNT(*) AS 控えの人数 FROM staff_shop_bk_227;
