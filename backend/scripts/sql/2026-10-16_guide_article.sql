-- ===========================================================
-- 業務ガイド（guide_article / guide_history）
--
-- 2026-10-16 新規（v2.2.194）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規2表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   ヘッダー・アクティブユーザー・トップ画面の「業務ガイド」ボタンから
--   別ウインドウで開く記事（frontend/src/components/guide/Guide.tsx）。
--   用語・画面の使い方・業務の流れを、現場の人がブラウザ上で書き換えられるよう DB に置く。
--
--   guide_article … 記事（1行 = 1記事）
--   guide_history … 保存の直前の内容（⚠️ 保存のたびに1行積む。書き間違えたときに戻すため）
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **title は重複不可。** 本文の `[[タイトル]]` はタイトルで記事を探すため。
-- ⚠️ 記事は消さずに published = 0 で隠す（⚠️ 他の記事からのリンク先が消えないように）。
-- ⚠️ 編集できるのは authority が Master / BrandAdmin の人（② features/guide.ts で判定）。
-- ===========================================================

CREATE TABLE IF NOT EXISTS `guide_article` (
   `id`         INT          NOT NULL AUTO_INCREMENT
  ,`title`      VARCHAR(191) NOT NULL COMMENT '記事のタイトル（例: 契約したら（注文営業））。⚠️ [[ ]] リンクの照合キー'
  ,`division`   VARCHAR(16)  NOT NULL DEFAULT 'order' COMMENT '事業区分（order 注文営業 / spec 建売営業 / used 中古リノベ / common 共通）'
  ,`section`    VARCHAR(32)  NOT NULL DEFAULT '用語' COMMENT '分類（用語 / 画面の使い方 / 業務の流れ）'
  ,`summary`    VARCHAR(255) NOT NULL DEFAULT '' COMMENT '一覧に出す1行の説明'
  ,`body`       MEDIUMTEXT   NOT NULL COMMENT '本文（Markdown）。⚠️ 60,000 バイトまで（② で検査）'
  ,`sort`       INT          NOT NULL DEFAULT 0 COMMENT '分類の中の並び順（小さいほど上）'
  ,`published`  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1 = 出す / 0 = 隠す'
  ,`updated_by` VARCHAR(191) NOT NULL DEFAULT '' COMMENT '最後に保存した人（staff.name）'
  ,`created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,`updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ,PRIMARY KEY (`id`)
  ,UNIQUE KEY `uk_guide_article_title` (`title`)
  ,KEY `idx_guide_article_list` (`division`, `published`, `section`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='業務ガイドの記事（v2.2.194）';

CREATE TABLE IF NOT EXISTS `guide_history` (
   `no`         INT          NOT NULL AUTO_INCREMENT
  ,`article_id` INT          NOT NULL COMMENT 'guide_article.id'
  ,`title`      VARCHAR(191) NOT NULL
  ,`section`    VARCHAR(32)  NOT NULL
  ,`summary`    VARCHAR(255) NOT NULL DEFAULT ''
  ,`body`       MEDIUMTEXT   NOT NULL
  ,`published`  TINYINT(1)   NOT NULL DEFAULT 1
  ,`edited_by`  VARCHAR(191) NOT NULL DEFAULT '' COMMENT 'この内容を保存した人（＝上書きされる前の版を書いた人）'
  ,`edited_at`  DATETIME     NOT NULL COMMENT 'この内容が保存された日時（guide_article.updated_at の写し）'
  ,`saved_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '履歴に積んだ日時（＝上書きされた日時）'
  ,PRIMARY KEY (`no`)
  ,KEY `idx_guide_history_article` (`article_id`, `no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='業務ガイドの変更履歴（保存の直前の内容）';
