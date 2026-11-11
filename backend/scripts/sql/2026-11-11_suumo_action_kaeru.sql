-- =====================================================================
-- v2.2.263 SUUMO（建売）の反響を、顧客ごとではなく反響ごとに取り込む ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ 表の作成は IF NOT EXISTS なので、2回流しても表は壊れない（更新履歴だけ増える）
-- =====================================================================

-- 1. 反響ごとの表（SUUMO の「反響」画面の CSV。1行 = 1つの反響）
--    ⚠️ action_id は CSV の「予約ID」か「反響ID」（どちらか一方だけが入る。形が違うので重ならない）
--    ⚠️ customer_id は ② が結ぶ（suumo_db_kaeru の顧客ID。結べなければ NULL）
CREATE TABLE IF NOT EXISTS suumo_action_kaeru (
  no INT NOT NULL AUTO_INCREMENT,
  action_id VARCHAR(64) NOT NULL COMMENT '予約ID または 反響ID',
  action_kind VARCHAR(16) NOT NULL COMMENT 'reserve（予約ID）/ inquiry（反響ID）',
  received_at VARCHAR(32) DEFAULT NULL COMMENT '受付日時',
  reaction_type VARCHAR(64) DEFAULT NULL COMMENT '反響種別',
  name VARCHAR(128) DEFAULT NULL,
  name_kana VARCHAR(128) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  email VARCHAR(128) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  fax VARCHAR(32) DEFAULT NULL,
  staff VARCHAR(128) DEFAULT NULL COMMENT 'お客様担当',
  reserve_status VARCHAR(64) DEFAULT NULL COMMENT '予約ステータス（確定・キャンセル）',
  guide_at VARCHAR(32) DEFAULT NULL COMMENT '案内日時',
  other_wish VARCHAR(255) DEFAULT NULL COMMENT 'その他のご希望日時',
  meeting_place VARCHAR(255) DEFAULT NULL COMMENT '集合場所',
  message TEXT DEFAULT NULL COMMENT '連絡事項',
  canceled_at VARCHAR(32) DEFAULT NULL COMMENT 'キャンセル日時',
  cancel_route VARCHAR(64) DEFAULT NULL COMMENT 'キャンセル経路',
  cancel_reason VARCHAR(255) DEFAULT NULL COMMENT 'キャンセル理由',
  property_type VARCHAR(64) DEFAULT NULL,
  property_code VARCHAR(64) DEFAULT NULL,
  project_code VARCHAR(64) DEFAULT NULL,
  property_name VARCHAR(255) DEFAULT NULL,
  property_price VARCHAR(64) DEFAULT NULL,
  property_address VARCHAR(255) DEFAULT NULL,
  listing_plan VARCHAR(128) DEFAULT NULL COMMENT '掲載企画',
  company_property_code VARCHAR(64) DEFAULT NULL COMMENT '貴社物件コード',
  transaction_type VARCHAR(64) DEFAULT NULL COMMENT '取引態様',
  origin_company VARCHAR(128) DEFAULT NULL COMMENT '元付会社',
  company_staff VARCHAR(128) DEFAULT NULL COMMENT '貴社ご担当',
  traffic VARCHAR(255) DEFAULT NULL COMMENT '交通',
  layout VARCHAR(64) DEFAULT NULL COMMENT '間取り',
  exclusive_area VARCHAR(32) DEFAULT NULL COMMENT '専有面積',
  building_area VARCHAR(32) DEFAULT NULL COMMENT '建物面積',
  land_area VARCHAR(32) DEFAULT NULL COMMENT '土地面積',
  customer_id VARCHAR(64) DEFAULT NULL COMMENT 'suumo_db_kaeru の顧客ID（② が結ぶ）',
  customer_match VARCHAR(16) DEFAULT NULL COMMENT '結び方: id / name / mail / phone',
  remarks TEXT DEFAULT NULL COMMENT 'CSV の全項目',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (no),
  UNIQUE KEY uq_suumo_action (action_id),
  KEY idx_suumo_action_customer (customer_id),
  KEY idx_suumo_action_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.263', '2026-11-11', '建売の反響一覧で、SUUMO の反響をお客様ごとではなく反響ごとに取り込むようにしました。同じお客様の2回目以降の反響も1行ずつ出ます（備考の先頭に印が付きます）。キャンセルされた予約は出ません。');

-- 3. 業務ガイドの記事
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- spec/screen-010.md：反響一覧（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧（建売営業）', 'spec', '画面の使い方', '届いた反響の確認・割り振り・取込。', '左のメニュー「反響一覧」。届いた反響を確認して、顧客DBに取り込みます。

[[画面:反響一覧]]

## 上の集計
- 反響合計（括弧内は未同期）
- 反響目標：営業の人数 × 8（1か月）
- 来場合計：初回面談の月で数える
- 来場目標：営業の人数 × 4

## 建売営業だけの列
- **物件名**：問い合わせのあった物件
- **希望エリア**

## SUUMO の反響は、反響ごとに1行
SUUMO の反響は、**お問い合わせ1回につき1行**で届きます。同じお客様が別の物件に問い合わせたり、資料請求のあとで見学を予約したりすると、その分だけ行が増えます（以前は、お客様1人につき最初の1行だけでした）。
- 同じお客様の2回目以降の行は、備考（虫めがね）の先頭に「**【同じお客様の反響あり】**」と、最初の反響の日付・これまでの件数・顧客DBに取り込み済みかどうかが出ます
- 複数の物件にまとめて資料請求があったときは、同じ日時の行が物件の数だけ並びます
- **キャンセルされた見学予約は出ません**。すでに届いている行があとからキャンセルになったときは、行は消えず、備考の先頭に「**【予約キャンセル 日時】**」が付きます
- 「物件名」「希望エリア」「来場予約」は、その行の反響のものです

> 注意：「同じお客様の反響あり」の行を顧客DBに取り込むと、同じお客様が2人分になります。すでに取り込み済みなら、顧客タグの「重複」を付けて、取り込まないでください。

> 要確認：備考の「取り込み済みかどうか」は、その行が届いた時点のものです。あとから取り込んだ場合は変わらないので、顧客DBでも確かめてください。

## 再読み込み
上の「🔄 再読み込み」を押すと、絞り込み（期間・店舗・氏名など）はそのままで、新しく届いた反響を読み直します。

## ブラックリストに登録する
顧客タグの「ブラックリスト」を押すと、小さな画面が開きます。**理由**を入れて「登録」を押すと登録されます。
- 理由が空のままでは登録できません
- 理由は、ヘッダーの「反響管理 → ブラックリスト設定」の**備考**に日付つきで残ります。同じ人をもう一度登録したときは、前の理由の下に書き足されます
- 外すとき（もう一度押す）は、理由の画面は出ません

## 個人情報削除
いちばん右の「個人情報削除」を押すと、その反響の**氏名・ふりがな・電話番号・メールアドレス・住所（郵便番号を含む）**を「********」に置き換え、**取込済み**にします。

> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。

> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。

## 関係する記事
- [[反響が来たら（建売営業）]]
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
