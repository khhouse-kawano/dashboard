-- =====================================================================
-- satbase_property: SatBase の物件台帳（中間加工）
--
-- ⚠️ 取り込み元: KHF物件管理【KHG】 - 中間加工（物件）.csv（2026-09-22 受領・1,910行）
--
-- ⚠️⚠️ **画面（SatBaseサマリー）から更新できるのは次の2列だけである。**
--   ⚠️ ad_posted / instagram_posted
--   ⚠️ ⚠️ **他の列は SatBase 側が正。** ⚠️ 画面から書き換えないこと。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================

CREATE TABLE IF NOT EXISTS satbase_property (
  property_id                INT(11)       NOT NULL COMMENT '物件ID。⚠️ 主キー。画面はこの値の降順で並べる',
  property_name              VARCHAR(128)  DEFAULT NULL COMMENT '物件名称。例: 2L国分重久ⅡG 2F',
  usage_type                 TINYINT(4)    DEFAULT NULL COMMENT '用途の区分（0〜5の数値。意味は SatBase 側の定義）',
  customer_name              VARCHAR(128)  DEFAULT NULL COMMENT 'お客様名。⚠️ 個人情報。契約済みの物件のみ入る',
  contract_staff             VARCHAR(64)   DEFAULT NULL COMMENT '契約担当者名',
  progress_status            VARCHAR(32)   DEFAULT NULL COMMENT '工程状況（着工前 / 建築中 / 完成済 / その他）',
  sales_status               VARCHAR(32)   DEFAULT NULL COMMENT '販売状況（契約済 / 引渡済 / モデルハウス / キャンセル 等）',
  area                       VARCHAR(64)   DEFAULT NULL COMMENT 'エリア（市区町村）',
  site_staff                 VARCHAR(64)   DEFAULT NULL COMMENT '現場管理・営業担当者名',
  design_staff               VARCHAR(64)   DEFAULT NULL COMMENT '設計担当者名',
  construction_staff         VARCHAR(64)   DEFAULT NULL COMMENT '施工管理担当者名',
  foundation_start_date      DATE          DEFAULT NULL COMMENT '基礎着工日。⚠️ 実データに 1970-01-01 が混ざっている（未入力の代わり）',
  completion_date            DATE          DEFAULT NULL COMMENT '完工日',
  exterior_completion_date   DATE          DEFAULT NULL COMMENT '外構完了日',
  payment_date               DATE          DEFAULT NULL COMMENT '入金日。⚠️ 実データに 1970-01-01 が混ざっている',
  delivery_date              DATE          DEFAULT NULL COMMENT '引渡日',
  land_cost                  INT(11)       DEFAULT NULL COMMENT '販売価格のうちの土地代（円）',
  sales_price                INT(11)       DEFAULT NULL COMMENT '販売価格（円）',
  contract_recorded_date     DATE          DEFAULT NULL COMMENT '契約計上日',
  land_id                    INT(11)       DEFAULT NULL COMMENT '土地ID（SatBase の土地台帳）',
  permit_date                DATE          DEFAULT NULL COMMENT '確認済証の許可日',
  property_id_general        INT(11)       DEFAULT NULL COMMENT '物件ID（一般）。⚠️ 実データでは property_id と同じ値',
  plan                       VARCHAR(32)   DEFAULT NULL COMMENT 'プラン名。例: 2A-5',
  ground_improvement         INT(11)       DEFAULT NULL COMMENT '地盤改良の費用（円）。0 は改良なし',
  price_changed_date         DATE          DEFAULT NULL COMMENT '販売価格を変更した日',
  previous_sales_price       INT(11)       DEFAULT NULL COMMENT '変更前の販売価格（円）',
  desired_start_date         DATE          DEFAULT NULL COMMENT '着工希望日',
  purchase_settlement_date   DATE          DEFAULT NULL COMMENT '仕入の決済日。⚠️ 2026-09-22 時点で全件空',
  purchase_contract_date     DATE          DEFAULT NULL COMMENT '仕入の契約日。⚠️ 2026-09-22 時点で全件空',
  lat_lng                    VARCHAR(64)   DEFAULT NULL COMMENT '位置情報（緯度,経度）。⚠️ 2026-09-22 時点で全件空',
  property_id_manager        INT(11)       DEFAULT NULL COMMENT 'ID（管理職）。⚠️ 実データでは property_id と同じ値',
  spec                       VARCHAR(32)   DEFAULT NULL COMMENT '仕様（ZEH水準 / 省エネ / その他）',
  prefecture                 VARCHAR(32)   DEFAULT NULL COMMENT '県。⚠️ 実データに #N/A が混ざっている',
  sales_period               VARCHAR(16)   DEFAULT NULL COMMENT '販売期間。⚠️ 「+0」「+12」のような符号付きの文字列で入っている',
  portal_posted_date         DATE          DEFAULT NULL COMMENT 'ポータルサイトへの掲載日',
  kaeru_hp_posted_date       DATE          DEFAULT NULL COMMENT 'かえるホームページへの掲載日',
  schedule_created           TINYINT(4)    DEFAULT NULL COMMENT '工程表を作成済みか（0 / 1）',
  team                       VARCHAR(32)   DEFAULT NULL COMMENT 'チーム（係）。例: 鹿児島係 / 大分係 / 土地仕入',
  ad_posted                  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '広告出稿状況。⚠️ 画面のトグルで更新する（0=未出稿 / 1=出稿済み）',
  instagram_posted           TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Instagram投稿状況。⚠️ 画面のトグルで更新する（0=未投稿 / 1=投稿済み）',
  updated                    DATETIME      DEFAULT NULL COMMENT '画面から最後に更新した日時（トグルのみ）',
  updated_by                 VARCHAR(128)  DEFAULT NULL COMMENT '画面から最後に更新したスタッフ名（トグルのみ）',
  PRIMARY KEY (property_id),
  KEY idx_sales_status (sales_status),
  KEY idx_progress_status (progress_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='SatBase の物件台帳（中間加工）';
