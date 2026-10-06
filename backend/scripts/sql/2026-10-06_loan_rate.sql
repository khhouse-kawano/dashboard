-- ===========================================================
-- 住宅ローン金利のマスタ（loan_product / loan_rate）
--
-- 2026-10-06 新規（v2.2.168）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規2表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   AIデジタル資金計画書（frontend/public/funding-plan/index.html）の
--   「⑨ 銀行金利比較」で使う金融機関別の住宅ローン金利。
--   これまでは HTML の中の配列 `LOANS`（33商品）に直接書かれており、
--   更新するには HTML を直してビルド・デプロイする必要があった。
--   DB に移し、Dashboard で更新・履歴の参照・他画面での2次利用ができるようにする。
--
--   loan_product … 商品（金融機関 × 商品）。⚠️ 金利を持たない
--   loan_rate    … 商品ごと・基準日ごとの金利。⚠️ 行を上書きせず**積み上げる**（履歴）
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **列名は HTML の `LOANS` のキーと1文字も違わない**（funding_plan と同じ方針）。
--   `fi` `pn` `feeMode` のような素っ気ない名前・camelCase だが意図的である。
--   画面へは `KHG_RATE_FEED`（applyFeed が読む形）でそのまま渡せ、変換表が要らない。
--   ⚠️ 列名を「分かりやすく」改名してはいけない。
--
-- ⚠️⚠️ **顧客の計画書の金利は、ここが変わっても動かない。**
--   計画書は保存時の金利を funding_plan.loans（JSON）に持つ。
--   過去の計画書の数字が後から変わらないための仕組みであり、
--   ここから funding_plan.loans を書き換える処理を作ってはいけない。
--
-- ⚠️ 「最新の金利」= 商品ごとに、確定済み（confirmed_at が入っている）行のうち
--   base_date が最も新しいもの。⚠️ 未確定の行（下書き）は計画書に出さない。
--   （人が確認する前の金利がお客様に出るのを防ぐ）
-- ===========================================================

CREATE TABLE IF NOT EXISTS `loan_product` (
   `id`    VARCHAR(64)  NOT NULL COMMENT '商品ID（LOANS の id。例: kagin / flat35）。⚠️ 変えると計画書の比較表と照合できなくなる'
  ,`g`     VARCHAR(64)  NOT NULL COMMENT '区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）'
  ,`fi`    VARCHAR(191) NOT NULL COMMENT '金融機関名（例: 鹿児島銀行）。⚠️ 一括更新（金融機関名=金利）の照合キーにもなる'
  ,`pn`    VARCHAR(191) NOT NULL COMMENT '商品名（例: 住宅ローン（変動））'
  ,`type`  VARCHAR(8)   NOT NULL DEFAULT 'v' COMMENT '金利タイプ。v = 変動 / f = 固定'
  ,`url`   VARCHAR(255)     NULL COMMENT '公式サイト'
  ,`sort`  INT          NOT NULL DEFAULT 0 COMMENT '並び順（小さいほど上）'
  ,`active` TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '1 = 計画書に出す / 0 = 出さない（⚠️ 行は消さない。過去の金利の参照元になるため）'
  ,`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ,PRIMARY KEY (`id`)
  ,KEY `idx_loan_product_sort` (`active`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='住宅ローン商品（AIデジタル資金計画書 ⑨銀行金利比較）。金利は loan_rate';

CREATE TABLE IF NOT EXISTS `loan_rate` (
   `no`        INT          NOT NULL AUTO_INCREMENT
  ,`id`        VARCHAR(64)  NOT NULL COMMENT '商品ID（loan_product.id）'
  ,`base_date` DATE         NOT NULL COMMENT '基準日（この金利をいつ時点のものとして登録したか）。⚠️ HTML の ln_asof にあたる'
  ,`rate`      DECIMAL(6,3) NOT NULL COMMENT '金利（%）。例: 0.875'
  ,`asof`      VARCHAR(16)      NULL COMMENT '金融機関側の適用月の表記（LOANS の asof。例: 2026/8）'
  ,`fee`       VARCHAR(191)     NULL COMMENT '事務手数料の表記（例: 借入額×2.2%）'
  ,`feeMode`   VARCHAR(16)  NOT NULL DEFAULT 'fixed' COMMENT 'rate = 借入額×feeVal% / fixed = feeVal 円'
  ,`feeVal`    DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '事務手数料の値（feeMode による。% または 円）'
  ,`hosho`     VARCHAR(191)     NULL COMMENT '保証料の表記'
  ,`hoshoVal`  DECIMAL(14,3) NOT NULL DEFAULT 0 COMMENT '保証料（円）。⚠️ 試算では事務手数料に足される'
  ,`dan`       VARCHAR(191)     NULL COMMENT '団信の表記'
  ,`note`      TEXT             NULL COMMENT '備考（優遇条件など）'
  ,`warn`      TEXT             NULL COMMENT '注意書き（画面で目立たせる）'
  ,`source`    VARCHAR(191)     NULL COMMENT '出典（例: 各金融機関公式サイト（2026年8月時点））。⚠️ HTML の ln_source にあたる'
  ,`confirmed_at` DATETIME      NULL COMMENT '確定日時。⚠️ NULL の行は下書きで、計画書には出さない'
  ,`confirmed_by` VARCHAR(191)  NULL COMMENT '確定した人（staff の名前）'
  ,`created_by`   VARCHAR(191)  NULL COMMENT '登録した人（staff の名前。初期投入は system）'
  ,`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ,PRIMARY KEY (`no`)
  ,UNIQUE KEY `uq_loan_rate_product_date` (`id`, `base_date`)
  ,KEY `idx_loan_rate_date` (`base_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='住宅ローン金利の履歴（商品×基準日）。⚠️ 上書きせず積み上げる';

-- ⚠️ 確認（⚠️ ① では information_schema が使えないので SHOW を使う）
SHOW CREATE TABLE loan_product;
SHOW CREATE TABLE loan_rate;
