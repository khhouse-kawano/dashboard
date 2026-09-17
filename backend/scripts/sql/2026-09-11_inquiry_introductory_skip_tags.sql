-- ===========================================================
-- inquiry_introductory に「同期不要」の判定列を追加
--
-- 2026-09-11
--
-- ─────────────────────────────────────────────
-- 何のための列か
--
--   反響の中には**顧客として取り込むべきでない**ものが混ざる。
--
--     重複客           … 既に台帳にいる。取り込むと二重になる
--     ブラックリスト客 … 取り込んではいけない
--
--   これまでは取り込まないまま「未同期」に残り続けるため、
--   ⚠️ **本当に対応が必要な未同期と見分けがつかなかった。**
--   処理済みの印を付けて一覧から外せるようにする。
--
--   画面: frontend/src/components/header/InquiryIntroductory.tsx
--         「同期」ボタンの右の「重複」「ブラックリスト」タブ
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **タグを付けると `sync` も 1 になる。** それが未同期一覧から外す仕組み。
--   ⚠️ ただし `master_data_id` は **NULL のまま**である。
--     顧客は作られていない。ここが本当の同期済みとの違いである。
--
--   ⚠️ 「同期済み」と「同期不要」を見分けるには `master_data_id` を見ること。
--     `sync = 1` だけで判断すると、顧客が作られていない行まで
--     「取り込み済み」として数えてしまう。
--
--       本当に同期済み … sync = 1 かつ master_data_id IS NOT NULL
--       同期不要       … sync = 1 かつ duplicate_tag = 1 または blacklist_tag = 1
--
-- ⚠️ タグは画面から解除できる（解除すると sync = 0 に戻る）。
--   ⚠️ **解除できるのは master_data_id が NULL の行だけ**である。
--     顧客が作られた行の sync を 0 に戻すと、次に同期を押したときに
--     **顧客が二重に作られる**。サーバー側でも拒否している。
--
-- 実行順: このファイル単体で完結。
-- 冪等性: ⚠️ ADD COLUMN に IF NOT EXISTS を付けている（MariaDB 10.0+）。
--         二重実行しても落ちない。既存行の値は変えない。
-- ===========================================================

ALTER TABLE `inquiry_introductory`
  ADD COLUMN IF NOT EXISTS `duplicate_tag` TINYINT DEFAULT 0 COMMENT '重複客',
  ADD COLUMN IF NOT EXISTS `blacklist_tag` TINYINT DEFAULT 0 COMMENT 'ブラックリスト客';

-- ===========================================================
-- 確認
-- ===========================================================
-- ⚠️⚠️ **information_schema は使わない。**
--   ① レンタルサーバー（Xserver 共用）の DB ユーザーには参照権限が無く
--     #1044 - ... 'information_schema' データベースへのアクセスを拒否します
--   になる。SHOW COLUMNS なら権限が要らない。
SHOW COLUMNS FROM `inquiry_introductory` WHERE `Field` IN ('duplicate_tag', 'blacklist_tag');

-- 現在の内訳。⚠️ 追加直後は「同期不要」が 0 件であること。
SELECT
    COUNT(*)                                                             AS `全件`,
    SUM(CASE WHEN `sync` = 1 AND `master_data_id` IS NOT NULL THEN 1 ELSE 0 END) AS `同期済み`,
    SUM(CASE WHEN `duplicate_tag` = 1 THEN 1 ELSE 0 END)                 AS `重複`,
    SUM(CASE WHEN `blacklist_tag` = 1 THEN 1 ELSE 0 END)                 AS `ブラックリスト`,
    SUM(CASE WHEN `sync` <> 1 THEN 1 ELSE 0 END)                         AS `未同期`
  FROM `inquiry_introductory`;

-- ⚠️ 0行であることを確認する。
--   ここに行が出たら、顧客が作られているのにタグが付いている矛盾した状態である。
SELECT `no`, `friendName`, `sync`, `master_data_id`, `duplicate_tag`, `blacklist_tag`
  FROM `inquiry_introductory`
 WHERE `master_data_id` IS NOT NULL
   AND (`duplicate_tag` = 1 OR `blacklist_tag` = 1);
