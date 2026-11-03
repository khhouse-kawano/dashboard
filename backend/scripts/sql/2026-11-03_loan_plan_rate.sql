-- ===========================================================
-- 商圏内の金融機関のプラン別金利（loan_plan_rate）
--
-- 2026-11-03 新規（v2.2.240）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規1表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   Claude デスクトップが毎月集める plan_rates_YYYY-MM.csv（金融機関 × プラン × 期間 × 手数料の型 × 団信、約1,100行）。
--   画面はヘッダーの「金利データ」（frontend/src/components/header/LoanRates.tsx）。
--   ⚠️ 資金計画書の金利（loan_product / loan_rate。商品単位・33商品）とは**別物**。
--     ⚠️ ここを変えても資金計画書の金利は動かない（つなげていない）。
--
--   ⚠️ 月ごとに**丸ごと入れ替える**（同じ月をもう一度登録したら、その月の行を全部消して入れ直す）。
--   ⚠️ 列名は CSV の見出しと同じ（`g` `fi` `rtype` `feeType` …）。⚠️ 改名しないこと（CSV をそのまま入れるため）。
--   ⚠️ 毎月の分析レポート（HTML）は analysis_report に category = 'loan_rate'・period = 'YYYY-MM' で入れる（新しい表は作らない）。
-- ─────────────────────────────────────────────
-- ===========================================================

CREATE TABLE IF NOT EXISTS `loan_plan_rate` (
   `no`       INT          NOT NULL AUTO_INCREMENT
  ,`month`    CHAR(7)      NOT NULL COMMENT '対象月（YYYY-MM。CSV のファイル名の月）'
  ,`line`     INT          NOT NULL COMMENT 'CSV の行番号（見出しを1行目として数える）。⚠️ 並びを CSV と同じに保つため'
  ,`g`        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）'
  ,`id`       VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '商品ID（loan_product.id と同じ体系。例: kagin）'
  ,`fi`       VARCHAR(191) NOT NULL DEFAULT '' COMMENT '金融機関名'
  ,`plan`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'プラン名'
  ,`rtype`    VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '金利タイプ（変動 / 固定期間選択 / 全期間固定）'
  ,`term`     VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '固定期間（年）。変動は空'
  ,`feeType`  VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '手数料・保証料の型（手数料定率 / 保証料一括 …）'
  ,`dan`      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '団信（一般 / がん / 8大疾病 …）'
  ,`cond`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '条件（どの金利を採ったか）'
  ,`rate`     DECIMAL(6,3)     NULL COMMENT '適用金利（%）。⚠️ 空なら NULL'
  ,`base`     DECIMAL(6,3)     NULL COMMENT '店頭（基準）金利（%）'
  ,`prev`     DECIMAL(6,3)     NULL COMMENT '前月の適用金利（%）。⚠️ 前月に無いプランは NULL'
  ,`asof`     VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '金融機関側の適用日（例: 2026/11/02）'
  ,`url`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '出典の URL'
  ,`conf`     VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '値の確かさ（official = 公式 / calc = 計算 / comparison = 比較サイト）'
  ,`created_by` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登録した人（初期データは seed）'
  ,`created_at` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,PRIMARY KEY (`no`)
  ,UNIQUE KEY `uq_loan_plan_rate_line` (`month`, `line`)
  ,KEY `idx_loan_plan_rate_fi` (`month`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='商圏内の金融機関のプラン別金利（月ごと）。画面: header/LoanRates.tsx';

-- 確認（⚠️ 0行で作られていればよい。初期データは 2026-11-03_loan_plan_rate_seed.sql）
SELECT COUNT(*) AS loan_plan_rate_rows FROM loan_plan_rate;
