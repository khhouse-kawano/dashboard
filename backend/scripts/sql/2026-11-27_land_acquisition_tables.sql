-- =====================================================================
-- v2.2.311 土地仕入（仕入KPI管理 v7.3 の移行）のテーブル
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ update_log の SQL より先に流す
-- ⚠️ 何度流しても壊れない（CREATE TABLE IF NOT EXISTS・初期値は INSERT IGNORE）
-- ⚠️ 移行元のデータ（案件・業者・アプローチなど）は入れない。画面の「仕入設定 → 移行元から取り込む」で JSON を読む
--
-- 担当者は名前ではなく land_member.id で持つ（改名しても過去の記録が離れない）。
-- 日付は DATE（移行元は空文字 "" のことがある → NULL）。金額は万円。
-- =====================================================================

CREATE TABLE IF NOT EXISTS land_area (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL COMMENT 'エリア名（保存値）',
  label VARCHAR(40) NOT NULL DEFAULT '' COMMENT '表示名（空なら name）',
  sort INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_area_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: エリア';

CREATE TABLE IF NOT EXISTS land_member (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL COMMENT '担当者名（移行元の表記。例 松窪）',
  area_id INT NULL COMMENT 'land_area.id（NULL はその他）',
  staff_id INT NULL COMMENT 'Dashboard のログインのスタッフ（staff.id）。ログインした人を自分の担当にする',
  active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0=停止中（過去の記録は残す）',
  sort INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_member_name (name),
  KEY idx_land_member_staff (staff_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 担当者';

CREATE TABLE IF NOT EXISTS land_kpi_def (
  id INT NOT NULL AUTO_INCREMENT,
  kpi_key VARCHAR(30) NOT NULL COMMENT 'KPI のキー（目標・手入力実績の kpi_key）',
  label VARCHAR(40) NOT NULL,
  unit VARCHAR(10) NOT NULL DEFAULT '件',
  calc VARCHAR(10) NOT NULL DEFAULT 'manual' COMMENT 'auto=記録から自動で数える（＋手入力） / manual=手入力だけ',
  description VARCHAR(255) NOT NULL DEFAULT '' COMMENT '数え方の説明',
  sort INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_kpi_def_key (kpi_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: KPI の定義';

CREATE TABLE IF NOT EXISTS land_target (
  id INT NOT NULL AUTO_INCREMENT,
  period_type VARCHAR(10) NOT NULL COMMENT 'month=月間目標 / year=年間目標',
  period VARCHAR(7) NOT NULL COMMENT 'month は YYYY-MM、year は年度の始まりの年（YYYY）',
  member_id INT NOT NULL,
  kpi_key VARCHAR(30) NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_target (period_type, period, member_id, kpi_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 目標（担当×期間×KPI）';

CREATE TABLE IF NOT EXISTS land_manual_actual (
  id INT NOT NULL AUTO_INCREMENT,
  ym VARCHAR(7) NOT NULL COMMENT 'YYYY-MM',
  member_id INT NOT NULL,
  kpi_key VARCHAR(30) NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '自動で数えた実績に足す件数（manual の KPI はこれだけ）',
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_manual_actual (ym, member_id, kpi_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 手入力の実績';

CREATE TABLE IF NOT EXISTS land_source (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL COMMENT '反響ソースの名前',
  kind VARCHAR(30) NOT NULL DEFAULT '' COMMENT '種類（業者・ポータル・自社サイト など。自由）',
  memo VARCHAR(255) NOT NULL DEFAULT '',
  sort INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_source_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 反響ソース（これから設定）';

CREATE TABLE IF NOT EXISTS land_option (
  id INT NOT NULL AUTO_INCREMENT,
  list_key VARCHAR(30) NOT NULL COMMENT '選択肢の種類（deal_kind・ap_type・reaction・lost_reason・deal_terms・vendor_kind・reply_result・phase・bottleneck）',
  value VARCHAR(80) NOT NULL,
  sort INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_option (list_key, value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 選択肢';

CREATE TABLE IF NOT EXISTS land_setting (
  setting_key VARCHAR(40) NOT NULL,
  setting_value VARCHAR(255) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 設定';

CREATE TABLE IF NOT EXISTS land_vendor (
  id INT NOT NULL AUTO_INCREMENT,
  legacy_id VARCHAR(32) NULL COMMENT '移行元の id',
  name VARCHAR(120) NOT NULL COMMENT '業者名',
  vkind VARCHAR(30) NOT NULL DEFAULT '' COMMENT '区分（不動産業者・建設・工務店など）',
  contact VARCHAR(60) NOT NULL DEFAULT '' COMMENT '先方の担当者名',
  tel VARCHAR(40) NOT NULL DEFAULT '',
  email VARCHAR(120) NOT NULL DEFAULT '',
  area VARCHAR(60) NOT NULL DEFAULT '' COMMENT '業者のエリア（自由）',
  addr VARCHAR(200) NOT NULL DEFAULT '',
  url VARCHAR(300) NOT NULL DEFAULT '',
  owner_member_id INT NULL COMMENT '社内担当（land_member.id）',
  vendor_rank CHAR(1) NOT NULL DEFAULT '' COMMENT 'A〜E',
  temp VARCHAR(4) NOT NULL DEFAULT '' COMMENT '温度感 ◎〇△✕',
  last_visit DATE NULL,
  buy_count INT NOT NULL DEFAULT 0 COMMENT '買取数（手入力・過去実績）。決済完了の案件の区画は別に数える',
  memo TEXT NULL,
  delete_flag TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(60) NOT NULL DEFAULT '',
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_vendor_legacy (legacy_id),
  KEY idx_land_vendor_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 業者マスタ';

CREATE TABLE IF NOT EXISTS land_approach (
  id INT NOT NULL AUTO_INCREMENT,
  legacy_id VARCHAR(32) NULL,
  ap_date DATE NOT NULL,
  ap_time VARCHAR(5) NOT NULL DEFAULT '',
  member_id INT NULL,
  vendor_id INT NULL COMMENT 'land_vendor.id',
  vendor_name VARCHAR(120) NOT NULL DEFAULT '',
  ap_type VARCHAR(20) NOT NULL DEFAULT '訪問' COMMENT '訪問・架電・受電・メール・FAX・直案件・業者持込',
  contact VARCHAR(60) NOT NULL DEFAULT '' COMMENT '訪問先・架電先の担当者名',
  reaction VARCHAR(30) NOT NULL DEFAULT '',
  info_count INT NOT NULL DEFAULT 0 COMMENT 'このアプローチで得た土地情報の件数',
  memo TEXT NULL COMMENT '取得情報',
  address VARCHAR(200) NOT NULL DEFAULT '',
  map_url VARCHAR(500) NOT NULL DEFAULT '',
  land_m2 DECIMAL(10,2) NULL,
  is_candidate TINYINT(1) NOT NULL DEFAULT 0 COMMENT '案件候補（案件化待ち）',
  source_id INT NULL COMMENT 'land_source.id（これから設定）',
  delete_flag TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(60) NOT NULL DEFAULT '',
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_approach_legacy (legacy_id),
  KEY idx_land_approach_date (ap_date),
  KEY idx_land_approach_vendor (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: アプローチ（1件ずつ）';

CREATE TABLE IF NOT EXISTS land_daily_count (
  id INT NOT NULL AUTO_INCREMENT,
  legacy_id VARCHAR(32) NULL,
  count_date DATE NOT NULL,
  member_id INT NULL,
  cnt_visit INT NOT NULL DEFAULT 0,
  cnt_call INT NOT NULL DEFAULT 0,
  cnt_recv INT NOT NULL DEFAULT 0,
  cnt_mail INT NOT NULL DEFAULT 0,
  cnt_fax INT NOT NULL DEFAULT 0,
  cnt_direct INT NOT NULL DEFAULT 0,
  cnt_bring INT NOT NULL DEFAULT 0,
  cnt_info INT NOT NULL DEFAULT 0 COMMENT '情報取得の件数',
  note VARCHAR(500) NOT NULL DEFAULT '',
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_daily_count_legacy (legacy_id),
  KEY idx_land_daily_count_date (count_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: まとめ入力（件数だけ）';

CREATE TABLE IF NOT EXISTS land_report (
  id INT NOT NULL AUTO_INCREMENT,
  legacy_id VARCHAR(32) NULL,
  report_date DATE NOT NULL,
  member_id INT NULL,
  done TEXT NULL COMMENT '本日の活動',
  info TEXT NULL COMMENT '取得情報・進捗',
  issue TEXT NULL COMMENT '課題・相談事項',
  next_plan TEXT NULL COMMENT '明日の予定',
  created_by VARCHAR(60) NOT NULL DEFAULT '',
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_report_legacy (legacy_id),
  KEY idx_land_report_date (report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 簡易日報';

CREATE TABLE IF NOT EXISTS land_deal (
  id INT NOT NULL AUTO_INCREMENT,
  legacy_id VARCHAR(32) NULL,
  member_id INT NULL,
  kind VARCHAR(20) NOT NULL DEFAULT '新規開拓' COMMENT '新規開拓・既存持込',
  vendor_id INT NULL COMMENT '情報取得元の業者（land_vendor.id）',
  vendor_name VARCHAR(120) NOT NULL DEFAULT '',
  address VARCHAR(200) NOT NULL DEFAULT '' COMMENT '物件所在地',
  map_url VARCHAR(500) NOT NULL DEFAULT '',
  lots INT NOT NULL DEFAULT 0 COMMENT '区画数',
  land_m2 DECIMAL(10,2) NULL COMMENT '土地面積（㎡）',
  price DECIMAL(12,1) NULL COMMENT '想定仕入価格（万円）',
  seller_name VARCHAR(120) NOT NULL DEFAULT '',
  agent_name VARCHAR(120) NOT NULL DEFAULT '' COMMENT '媒介業者名',
  buy_price DECIMAL(12,1) NULL COMMENT '購入金額（万円）',
  terms VARCHAR(30) NOT NULL DEFAULT '' COMMENT '契約条件',
  terms_memo VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT '情報取得' COMMENT '情報取得・社長提案・買付・契約・決済完了・見送り',
  info_date DATE NULL COMMENT '情報取得日',
  prop_date DATE NULL COMMENT '社長提案日',
  offer_date DATE NULL COMMENT '買付日',
  contract_date DATE NULL COMMENT '契約日（現場）',
  settle_date DATE NULL COMMENT '決済日（ゴール）',
  memo TEXT NULL COMMENT '概要メモ',
  sim_sales DECIMAL(12,1) NULL COMMENT '想定総販売価格（万円）',
  sim_build DECIMAL(12,1) NULL COMMENT '想定建築費（万円）',
  sim_demolition DECIMAL(12,1) NULL COMMENT '予想解体・造成費（万円）',
  sim_expense_rate DECIMAL(5,2) NOT NULL DEFAULT 5 COMMENT '諸経費率（%）',
  sim_profit_rate DECIMAL(5,2) NOT NULL DEFAULT 15 COMMENT '目標利益率（%）',
  offer_to VARCHAR(120) NOT NULL DEFAULT '' COMMENT '買付提出先',
  reply_due DATE NULL COMMENT '返答期日',
  reply_result VARCHAR(20) NOT NULL DEFAULT '' COMMENT '承諾・否決・保留・再交渉（空＝返答待ち）',
  reply_date DATE NULL COMMENT '回答日',
  reply_memo VARCHAR(500) NOT NULL DEFAULT '',
  lost_reason VARCHAR(30) NOT NULL DEFAULT '',
  lost_memo VARCHAR(500) NOT NULL DEFAULT '',
  ap_id INT NULL COMMENT '発生元のアプローチ（land_approach.id）',
  source_id INT NULL COMMENT 'land_source.id（これから設定）',
  delete_flag TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(60) NOT NULL DEFAULT '',
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_deal_legacy (legacy_id),
  KEY idx_land_deal_status (status),
  KEY idx_land_deal_member (member_id),
  KEY idx_land_deal_vendor (vendor_id),
  KEY idx_land_deal_ap (ap_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 仕入案件';

CREATE TABLE IF NOT EXISTS land_review (
  id INT NOT NULL AUTO_INCREMENT,
  ym VARCHAR(7) NOT NULL,
  member_id INT NOT NULL,
  phase VARCHAR(80) NOT NULL DEFAULT '' COMMENT '育成フェーズ',
  bottleneck VARCHAR(80) NOT NULL DEFAULT '',
  good TEXT NULL COMMENT '良かった事（本人）',
  theme TEXT NULL COMMENT '重点課題（翌月テーマ）',
  comment TEXT NULL COMMENT '上長コメント',
  updated_by VARCHAR(60) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_land_review (ym, member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 月次レビュー';

CREATE TABLE IF NOT EXISTS land_stock (
  id INT NOT NULL AUTO_INCREMENT,
  fy INT NOT NULL COMMENT '年度（6月始まりの年）',
  member_id INT NULL,
  area_name VARCHAR(60) NOT NULL DEFAULT '' COMMENT '詳細エリア（霧島市など）',
  proper INT NOT NULL DEFAULT 0 COMMENT '適正在庫',
  stock INT NOT NULL DEFAULT 0 COMMENT '在庫',
  sales INT NOT NULL DEFAULT 0 COMMENT '販売',
  sort INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_land_stock_fy (fy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 適正在庫';

CREATE TABLE IF NOT EXISTS land_audit (
  id INT NOT NULL AUTO_INCREMENT,
  at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_name VARCHAR(60) NOT NULL DEFAULT '',
  act VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'create・update・delete・status・reply・lost・daily・report・target・member・import・system',
  target VARCHAR(30) NOT NULL DEFAULT '' COMMENT '対象（案件・業者など）',
  name VARCHAR(200) NOT NULL DEFAULT '' COMMENT '対象の名前',
  note VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_land_audit_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='土地仕入: 更新履歴';

-- ---------------------------------------------------------------
-- 初期値（⚠️ INSERT IGNORE。画面で直した値は上書きしない）
-- ---------------------------------------------------------------
INSERT IGNORE INTO land_area (name, label, sort) VALUES
('鹿児島都城エリア', '鹿児島（都城）エリア', 1),
('熊本エリア', '', 2),
('宮崎エリア', '', 3),
('大分エリア', '', 4);

INSERT IGNORE INTO land_kpi_def (kpi_key, label, unit, calc, description, sort) VALUES
('ap', '業者AP', '件', 'auto', 'アプローチ1件ずつの記録＋まとめ入力の件数', 1),
('info', '情報取得', '件', 'auto', '案件の情報取得日＋アプローチ・まとめ入力の情報取得数（案件にした分は引く）', 2),
('prop', '社長提案', '件', 'auto', '案件の社長提案日', 3),
('offer', '買付', '件', 'auto', '案件の買付日', 4),
('contract', '契約', '件', 'auto', '案件の契約日', 5),
('lots', '仕入区画', '区画', 'auto', '契約日が入った案件の区画数', 6);

INSERT IGNORE INTO land_option (list_key, value, sort) VALUES
('deal_kind', '新規開拓', 1), ('deal_kind', '既存持込', 2),
('ap_type', '訪問', 1), ('ap_type', '架電', 2), ('ap_type', '受電', 3), ('ap_type', 'メール', 4),
('ap_type', 'FAX', 5), ('ap_type', '直案件', 6), ('ap_type', '業者持込', 7),
('reaction', '情報あり（有望）', 1), ('reaction', '前向き', 2), ('reaction', '普通', 3),
('reaction', '不在・不通', 4), ('reaction', '反応なし', 5),
('reply_result', '承諾', 1), ('reply_result', '否決', 2), ('reply_result', '保留・再交渉', 3),
('lost_reason', '価格不一致', 1), ('lost_reason', 'スピード負け', 2), ('lost_reason', '工事コスト過大', 3),
('lost_reason', '法規制・土地問題', 4), ('lost_reason', '売主都合', 5), ('lost_reason', 'その他', 6),
('deal_terms', '更地渡し', 1), ('deal_terms', '測量渡し', 2), ('deal_terms', '古家付', 3), ('deal_terms', '現況渡し', 4),
('deal_terms', '解体更地渡し', 5), ('deal_terms', '境界明示', 6), ('deal_terms', 'そのまま引渡し', 7), ('deal_terms', 'その他', 8),
('vendor_kind', '不動産業者', 1), ('vendor_kind', '建設・工務店', 2), ('vendor_kind', '金融機関', 3),
('vendor_kind', '士業', 4), ('vendor_kind', '個人・地主', 5), ('vendor_kind', 'その他', 6),
('phase', 'フェーズ1 基礎学習・業務理解', 1), ('phase', 'フェーズ2 行動量・関係構築', 2),
('phase', 'フェーズ3 案件選別・相場把握', 3), ('phase', 'フェーズ4 プランニング・買付提案', 4),
('phase', 'フェーズ5 クロージング・契約実務', 5), ('phase', 'フェーズ6 決済・案件完遂', 6),
('bottleneck', '訪問量不足', 1), ('bottleneck', '関係構築の浅さ', 2), ('bottleneck', 'キーマン接触不足', 3),
('bottleneck', '情報収集量不足', 4), ('bottleneck', 'ヒアリング不足（深掘り）', 5), ('bottleneck', '相場観のズレ', 6),
('bottleneck', '接道・法規の知識不足', 7), ('bottleneck', '解体造成費の読みの甘さ', 8), ('bottleneck', 'プラン配置の引き出し不足', 9),
('bottleneck', '案件選別の甘さ', 10), ('bottleneck', '提案スピード・精度', 11), ('bottleneck', '買付金額の判断力', 12),
('bottleneck', 'クロージング・交渉力不足', 13), ('bottleneck', '契約実務の知識不足', 14), ('bottleneck', '士業への手配・進捗管理不足', 15),
('bottleneck', '社内部署への進捗共有・連携不足', 16), ('bottleneck', '書類管理・決済後事務処理のルーズさ', 17),
('bottleneck', 'タスクの優先順位付けの甘さ', 18), ('bottleneck', '全体的な行動量不足', 19);

INSERT IGNORE INTO land_setting (setting_key, setting_value) VALUES
('fy_start', '2026'),
('alert_lead_days', '7'),
('alert_warn_days', '3');
